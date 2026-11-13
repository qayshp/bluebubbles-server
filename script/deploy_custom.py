#!/usr/bin/env python3
"""Validate and stage the custom package before replacing this user's installed app."""
import argparse
import datetime
import hashlib
import json
import os
import shutil
import signal
import sqlite3
import subprocess
import tempfile
import time
import urllib.request
from contextlib import closing
from pathlib import Path


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def resource_hashes(app):
    resources = app / 'Contents/Resources'
    archive, unpacked = resources / 'app.asar', resources / 'app.asar.unpacked'
    if not archive.is_file() or not unpacked.is_dir():
        raise RuntimeError('Package archive or unpacked native resources are missing')
    files = [archive, *(path for path in unpacked.rglob('*') if path.is_file())]
    helpers = resources / 'appResources/private-api/macos11'
    for name in ('BlueBubblesHelper', 'BlueBubblesFindMyHelper'):
        dylib = helpers / (name + '.dylib')
        checksum = helpers / (name + '.dylib.md5')
        if hashlib.md5(dylib.read_bytes()).hexdigest() != checksum.read_text().strip():
            raise RuntimeError('Packaged helper checksum mismatch: ' + name)
        files.extend((dylib, checksum))
    return {path.relative_to(resources).as_posix(): sha256(path) for path in sorted(files)}


def record_build(root, app):
    record = {
        'server_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
        'source_dirty': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=root, text=True).strip()),
        'built_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'server_sha256': sha256(root / 'packages/server/dist/main.js'),
        'resource_hashes': resource_hashes(app),
        'custom_updates': 'local-build-only',
    }
    (app / 'Contents/Resources/custom-build.json').write_text(json.dumps(record, indent=2) + '\n')


def validate_package(root, app):
    record = json.loads((app / 'Contents/Resources/custom-build.json').read_text())
    if record.get('resource_hashes') != resource_hashes(app):
        raise RuntimeError('Package bytes no longer match their build provenance; rebuild before installing')
    for name in ('BlueBubblesHelper', 'BlueBubblesFindMyHelper'):
        dylib = app / ('Contents/Resources/appResources/private-api/macos11/' + name + '.dylib')
        subprocess.run(['/usr/bin/lipo', str(dylib), '-verify_arch', 'x86_64'], check=True, capture_output=True)
        if name == 'BlueBubblesFindMyHelper':
            install_name = subprocess.check_output(['/usr/bin/otool', '-D', str(dylib)], text=True).splitlines()[-1].strip()
            if install_name != '@rpath/' + name + '.dylib':
                raise RuntimeError('Unexpected packaged Find My helper install name')
    env = dict(os.environ, ELECTRON_RUN_AS_NODE='1')
    subprocess.run([str(app / 'Contents/MacOS/BlueBubbles'),
                    str(root / 'packages/server/scripts/test-database-startup.js'),
                    '--resources', str(app / 'Contents/Resources')], env=env, check=True)


def server_pids(app):
    executable = str(app / 'Contents/MacOS/BlueBubbles')
    rows = subprocess.check_output(['/bin/ps', '-U', str(os.getuid()), '-o', 'pid=,comm='], text=True)
    return [int(parts[0]) for row in rows.splitlines()
            if len(parts := row.strip().split(None, 1)) == 2 and parts[1] == executable]


def stop_app(app):
    for signum, deadline in ((signal.SIGTERM, 30), (signal.SIGKILL, 5)):
        for pid in server_pids(app):
            try:
                os.kill(pid, signum)
            except ProcessLookupError:
                pass
        end = time.monotonic() + deadline
        while server_pids(app) and time.monotonic() < end:
            time.sleep(.2)
        if not server_pids(app):
            return
    raise RuntimeError('Custom Server did not stop; refusing to copy its database or replace its app')


def snapshot_database(config, destination):
    if not config.is_file():
        raise RuntimeError('Existing Server configuration database is missing')
    with tempfile.TemporaryDirectory(prefix='sqlite-snapshot-', dir=destination.parent) as tmp:
        copied = Path(tmp) / 'config.db'
        for suffix in ('', '-wal'):
            source = Path(str(config) + suffix)
            if source.exists():
                shutil.copy2(source, str(copied) + suffix)
        with closing(sqlite3.connect(str(copied))) as source, closing(sqlite3.connect(str(destination))) as target:
            if source.execute('pragma quick_check').fetchone()[0] != 'ok':
                raise RuntimeError('Configuration snapshot integrity check failed')
            source.execute('select count(*) from config').fetchone()  # Reject an empty but valid SQLite file.
            source.backup(target)
            if target.execute('pragma quick_check').fetchone()[0] != 'ok':
                raise RuntimeError('Configuration backup readback failed')


