#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/usr/local/opt/node@20/bin:$PATH"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
MODE="${1:---verify}"
APP="$HOME/Applications/BlueBubbles-Custom.app"
OUT="$ROOT/packages/server/releases/custom-local/mac/BlueBubbles.app"
case "$MODE" in run|--verify|--logs|--telemetry|--debug|--build-only|--install-only) ;; *) echo 'Usage: build_and_run.sh [--verify|--logs|--telemetry|--debug|--build-only|--install-only]' >&2; exit 2;; esac
if [ "$MODE" != '--install-only' ]; then
    npm run test:custom --workspace=@bluebubbles/server
    npm run build-ui
    npm run build --workspace=@bluebubbles/server
    (cd packages/server && CSC_IDENTITY_AUTO_DISCOVERY=false ../../node_modules/.bin/electron-builder --mac --x64 --dir --publish never --config scripts/electron-builder-config.js --config.npmRebuild=false --config.mac.notarize=false --config.directories.output=releases/custom-local)
    ELECTRON_RUN_AS_NODE=1 "$OUT/Contents/MacOS/BlueBubbles" packages/server/scripts/test-database-startup.js
    python3 - "$ROOT" "$OUT" <<'PY'
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
root,out=map(Path,sys.argv[1:]);res=out/'Contents/Resources'
record={'server_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'source_dirty':bool(subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip()),'built_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'server_sha256':hashlib.sha256((root/'packages/server/dist/main.js').read_bytes()).hexdigest(),'custom_updates':'local-build-only'}
(res/'custom-build.json').write_text(json.dumps(record,indent=2)+'\n')
PY
fi
if [ "$MODE" = '--build-only' ]; then exit 0; fi
[ -f "$OUT/Contents/Resources/custom-build.json" ] || { echo 'Build first; custom provenance marker missing' >&2; exit 1; }
# Build first; keep the running service available until installation is ready.
python3 - "$APP" "$OUT" <<'PY'
import datetime,os,shutil,signal,sqlite3,subprocess,sys,time
from pathlib import Path
app,out=map(Path,sys.argv[1:]);rows=subprocess.check_output(['/bin/ps','-U',str(os.getuid()),'-o','pid=,comm='],text=True)
pids=[int(line.split(None,1)[0]) for line in rows.splitlines() if line.strip().endswith('/Contents/MacOS/BlueBubbles')]
for pid in pids:os.kill(pid,signal.SIGTERM)
for _ in range(30):
 if not any(subprocess.run(['/bin/kill','-0',str(p)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0 for p in pids):break
 time.sleep(1)
else:
 for pid in pids:
  info=subprocess.run(['/bin/ps','-p',str(pid),'-o','uid=,comm='],text=True,capture_output=True).stdout.strip().split(None,1)
  if len(info)==2 and int(info[0])==os.getuid() and info[1].endswith('/Contents/MacOS/BlueBubbles'):
   print('Graceful shutdown exceeded 30 seconds; terminating owned Server PID',pid)
   os.kill(pid,signal.SIGKILL)
 time.sleep(1)
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S');backup=Path.home()/'BlueBubbles-backups'/stamp;backup.mkdir(parents=True,exist_ok=True)
source=sqlite3.connect('file:'+str(Path.home()/'Library/Application Support/bluebubbles-server/config.db')+'?mode=ro',uri=True);target=sqlite3.connect(str(backup/'config.db'));source.backup(target);source.close();target.close()
if app.exists():app.rename(backup/'BlueBubbles-Custom.app')
app.parent.mkdir(parents=True,exist_ok=True);subprocess.run(['/usr/bin/ditto',str(out),str(app)],check=True)
print('Previous app/database saved at',backup)
PY
if [ "$MODE" = '--debug' ]; then exec lldb -- "$APP/Contents/MacOS/BlueBubbles" --disable-gpu --relaunch; fi
/usr/bin/open -n "$APP" --args --disable-gpu --relaunch
"$ROOT/script/ensure_running.sh"
case "$MODE" in
 --logs) exec tail -f "$HOME/Library/Logs/bluebubbles-server/main.log";;
 --telemetry) exec /usr/bin/log stream --info --predicate 'process == "BlueBubbles"';;
esac
"$ROOT/script/health.py"
