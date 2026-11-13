#!/usr/bin/env python3
"""Failure cases use synthetic files/process responses; never operate on installed services."""
import contextlib
import importlib.util
import io
import json
import os
import shutil
import sqlite3
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


deploy, health = load('deploy_custom'), load('health')


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.app, self.source = self.root / 'apps/custom.app', self.root / 'new.app'
        for app, contents in ((self.app, 'original'), (self.source, 'new')):
            app.mkdir(parents=True)
            (app / 'identity').write_text(contents)
        self.config, self.backups = self.root / 'config.db', self.root / 'backups'
        db = sqlite3.connect(self.config)
        db.execute('create table config(name text primary key, value text)')
        db.execute("insert into config values ('fixture', 'original')")
        db.commit();db.close()
        self.events = []

    def run_deploy(self, **changes):
        callbacks = dict(copy=lambda source, target: shutil.copytree(source, target),
                         validate=lambda _root, app: self.events.append(('validate', app)),
                         stop=lambda app: self.events.append(('stop', app)),
                         launch=lambda app, _debug=False: self.events.append(('launch', app)),
                         ready=lambda app: self.events.append(('ready', app)))
        callbacks.update(changes)
        return deploy.deploy(self.root, self.source, self.app, self.config, self.backups, **callbacks)

    def config_value(self):
        with contextlib.closing(sqlite3.connect(self.config)) as db:
            return db.execute("select value from config where name='fixture'").fetchone()[0]

    def assert_original(self):
        self.assertEqual((self.app / 'identity').read_text(), 'original')
        self.assertEqual(self.config_value(), 'original')

    def test_success_validates_before_stop_and_preserves_backup(self):
        backup = self.run_deploy()
        self.assertEqual([event[0] for event in self.events], ['validate', 'stop', 'launch', 'ready'])
        self.assertEqual((self.app / 'identity').read_text(), 'new')
        self.assertEqual((backup / self.app.name / 'identity').read_text(), 'original')
        self.assertTrue((backup / 'config.db').is_file())

    def test_partial_stage_copy_never_stops_original(self):
        def bad_copy(_source, target):
            target.mkdir();(target / 'partial').write_text('partial')
            raise OSError('stage copy failed')
        with self.assertRaisesRegex(OSError, 'stage copy failed'):
            self.run_deploy(copy=bad_copy)
        self.assert_original();self.assertEqual(self.events, [])

    def test_invalid_stage_never_stops_original(self):
        def invalid(*_args):
            raise RuntimeError('native module cannot load')
        with self.assertRaisesRegex(RuntimeError, 'native module cannot load'):
            self.run_deploy(validate=invalid)
        self.assert_original();self.assertEqual(self.events, [])

    def test_failed_app_swap_restores_previous_app(self):
        rename = Path.rename
        def fail_swap(path, target):
            if path.parent.name.startswith('.BlueBubbles-stage-'):
                raise OSError('swap failed')
            return rename(path, target)
        with patch.object(Path, 'rename', fail_swap), self.assertRaisesRegex(OSError, 'swap failed'):
            self.run_deploy()
        self.assert_original()
        self.assertEqual([event[0] for event in self.events][-2:], ['launch', 'ready'])

    def test_interruption_immediately_after_swap_is_detected_and_restored(self):
        rename = Path.rename
        def interrupted_swap(path, target):
            result = rename(path, target)
            if path.parent.name.startswith('.BlueBubbles-stage-'):
                raise KeyboardInterrupt()
            return result
        with patch.object(Path, 'rename', interrupted_swap), self.assertRaises(KeyboardInterrupt):
            self.run_deploy()
        self.assert_original()

    def test_failed_new_start_restores_app_and_database_after_migration(self):
        def start(app, _debug=False):
            if (app / 'identity').read_text() == 'new':
                with sqlite3.connect(self.config) as db:
                    db.execute("update config set value='changed by failed startup'")
                raise RuntimeError('startup failed')
            self.events.append(('launch', app))
        with self.assertRaisesRegex(RuntimeError, 'startup failed'):
            self.run_deploy(launch=start)
        self.assert_original()

    def test_failed_http_readiness_rolls_back_and_restarts_original(self):
        def ready(app):
            if (app / 'identity').read_text() == 'new':raise RuntimeError('not ready')
            self.events.append(('ready', app))
        with self.assertRaisesRegex(RuntimeError, 'not ready'):
            self.run_deploy(ready=ready)
        self.assert_original()

    def test_failed_stop_does_not_replace_or_relaunch_existing_app(self):
        def stop(_app):raise RuntimeError('still running')
        with self.assertRaisesRegex(RuntimeError, 'still running'):
            self.run_deploy(stop=stop)
        self.assert_original();self.assertEqual([event[0] for event in self.events], ['validate'])

    def test_missing_database_aborts_before_stopping(self):
        self.config.unlink()
        with self.assertRaisesRegex(RuntimeError, 'no app was stopped'):
            self.run_deploy()
        self.assertEqual(self.events, [])
        self.assertEqual((self.app / 'identity').read_text(), 'original')

    def test_empty_valid_database_is_not_accepted_as_a_backup(self):
        self.config.unlink();sqlite3.connect(self.config).close()
        with self.assertRaisesRegex(sqlite3.OperationalError, 'no such table'):
            self.run_deploy()
        self.assertEqual((self.app / 'identity').read_text(), 'original')
        self.assertEqual([event[0] for event in self.events][-2:], ['launch', 'ready'])

    def test_failed_database_restore_still_restores_app_and_reports_recovery(self):
        def ready(app):
            if (app / 'identity').read_text() == 'new':raise RuntimeError('not ready')
        with patch.object(deploy, 'restore_database', side_effect=OSError('restore unavailable')):
            with self.assertRaisesRegex(RuntimeError, 'rollback errors.*restore unavailable'):
                self.run_deploy(ready=ready)
        self.assertEqual((self.app / 'identity').read_text(), 'original')

    def test_process_selection_matches_only_exact_custom_executable(self):
        rows=f'11 {self.app}/Contents/MacOS/BlueBubbles\n22 /Applications/BlueBubbles.app/Contents/MacOS/BlueBubbles\n'
        with patch.object(deploy.subprocess, 'check_output', return_value=rows):
            self.assertEqual(deploy.server_pids(self.app), [11])

    def test_archive_and_unpacked_tampering_fail_before_native_execution(self):
        resources=self.source/'Contents/Resources';(resources/'app.asar.unpacked').mkdir(parents=True)
        (resources/'app.asar').write_bytes(b'archive');(resources/'app.asar.unpacked/native.node').write_bytes(b'native')
        helpers=resources/'appResources/private-api/macos11';helpers.mkdir(parents=True)
        for name in ('BlueBubblesHelper', 'BlueBubblesFindMyHelper'):
            (helpers/(name+'.dylib')).write_bytes(b'synthetic dylib')
            (helpers/(name+'.dylib.md5')).write_text(deploy.hashlib.md5(b'synthetic dylib').hexdigest())
        marker=resources/'custom-build.json';marker.write_text(json.dumps({'resource_hashes':deploy.resource_hashes(self.source)}))
        for name in ('app.asar', 'app.asar.unpacked/native.node'):
            original=(resources/name).read_bytes();(resources/name).write_bytes(b'changed')
            with patch.object(deploy.subprocess, 'run', side_effect=AssertionError('must reject before native commands')):
                with self.assertRaisesRegex(RuntimeError, 'provenance'):
                    deploy.validate_package(self.root, self.source)
            (resources/name).write_bytes(original)


