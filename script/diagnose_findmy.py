#!/usr/bin/env python3
"""Inspect only the current user's Find My process; never changes signing or OS policy."""
import ctypes
import json
import os
import subprocess

# Apple XNU osfmk/kern/cs_blobs.h; these are process status flags from csops.
# https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/kern/cs_blobs.h
CS_RESTRICT = 0x00000800
CS_REQUIRE_LV = 0x00002000
CS_RUNTIME = 0x00010000


def decode_code_signing_flags(flags):
    return {
        'code_signing_flags': hex(flags) if flags is not None else None,
        'requires_library_validation': bool(flags & CS_REQUIRE_LV) if flags is not None else None,
        'restricted_by_code_signing': bool(flags & CS_RESTRICT) if flags is not None else None,
        'hardened_runtime': bool(flags & CS_RUNTIME) if flags is not None else None,
    }


def inspect_mapping(pid, timeout=5):
    try:
        maps = subprocess.run(
            ['/usr/sbin/lsof', '-p', str(pid)], text=True, capture_output=True, timeout=timeout
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return {
            'helper_mapped': None,
            'mapping_inspection_succeeded': False,
            'mapping_inspection_error': type(error).__name__,
        }
    inspected = maps.returncode == 0
    result = {
        'helper_mapped': 'BlueBubblesFindMyHelper.dylib' in maps.stdout if inspected else None,
        'mapping_inspection_succeeded': inspected,
    }
    if not inspected:
        result['mapping_inspection_error'] = f'ExitStatus{maps.returncode}'
    return result


rows = subprocess.check_output(['/bin/ps', '-U', str(os.getuid()), '-o', 'pid=,comm='], text=True)
lib = ctypes.CDLL('/usr/lib/libSystem.B.dylib', use_errno=True)
result = []
for row in rows.splitlines():
    if not row.strip().endswith('/FindMy.app/Contents/MacOS/FindMy'):
        continue
    pid = int(row.split(None, 1)[0])
    flags = ctypes.c_uint32()
    rc = lib.csops(pid, 0, ctypes.byref(flags), ctypes.sizeof(flags))
    process = {'pid': pid, **decode_code_signing_flags(flags.value if rc == 0 else None)}
    if rc != 0:
        process['code_signing_inspection_errno'] = ctypes.get_errno()
    process.update(inspect_mapping(pid))
    result.append(process)
print(json.dumps({
    'findmy_processes': result,
    'note': 'Code-signing flags describe OS policy; they do not alone prove a loader rejection. '
            'A null helper_mapped means inspection failed. This diagnostic does not change policy.'
}, indent=2))
