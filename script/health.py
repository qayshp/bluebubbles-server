#!/usr/bin/env python3
"""Read-only Server/helper/bridge diagnostics; message contents and credentials are never printed."""
import argparse,datetime,hashlib,json,os,shutil,sqlite3,subprocess,tempfile,time,urllib.request,urllib.parse
from pathlib import Path

def stable_database_copy(filename,target):
    files={suffix:Path(str(filename)+suffix) for suffix in ('','-wal','-journal')}
    def stamps():
        result={}
        for suffix,path in files.items():
            try:
                value=path.stat()
                result[suffix]=(value.st_dev,value.st_ino,value.st_size,value.st_mtime_ns,value.st_ctime_ns)
            except FileNotFoundError:result[suffix]=None
        return result
    before=stamps()
    if before[''] is None:raise FileNotFoundError(filename)
    for suffix,path in files.items():
        if before[suffix] is not None:shutil.copy2(path,str(target)+suffix)
    if stamps()!=before:raise RuntimeError('bridge changed during snapshot copy')
    for suffix,path in files.items():
        if before[suffix] is not None:
            if hashlib.sha256(path.read_bytes()).digest()!=hashlib.sha256(Path(str(target)+suffix).read_bytes()).digest():
                raise RuntimeError('bridge snapshot content changed during verification')
    if stamps()!=before:raise RuntimeError('bridge changed during snapshot verification')

def bridge_snapshot(filename):
    for attempt in range(3):
        directory=tempfile.TemporaryDirectory(prefix='bluebubbles-health-')
        target=Path(directory.name)/'bridge.db'
        source=db=None
        try:
            # SQLite's backup transaction stays consistent across concurrent checkpoints.
            # Copying the live main/WAL files separately can silently lose committed rows.
            try:
                source=sqlite3.connect(Path(filename).resolve().as_uri()+'?mode=ro',uri=True)
                db=sqlite3.connect(str(target))
                source.backup(db)
            except sqlite3.OperationalError as error:
                code=(getattr(error,'sqlite_errorcode',0) or 0)&255
                if code not in (8,14) and str(error) not in ('unable to open database file','attempt to write a readonly database'):raise
                # Some live bridge DBs cannot be queried read-only when their WAL
                # sidecars are absent. Recover only a byte-verified, unchanged copy.
                if source is not None:source.close();source=None
                if db is not None:db.close();db=None
                for suffix in ('','-wal','-shm','-journal'):Path(str(target)+suffix).unlink(missing_ok=True)
                stable_database_copy(filename,target)
                db=sqlite3.connect(str(target))
            if source is not None:source.close();source=None
            if db.execute('pragma quick_check').fetchone()[0]!='ok':raise RuntimeError('snapshot integrity check failed')
            return db,directory
        except Exception:
            if source is not None:source.close()
            if db is not None:db.close()
            directory.cleanup()
            if attempt==2:raise
            time.sleep(.1)

def coverage(days):
    b,tmp=bridge_snapshot(Path.home()/'Library/Application Support/bbctl/prod/sh-imessage/mautrix-imessage.db')
    s=sqlite3.connect('file:'+str(Path.home()/'Library/Messages/chat.db')+'?mode=ro',uri=True)
    cutoff=int((time.time()-days*86400-978307200)*1e9)
    rows=s.execute('select guid,date,coalesce(associated_message_type,0) from message m where date>=? and exists(select 1 from chat_message_join j where j.message_id=m.rowid)',(cutoff,)).fetchall()
    out={}
    for name,flag,table in [('messages',False,'message'),('reactions',True,'tapback')]:
        known={r[0] for r in b.execute('select distinct guid from '+table)}
        selected=[r for r in rows if (r[2]>=2000)==flag]
        times=[r[1]/1e9+978307200 for r in selected if r[0] in known]
        out[name]={'source':len(selected),'recorded':sum(r[0] in known for r in selected),'missing':sum(r[0] not in known for r in selected),'latest_recorded':datetime.datetime.fromtimestamp(max(times),datetime.timezone.utc).isoformat() if times else None}
    b.close();s.close();tmp.cleanup();return out

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--days',type=int,default=7);parser.add_argument('--strict',action='store_true');args=parser.parse_args()
    if not 1<=args.days<=90:parser.error('days must be between 1 and 90')
    out={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'days':args.days}
    try:
        with urllib.request.urlopen('http://127.0.0.1:1234/',timeout=5) as r:out['server_http']=r.status
    except Exception as e:out['server_error']=type(e).__name__
    try:
        c=sqlite3.connect('file:'+str(Path.home()/'Library/Application Support/bluebubbles-server/config.db')+'?mode=ro',uri=True)
        pw=c.execute("select value from config where name='password'").fetchone()[0];c.close()
        try:pw=json.loads(pw)
        except (ValueError,TypeError):pass
        url='http://127.0.0.1:1234/api/v1/icloud/findmy/status?'+urllib.parse.urlencode({'password':pw})
        with urllib.request.urlopen(url,timeout=5) as r:out['findmy']=json.load(r).get('data')
    except Exception as e:out['findmy_error']=type(e).__name__
    try:out['coverage']=coverage(args.days)
    except Exception as e:out['coverage_error']=type(e).__name__
    ps=subprocess.check_output(['/bin/ps','-U',str(os.getuid()),'-o','pid=,comm='],text=True)
    servers=[line.strip() for line in ps.splitlines() if line.strip().endswith('/Contents/MacOS/BlueBubbles')]
    out['server_processes']=servers
    tcp=subprocess.run(['/usr/sbin/lsof','-nP','-a','-u',str(os.getuid()),'-c','mautrix-imessage','-iTCP:1234'],text=True,capture_output=True)
    out['bridge_connections']=sum('ESTABLISHED' in line for line in tcp.stdout.splitlines())
    marker=Path.home()/'Applications/BlueBubbles-Custom.app/Contents/Resources/custom-build.json'
    if marker.exists():
        build=json.loads(marker.read_text())
        out['build']={key:build[key] for key in ('server_commit','source_dirty','built_at','server_sha256','custom_updates') if key in build}
    print(json.dumps(out,indent=2))
    custom_executable=str(Path.home()/'Applications/BlueBubbles-Custom.app/Contents/MacOS/BlueBubbles')
    correct_server=len(servers)==1 and servers[0].split(None,1)[1]==custom_executable
    unhealthy=(out.get('server_http')!=200 or not correct_server or out.get('bridge_connections',0)==0 or 'coverage' not in out or any(v['missing'] for v in out.get('coverage',{}).values()) or not (out.get('findmy') or {}).get('helperConnected',False))
    return 1 if args.strict and unhealthy else 0
if __name__=='__main__':raise SystemExit(main())