class HealthTests(unittest.TestCase):
    @staticmethod
    def unavailable_readonly(real_connect, failure='backup'):
        class Source:
            def backup(self, _target):raise sqlite3.OperationalError('unable to open database file')
            def close(self):pass
        def connect(filename,*args,**kwargs):
            if kwargs.get('uri') and 'mode=ro' in str(filename):
                if failure=='open':raise sqlite3.OperationalError('unable to open database file')
                return Source()
            return real_connect(filename,*args,**kwargs)
        return connect

    def test_unavailable_readonly_open_or_backup_uses_verified_private_copy(self):
        for failure in ('open','backup'):
            with self.subTest(failure=failure),tempfile.TemporaryDirectory() as temp:
                live=Path(temp)/'bridge.db'
                db=sqlite3.connect(live);db.execute('create table message(guid text)')
                db.execute("insert into message values('fixture')");db.commit();db.close()
                connect=sqlite3.connect
                with patch.object(health.sqlite3,'connect',side_effect=self.unavailable_readonly(connect,failure)):
                    snapshot,directory=health.bridge_snapshot(live)
                self.assertEqual(snapshot.execute('select count(*) from message').fetchone()[0],1)
                snapshot.close();directory.cleanup()

    def test_fallback_retries_checkpoint_and_removed_wal_instead_of_accepting_stale_copy(self):
        for remove_wal in (False,True):
            with self.subTest(remove_wal=remove_wal),tempfile.TemporaryDirectory() as temp:
                live=Path(temp)/'bridge.db';db=sqlite3.connect(live)
                db.execute('pragma journal_mode=wal');db.execute('pragma wal_autocheckpoint=0')
                db.execute('create table message(guid text)');db.execute("insert into message values('first')")
                db.commit();db.execute('pragma wal_checkpoint(truncate)')
                db.execute("insert into message values('second')");db.commit()
                copy,connect=shutil.copy2,sqlite3.connect;copies=[]
                def raced_copy(source,target,*args,**kwargs):
                    result=copy(source,target,*args,**kwargs)
                    if Path(source)==live:
                        copies.append(source)
                        if len(copies)==1:
                            db.execute('pragma wal_checkpoint(truncate)')
                            if remove_wal:db.close()
                    return result
                with patch.object(health.sqlite3,'connect',side_effect=self.unavailable_readonly(connect)),patch.object(shutil,'copy2',side_effect=raced_copy):
                    snapshot,directory=health.bridge_snapshot(live)
                self.assertGreaterEqual(len(copies),2,'a raced copy must be discarded even if quick_check would pass')
                self.assertEqual(snapshot.execute('select count(*) from message').fetchone()[0],2)
                snapshot.close();directory.cleanup();db.close()

    def test_fallback_rejects_continuously_changing_source(self):
        with tempfile.TemporaryDirectory() as temp:
            live=Path(temp)/'bridge.db';db=sqlite3.connect(live)
            db.execute('pragma journal_mode=wal');db.execute('create table message(guid text)');db.commit()
            copy,connect=shutil.copy2,sqlite3.connect;copies=[]
            def changed_copy(source,target,*args,**kwargs):
                result=copy(source,target,*args,**kwargs)
                if Path(source)==live:
                    copies.append(source);db.execute('insert into message values(?)',(str(len(copies)),));db.commit()
                return result
            with patch.object(health.sqlite3,'connect',side_effect=self.unavailable_readonly(connect)),patch.object(shutil,'copy2',side_effect=changed_copy):
                with self.assertRaisesRegex(RuntimeError,'changed during snapshot'):
                    health.bridge_snapshot(live)
            self.assertEqual(len(copies),3);db.close()

    def test_unrelated_sqlite_errors_do_not_enable_copy_fallback(self):
        with patch.object(health.sqlite3,'connect',side_effect=sqlite3.OperationalError('database schema is locked')),patch.object(health,'stable_database_copy') as fallback:
            with self.assertRaisesRegex(sqlite3.OperationalError,'schema is locked'):
                health.bridge_snapshot(Path('/synthetic/bridge.db'))
            fallback.assert_not_called()

    def test_consistent_snapshot_includes_wal_even_during_checkpoint(self):
        with tempfile.TemporaryDirectory() as temp:
            live=Path(temp)/'bridge.db';db=sqlite3.connect(live)
            db.execute('pragma journal_mode=wal');db.execute('pragma wal_autocheckpoint=0')
            db.execute('create table message(guid text)');db.execute("insert into message values('fixture-one')")
            db.commit();db.execute('pragma wal_checkpoint(truncate)')
            db.execute("insert into message values('fixture-two')");db.commit()
            copy=shutil.copy2
            def raced_copy(source,target,*args,**kwargs):
                result=copy(source,target,*args,**kwargs)
                if Path(source)==live:db.execute('pragma wal_checkpoint(truncate)')
                return result
            with patch.object(shutil,'copy2',side_effect=raced_copy):
                snapshot,directory=health.bridge_snapshot(live)
            self.assertEqual(snapshot.execute('select count(*) from message').fetchone()[0],2)
            snapshot.close();directory.cleanup();db.close()

    def test_other_app_cannot_satisfy_custom_server_health(self):
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp);config=home/'Library/Application Support/bluebubbles-server/config.db';config.parent.mkdir(parents=True)
            with sqlite3.connect(config) as db:
                db.execute('create table config(name text,value text)');db.execute("insert into config values('password','fixture')")
            class Response(io.StringIO):
                status=200
                def __init__(self):super().__init__(json.dumps({'data':{'helperConnected':True}}))
            for executable,expected in ((str(home/'Applications/BlueBubbles-Custom.app/Contents/MacOS/BlueBubbles'),0),('/Applications/BlueBubbles.app/Contents/MacOS/BlueBubbles',1)):
                with self.subTest(executable=executable),patch.object(health.Path,'home',return_value=home),patch.object(health.urllib.request,'urlopen',side_effect=lambda *a,**k:Response()),patch.object(health,'coverage',return_value={'messages':{'missing':0},'reactions':{'missing':0}}),patch.object(health.subprocess,'check_output',return_value='99 '+executable+'\n'),patch.object(health.subprocess,'run',return_value=SimpleNamespace(stdout='ESTABLISHED\n')) as connections,patch('sys.argv',['health.py','--strict']),contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(health.main(),expected)
                    self.assertIn('-u',connections.call_args.args[0])


if __name__=='__main__':unittest.main(verbosity=2)
