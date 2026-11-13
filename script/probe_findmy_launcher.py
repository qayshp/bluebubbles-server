#!/usr/bin/env python3
"""Controlled launcher probe. Non-baseline mode refreshes Find My caches; no message replay.
Never prints environment values or location records.
"""
import argparse,ctypes,datetime,hashlib,json,os,re,shutil,sqlite3,subprocess,tempfile,time,urllib.error,urllib.parse,urllib.request
from pathlib import Path

# Apple XNU osfmk/kern/cs_blobs.h; these are process status flags from csops.
# https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/kern/cs_blobs.h
CS_RESTRICT=0x00000800
CS_REQUIRE_LV=0x00002000
CS_RUNTIME=0x00010000

def decode_code_signing_flags(flags):
    return {
        'code_signing_flags':hex(flags) if flags is not None else None,
        'requires_library_validation':bool(flags&CS_REQUIRE_LV) if flags is not None else None,
        'restricted_by_code_signing':bool(flags&CS_RESTRICT) if flags is not None else None,
        'hardened_runtime':bool(flags&CS_RUNTIME) if flags is not None else None,
    }

def inspect_mapping(pid,timeout=5):
    try:
        maps=subprocess.run(['/usr/sbin/lsof','-p',str(pid)],text=True,capture_output=True,timeout=timeout)
    except (OSError,subprocess.TimeoutExpired) as error:
        return {'helper_mapped':None,'mapping_inspection_succeeded':False,'mapping_inspection_error':type(error).__name__}
    inspected=maps.returncode==0
    result={'helper_mapped':'BlueBubblesFindMyHelper.dylib' in maps.stdout if inspected else None,'mapping_inspection_succeeded':inspected}
    if not inspected:result['mapping_inspection_error']=f'ExitStatus{maps.returncode}'
    return result

parser=argparse.ArgumentParser();parser.add_argument('--deadline',type=int,default=30);parser.add_argument('--baseline',action='store_true');parser.add_argument('--output',required=True);args=parser.parse_args()
if not 0<=args.deadline<=60:parser.error('deadline must be 0–60 seconds')
report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'registration_deadline_seconds':args.deadline}
c=sqlite3.connect('file:'+str(Path.home()/'Library/Application Support/bluebubbles-server/config.db')+'?mode=ro',uri=True);password=c.execute("select value from config where name='password'").fetchone()[0];c.close()
try:password=json.loads(password)
except (ValueError,TypeError):pass

def request(endpoint,method='GET',timeout=5):
    query=urllib.parse.urlencode({'password':password});req=urllib.request.Request('http://127.0.0.1:1234/api/v1/'+endpoint+'?'+query,method=method,data=b'' if method=='POST' else None)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as error:
        try:body=json.load(error)
        except Exception:body={'failure':'NonJSONErrorResponse'}
        return error.code,body
    except Exception as error:return None,{'failure':type(error).__name__}

def processes():
    lines=subprocess.check_output(['/bin/ps','-U',str(os.getuid()),'-o','pid=,ppid=,comm='],text=True).splitlines();out=[]
    for line in lines:
        parts=line.split(None,2)
        if len(parts)==3 and parts[2].endswith('/FindMy.app/Contents/MacOS/FindMy'):out.append((int(parts[0]),int(parts[1])))
    return out

server_executable=str(Path.home()/'Applications/BlueBubbles-Custom.app/Contents/MacOS/BlueBubbles')
server_rows=subprocess.check_output(['/bin/ps','-U',str(os.getuid()),'-o','pid=,comm='],text=True).splitlines()
server_pids=[int(row.split(None,1)[0]) for row in server_rows if row.strip().endswith(server_executable)]
expected_pid=server_pids[0] if len(server_pids)==1 else None
report['expected_server_pid']=expected_pid
start=time.monotonic();end=start+args.deadline;samples=[]
while True:
    budget=max(.05,end-time.monotonic()) if args.deadline else 5
    status,body=request('icloud/findmy/status',timeout=min(5,budget));data=body.get('data') or {}
    if not isinstance(data,dict):data={};report['status_failure']='InvalidStatusResponse'
    pids=[entry for entry in processes() if expected_pid is not None and entry[1]==expected_pid]
    mapped=False;inspected=False;inspection_errors=[]
    for pid,_ in pids:
        budget=max(.05,end-time.monotonic()) if args.deadline else 5
        mapping=inspect_mapping(pid,timeout=min(5,budget))
        inspected|=mapping['mapping_inspection_succeeded'];mapped|=mapping['helper_mapped'] is True
        if mapping.get('mapping_inspection_error'):inspection_errors.append({'pid':pid,'error':mapping['mapping_inspection_error']});report['mapping_inspection_error']=mapping['mapping_inspection_error']
    samples.append({'seconds':round(time.monotonic()-start,2),'helper_connected':bool(data.get('helperConnected')),'helper_mapped':mapped if inspected else None,'mapping_inspection_succeeded':inspected,'mapping_inspection_errors':inspection_errors})
    if (mapped and data.get('helperConnected')) or time.monotonic()-start>=args.deadline:break
    time.sleep(min(1,max(0,args.deadline-(time.monotonic()-start))))
