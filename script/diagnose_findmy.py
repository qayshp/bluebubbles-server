#!/usr/bin/env python3
"""Inspect only the current user's Find My process; never changes signing or OS policy."""
import ctypes,json,os,subprocess
rows=subprocess.check_output(['/bin/ps','-U',str(os.getuid()),'-o','pid=,comm='],text=True)
result=[]
for row in rows.splitlines():
    if not row.strip().endswith('/FindMy.app/Contents/MacOS/FindMy'):continue
    pid=int(row.split(None,1)[0]);flags=ctypes.c_uint32();lib=ctypes.CDLL('/usr/lib/libSystem.B.dylib',use_errno=True)
    rc=lib.csops(pid,0,ctypes.byref(flags),4)
    maps=subprocess.run(['/usr/sbin/lsof','-p',str(pid)],text=True,capture_output=True)
    result.append({'pid':pid,'code_signing_flags':hex(flags.value) if rc==0 else None,'requires_library_validation':bool(flags.value & 0x2000) if rc==0 else None,'helper_mapped':'BlueBubblesFindMyHelper.dylib' in maps.stdout})
print(json.dumps({'findmy_processes':result,'note':'Library validation is an OS signing policy. This diagnostic does not disable or change it.'},indent=2))
