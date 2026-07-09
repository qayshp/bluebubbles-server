# Find My Device Location Helper Install - 2026-07-09

## Recommendation

After adding FMIPCore and FindMyCore device-location probes to the helper dylib, the next best step is to install that dylib into the BlueBubbles server private API resource path and exercise the normal Android-facing Find My routes. This keeps the test close to the real app path instead of only validating isolated helper symbols.

## Installed helper

- Source build artifact:
  `/Users/qayspoonawala/Documents/Codex/2026-06-13/use-the-local-blue-bubbles-installation/bluebubbles-helper-findmy-docs/FindMy/MacOS-16+/build/Build/Products/Release/BlueBubblesFindMyHelper.dylib`
- Server resource destination:
  `packages/server/appResources/private-api/macos11/BlueBubblesFindMyHelper.dylib`
- Installed size:
  `679K`
- Installed md5:
  `21378648842f7268ab450008cef147b5`

## API-facing test target

The Android app uses the server API surface, so the first runtime validation should call:

- `GET /api/v1/findmy/devices/refresh`
- `GET /api/v1/findmy/devices`

The existing `FindMyInterface.refreshDevices()` path should:

1. Verify private API availability on Sequoia or later.
2. Select the Find My Devices view.
3. Send `refresh-findmy-devices` to `com.apple.findmy`.
4. Return `result.data.devices`.
5. Log `result.data.diagnostics` as `Find My device refresh diagnostics`.

## What to inspect in diagnostics

The updated dylib should expose whether the FMIP path is usable:

- `fmip_manager_start`
- `fmip_manager_devices`
- `findmy_device_location_probe`
- `fmip_device_location_setter`
- `findmycore_location_runtime`

Important outcomes:

- If `fmip_manager_devices.device_count` is non-zero and any serialized location field is non-null, FMIPCore can likely populate device coordinates directly.
- If device count is non-zero but all location fields are null, add a delayed snapshot after `FMIPManagerRefresh` so the helper can observe asynchronous updates before returning.
- If device count is zero, inspect the exact FMIPManager initialization/session path rather than continuing SearchParty item work.

## Next implementation step if immediate refresh is empty

Add a dedicated delayed device debug action that starts FMIPManager refresh, waits briefly, then snapshots `FMIPManager.devices` and any swizzled `setLocation:` events. This avoids changing the normal Android route timing until we know whether FMIPCore is simply asynchronous.