def restore_database(backup, config):
    descriptor, filename = tempfile.mkstemp(prefix='.config.db.restore-', dir=config.parent)
    os.close(descriptor)
    staged = Path(filename)
    try:
        shutil.copy2(backup, staged)
        with staged.open('rb') as stream:
            os.fsync(stream.fileno())
        os.replace(staged, config)
        for suffix in ('-wal', '-shm'):
            Path(str(config) + suffix).unlink(missing_ok=True)
    finally:
        staged.unlink(missing_ok=True)


def launch_app(app, debug=False):
    if debug:
        subprocess.run(['lldb', '--', str(app / 'Contents/MacOS/BlueBubbles'), '--disable-gpu', '--relaunch'], check=True)
    subprocess.run(['/usr/bin/open', '-n', str(app), '--args', '--disable-gpu', '--relaunch'], check=True)


def wait_ready(app):
    for _ in range(60):
        pids = server_pids(app)
        if len(pids) == 1:
            listener = subprocess.run(['/usr/sbin/lsof', '-nP', '-a', '-p', str(pids[0]),
                                       '-iTCP:1234', '-sTCP:LISTEN', '-Fp'], capture_output=True, text=True)
            if listener.returncode == 0:
                try:
                    with urllib.request.urlopen('http://127.0.0.1:1234/', timeout=2) as response:
                        if response.status == 200:
                            return
                except OSError:
                    pass
        time.sleep(1)
    raise RuntimeError('Installed custom Server did not own port 1234 and become ready')


def copy_app(source, destination):
    subprocess.run(['/usr/bin/ditto', str(source), str(destination)], check=True)


def deploy(root, source, app, config, backups, *, validate=validate_package,
           copy=copy_app, stop=stop_app, launch=launch_app, ready=wait_ready, debug=False):
    if not config.is_file():
        raise RuntimeError('Existing Server configuration database is missing; no app was stopped')
    app.parent.mkdir(parents=True, exist_ok=True)
    backups.mkdir(parents=True, exist_ok=True)
    # A same-volume stage keeps both the existing app and its resources available throughout validation.
    with tempfile.TemporaryDirectory(prefix='.BlueBubbles-stage-', dir=app.parent) as temporary:
        staged = Path(temporary) / app.name
        copy(source, staged)
        validate(root, staged)
        backup = Path(tempfile.mkdtemp(prefix=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-'), dir=backups))
        previous, database = backup / app.name, backup / 'config.db'
        stopped = False
        try:
            stop(app)
            stopped = True
            snapshot_database(config, database)
            if app.exists():
                app.rename(previous)
            staged.rename(app)
            launch(app, debug)
            ready(app)
        except BaseException as original:
            # Infer completed atomic renames, including interruption just after rename.
            new_installed = not staged.exists() and app.exists()
            errors = []
            if new_installed:
                try:
                    stop(app)  # Do not restore files underneath a running process.
                except BaseException as error:
                    raise RuntimeError(f'New Server could not stop; recovery files: {backup}') from error
                try:
                    app.rename(backup / ('failed-' + app.name))
                    restore_database(database, config)
                except BaseException as error:
                    errors.append(str(error))
            if previous.exists():
                try:
                    previous.rename(app)
                except BaseException as error:
                    errors.append(str(error))
            if stopped and app.exists() and not errors:
                try:
                    launch(app)
                    ready(app)
                except BaseException as error:
                    errors.append(str(error))
            if errors:
                raise RuntimeError(f'Deployment failed; recovery files: {backup}; rollback errors: {errors}') from original
            raise
        return backup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('record', 'validate', 'deploy'))
    parser.add_argument('root', type=Path)
    parser.add_argument('package', type=Path)
    parser.add_argument('--debug', action='store_true')
    args = parser.parse_args()
    if args.action == 'record':
        record_build(args.root, args.package)
    elif args.action == 'validate':
        validate_package(args.root, args.package)
    else:
        backup = deploy(args.root, args.package, Path.home() / 'Applications/BlueBubbles-Custom.app',
                        Path.home() / 'Library/Application Support/bluebubbles-server/config.db',
                        Path.home() / 'BlueBubbles-backups', debug=args.debug)
        print('Previous app/database saved at', backup)


if __name__ == '__main__':
    main()