report.update(status_http=status,status=data,observations=samples,findmy_processes=[])
for pid,ppid in [entry for entry in processes() if expected_pid is not None and entry[1]==expected_pid]:
    env=subprocess.run(['/bin/ps','eww','-p',str(pid)],text=True,capture_output=True).stdout
    flags=ctypes.c_uint32();lib=ctypes.CDLL('/usr/lib/libSystem.B.dylib',use_errno=True);rc=lib.csops(pid,0,ctypes.byref(flags),ctypes.sizeof(flags))
    process={'pid':pid,'parent_pid':ppid,'environment_keys_visible_to_ps':{key:bool(re.search(r'(?:^|\s)'+key+r'=',env)) for key in ['HOME','USER','PATH']},'environment_visibility':'visible' if re.search(r'(?:^|\s)[A-Za-z_][A-Za-z0-9_]*=',env) else 'unavailable_or_empty',**decode_code_signing_flags(flags.value if rc==0 else None)}
    if rc!=0:process['code_signing_inspection_errno']=ctypes.get_errno()
    report['findmy_processes'].append(process)
if not args.baseline:
    report['refreshes']={}
    for kind in ['friends','devices']:
        status,body=request('icloud/findmy/'+kind+'/refresh','POST',timeout=35);records=body.get('data');error=body.get('error')
        report['refreshes'][kind]={'http_status':status,'record_count':len(records) if isinstance(records,list) else None,'records_with_locations':sum(bool(r.get('coordinates') if kind=='friends' else r.get('location')) for r in records) if isinstance(records,list) else None,'error':error.get('message') if isinstance(error,dict) else body.get('failure')}
# Hash the unrecorded source GUID set without printing message identifiers or touching the ledger.
try:
    source=sqlite3.connect('file:'+str(Path.home()/'Library/Messages/chat.db')+'?mode=ro',uri=True)
    with tempfile.TemporaryDirectory(prefix='bb-launcher-check-') as tmp:
        origin=Path.home()/'Library/Application Support/bbctl/prod/sh-imessage/mautrix-imessage.db';dest=Path(tmp)/'bridge.db'
        for suffix in ('','-wal'):
            if Path(str(origin)+suffix).exists():shutil.copy2(str(origin)+suffix,str(dest)+suffix)
        bridge=sqlite3.connect(str(dest));assert bridge.execute('pragma quick_check').fetchone()[0]=='ok';known={r[0] for r in bridge.execute('select distinct guid from message')}
        cutoff=int((time.time()-604800-978307200)*1e9)
        missing=sorted(r[0] for r in source.execute('select guid from message m where date>=? and coalesce(associated_message_type,0)<2000 and exists(select 1 from chat_message_join j where j.message_id=m.rowid)',(cutoff,)) if r[0] not in known)
        report['attachment_exceptions']={'unrecorded_count':len(missing),'guid_set_sha256':hashlib.sha256('\n'.join(missing).encode()).hexdigest()};bridge.close()
    source.close();
except Exception as error:
    report['attachment_exceptions']={'inspection_failure':type(error).__name__}
report['launcher_stages_passed']=bool(samples[-1]['helper_connected'] and samples[-1]['helper_mapped'])
output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,indent=2)+'\n');output.chmod(0o600)
print(json.dumps({key:report[key] for key in ['status_http','status','findmy_processes','attachment_exceptions','launcher_stages_passed']} | {'refreshes':report.get('refreshes')},indent=2))
