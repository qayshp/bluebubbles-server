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

## Runtime test result

The server was started from this branch with Node 20.20.2 / npm 10.8.2 because the system Node 26 / npm 11 rejects the repository's current `devEngines.node` metadata. The HTTP server started on port `1234`, the private API socket server started on port `45675`, and the Find My helper connected via `com.apple.findmy`.

Android-facing route results from localhost:

- `POST /api/v1/icloud/findmy/friends/refresh`: HTTP 200, 8 records.
- `POST /api/v1/icloud/findmy/devices/refresh`: client request hung long enough to require cancellation; no response file was written.
- `POST /api/v1/icloud/findmy/items/refresh`: HTTP 200, but no item records.
- `GET /api/v1/icloud/findmy/friends`: HTTP 200, 8 records.
- `GET /api/v1/icloud/findmy/devices`: HTTP 200, `data: null`.
- `GET /api/v1/icloud/findmy/items`: HTTP 200, `data: null`.

The `GET` device/item nulls are expected on Sequoia because those routes still call the disabled cache readers and log:

- `Cannot fetch FindMy devices on macOS Sequoia or later.`
- `Cannot fetch FindMy items on macOS Sequoia or later.`

The item refresh produced useful diagnostics even though it did not return items:

- SearchParty completion produced `SPLocationFetchContext`.
- `lastOnlineLocationInfo` was non-empty with 10 UUID keys.
- `searchLocationSources` was non-empty with 12 source strings.
- Repeated `SPLocationFetchResult.locationsByBeaconIdentifier` captures were empty.
- `receivedUpdatedLocation:` delivered an `SPLocationFetchResult`, but `_locationsByBeaconIdentifier` was an empty dictionary.
- The active table scan still showed `FMDevicesListDataSource` cells shortly before the item data source was observed, then `FMItemsListDataSource` had `visible_cell_count: 0` and `ui_item_count: 0`.

## Suggested next steps after this run

1. Add a dedicated delayed device debug action that dispatches `refresh-findmy-devices`, waits for helper-side asynchronous FMIP updates, then snapshots `FMIPManager.devices`, FMIP device location fields, and any `setLocation:` / `setCrowdSourcedLocation:` swizzle events.
2. Keep the normal Android route unchanged until that diagnostic proves whether the hang is route timing, helper transaction completion, or an FMIPManager initialization issue.
3. If delayed FMIPManager snapshots still return no location fields, instrument FMIPCore's device update callback around the strings `FMIPManager: didReceiveDevices` and `FMIPDataManager: updateDevicesLocations`.

The next implemented step should be item 1. It gives us a bounded device-specific probe without risking the Android-facing `/devices/refresh` behavior.

## Implemented next step

Added a bounded delayed device diagnostic route:

- `POST /api/v1/icloud/findmy/devices/debug/delayed`

This route calls the private API action `debug-findmy-devices-delayed` in `com.apple.findmy`. The helper selects the Devices segment, starts FMIPManager when possible, captures an immediate `FMIPManager.devices` snapshot, waits 3 seconds, then captures and returns a delayed snapshot. It deliberately avoids the existing `allBeaconsWithCompletion:` fallback so the route should always return after the fixed delay.

The first installed helper md5 for this route was:

- `30da432bfafe2ec6e2fd9773bfc256e6`

Expected interpretation:

- Non-zero delayed device count with location fields means FMIPCore can feed the Android device route.
- Zero initial count but non-zero delayed count means the normal route needs asynchronous waiting before returning.
- Zero delayed count means the next target should be swizzling/logging the FMIPCore callbacks around `FMIPManager: didReceiveDevices` and `FMIPDataManager: updateDevicesLocations`.

## Follow-up hardening

The first live call to `POST /api/v1/icloud/findmy/devices/debug/delayed` reached Find My and then the Find My helper disconnected at the delayed snapshot point. The request timed out with no response. That points to an unsafe accessor or KVC path while serializing populated `FMIPManager.devices`.

The helper serializer was hardened to catch exceptions per FMIP device and report:

- `serialization_error_count`
- `serialization_errors`

The updated installed helper md5 after this hardening is:

- `d340b14c62f6d0cb4ea6790bff4e92de`

## Hardened route result

A clean call to `POST /api/v1/icloud/findmy/devices/debug/delayed` with the hardened helper still timed out with no response. The server log showed:

- Request started at `2026-07-09 02:00:35`.
- The Find My helper socket ended at `2026-07-09 02:00:38`.
- BlueBubbles marked the Find My process as force quit and relaunched it.
- The API transaction timed out after about 123 seconds.

That means the Objective-C per-device exception handling did not get a chance to report a bad field. The crash is likely at the Swift bridge snapshot boundary, before normal Objective-C serialization.

## Metadata-only helper install

The next installed helper changes the FMIP device bridge to avoid returning raw Swift `FMIPDevice` values through Objective-C. It now returns only Swift-side metadata from the delayed route:

- `device_count`
- `device_classes`
- first 10 `device_summaries`
- Mirror child labels for those summaries

The installed helper md5 for this metadata-only attempt is:

- `fd4ee5b187c13a7eb00640b46f959cb2`

If the delayed route survives and returns a non-zero count, the next extraction should remain Swift-side and add individual fields one at a time. If it still crashes, the next target is either the `FMIPManager.devices` accessor itself or the manager initialization/timing rather than the Objective-C serializer.

## Metadata-only route result

The metadata-only route still crashed Find My:

- Request started at `2026-07-09 02:06:19`.
- The Find My helper socket ended at `2026-07-09 02:06:22`.
- BlueBubbles marked the Find My process as force quit and relaunched it.
- A 30 second curl call returned HTTP `000` with no response body.

This rules out raw Swift device values crossing into Objective-C as the only crash source. The next narrower installed helper should call `FMIPManager.devices` and return only `devices.count`, with no element type mapping, descriptions, Mirror summaries, or Objective-C device serialization.

## Count-only helper install

Installed the next narrower helper. It reports `snapshot_mode: count_only` from the FMIP device snapshot and intentionally leaves element metadata empty.

The installed helper md5 for this count-only attempt is:

- `8e6989e266ef88d3d4c9c74e0445bdca`

Interpretation:

- If this route returns, then `FMIPManager.devices` can be called safely and the crash is in element inspection.
- If this route still crashes, then either the `FMIPManager.devices` accessor itself is unsafe with our current Swift declaration/timing, or the manager needs to be observed through a different callback/provider path.

## Count-only route result

The count-only helper still crashed Find My:

- Request started at `2026-07-09 02:10:26`.
- The Find My helper socket ended at `2026-07-09 02:10:29`.
- BlueBubbles marked Find My as force quit and relaunched it.
- A 30 second curl call returned HTTP `000` with no response body.

This means even evaluating `FMIPManager.devices.count` through the current handwritten Swift bridge is unsafe after refresh. The next server-facing work should wait until the helper finds a safer FMIPCore access path, most likely by inspecting the private framework metadata for the true accessor ABI or by hooking callback/update methods instead of pulling the property.

## FMIP callback watch helper install

Installed the helper that adds the isolated callback-watch route:

```text
POST /api/v1/icloud/findmy/devices/debug/fmip-callbacks
```

This route calls helper action:

```text
debug-findmy-devices-fmip-callbacks
```

The route selects the Devices view, starts `FMIPManager`, waits 8 seconds, and returns callback/runtime diagnostics. It does not call `FMIPManager.devices` or serialize device records.

The installed helper md5 for this attempt is:

- `db2eeb6e4ae3d7af6a7f9ebca2d2e298`

Interpretation:

- If the route returns with `fmip_callbacks.callback_count > 0`, inspect callback arguments for location-bearing objects.
- If the route returns with no callbacks, move to a SiriFindMy provider-specific probe.
- If the route crashes, reduce the watcher to one selector/class family at a time.

## Scoped FMIPDataManager callback helper install

Installed helper checksum:

```text
6a41ab32b563ed1b91b455f4fb912def
```

This build narrows the same debug route so it no longer installs the broad FMIP/SiriFindMy callback watcher. The helper now watches only the `FMIPDataManager` class family for selectors containing `updateDevicesLocations`.

Reason:

- The broad callback watcher caused Find My to be force-quit during the first route call.
- The narrow route keeps the `FMIPManager.devices` direct accessor off-limits and tests the most direct update method first.
- Normal Find My swizzles no longer install the broad FMIP callback watcher by default.

## Scoped FMIPDataManager route result

The scoped `FMIPDataManager.updateDevicesLocations` route still crashed Find My:

- Request started at `2026-07-09 09:22:08`.
- The Find My helper socket ended at `2026-07-09 09:22:12`.
- BlueBubbles marked Find My as force quit and relaunched it.
- A 45 second curl call returned HTTP `000` with no response body.

Interpretation:

- The generic object-argument trampoline is not safe for this method family.
- `updateDevicesLocations` remains semantically interesting, but this swizzle shape should not be used again without a method-specific signature.
- The next runtime step is to test `FMIPManager.didReceiveDevices`, then switch to SiriFindMy provider inspection if that also fails.

## Scoped FMIPManager didReceiveDevices helper install

Installed helper checksum:

```text
ad90e7d2cd4fed4c56edbc1d692781c1
```

This build moves the same debug route to the second FMIPCore callback lead:

```text
FMIPCore.FMIPManager / _TtC8FMIPCore11FMIPManager / FMIPManager
selector contains didReceiveDevices
```

It still avoids direct `FMIPManager.devices` reads.

## Scoped FMIPManager didReceiveDevices route result

The scoped `FMIPManager.didReceiveDevices` route also crashed Find My:

- Request started at `2026-07-09 09:25:32`.
- The Find My helper socket ended at `2026-07-09 09:25:35`.
- BlueBubbles marked Find My as force quit and relaunched it.
- A 45 second curl call returned HTTP `000` with no response body.

Interpretation:

- Generic callback swizzling is likely the wrong shape for FMIPCore Swift methods.
- The next step should avoid FMIPCore callback swizzling and inspect the SiriFindMy provider layer, especially `FMIPSyncDeviceProvider`, `devicesPublisher`, and retained provider/session objects.

## Provider runtime helper install

Installed helper checksum:

```text
a76211d6b7eff967b56647c6831f12e6
```

Added route:

```text
POST /api/v1/icloud/findmy/devices/debug/provider-runtime
```

This route calls helper action:

```text
debug-findmy-devices-provider-runtime
```

The helper selects the Devices view and returns SiriFindMy/FMIP provider runtime diagnostics plus object graph/session summaries. It does not install FMIPCore callback swizzles and does not call `FMIPManager.devices`.

## Provider runtime first route result

The first provider-runtime route call returned successfully:

- HTTP 200.
- Find My did not crash.
- `selected_devices_segment` was `true`.
- `active_devices_list.visible_cell_count` was `13`.

However, the response was over-compacted and omitted the intended `runtime`, `object_graph`, `session_objects`, and `probe_mode` fields. The helper was updated to return full diagnostics for this route.

Updated installed helper checksum:

```text
2e14aefbe35c29b9248ba44d84e839d7
```

## Provider runtime full diagnostics result

The full-diagnostics provider route sent a payload, but the server could not decode it:

- Request started at `2026-07-09 09:34:43`.
- The helper sent a large JSON payload.
- The server logged `Failed to decode BlueBubblesHelper data!`.
- The JSON appeared split around 64 KB boundaries, causing parse errors such as `Unterminated string in JSON`.
- The HTTP request timed out with HTTP `000` because the transaction response never decoded.

Useful details visible before truncation:

- `SiriFindMy.FMIPCoreFindDeviceSession`: not available.
- `SiriFindMy.FMIPSyncDeviceProvider`: not available.
- `SiriFindMy.FMIPManagerWrapperImpl`: not available.
- `FMIPCore.FMIPManager`: available, with ivars such as `ownerSession`, `dataManager`, `locationController`, `refreshingController`, `snapshotDevicesResponseReceived`, and `isUpdatingSingleDevices`.
- `FMIPCore.FMIPDataManager`: available, with ivars such as `devices`, `crowdSourcedOriginalLocations`, `crowdSourcedLocations`, `deviceConnectedStates`, `safeLocations`, `safeLocationsMapping`, `items`, and `itemGroups`.

The helper was updated again to keep runtime details but bound object/session/passive diagnostics to summaries.

Bounded provider helper checksum:

```text
a1d91cb41afd1c39d945bd7cf5292783
```

## Bounded provider runtime route result

The bounded provider-runtime route returned successfully:

- HTTP 200.
- Response size: 10,495 bytes.
- Request duration: 10.6 seconds.
- No Find My crash after the route.
- `probe_mode`: `provider_runtime_no_fmip_callback_swizzle`
- `selected_devices_segment`: `true`
- Active Devices data source: `FindMy.FMDevicesListDataSource`
- Visible device cells: 13

Runtime availability:

- Available:
  - `FMIPCore.FMIPManager`
  - `_TtC8FMIPCore11FMIPManager`
  - `FMIPCore.FMIPDataManager`
  - `_TtC8FMIPCore15FMIPDataManager`
- Not available:
  - SiriFindMy `FMIPCoreFindDeviceSession`
  - SiriFindMy `FMIPSyncDeviceProvider`
  - SiriFindMy `FMIPManagerWrapperImpl`
  - SiriFindMy `FindDeviceIntentHandler`

Useful `FMIPDataManager` ivars exposed by runtime metadata:

- `devices`
- `owner`
- `familyMembers`
- `crowdSourcedOriginalLocations`
- `crowdSourcedLocations`
- `crowdSourcedLocating`
- `deviceConnectedStates`
- `safeLocations`
- `safeLocationsMapping`

Next target:

- Capture or retrieve the retained `FMIPManager` instance.
- Follow its `dataManager` ivar.
- Inspect `FMIPDataManager` ivars directly with bounded summaries, starting with `devices`, `crowdSourcedLocations`, and `deviceConnectedStates`.
- Continue avoiding `FMIPManager.devices`, which crashed even when accessed only for `.count`.

## FMIPDataManager ivar probe install

Installed helper checksum:

```text
3d23119a7bdb365ac6ea013b7f757de3
```

Added server-facing route:

```text
POST /api/v1/icloud/findmy/devices/debug/fmip-datamanager
```

This route calls helper action:

```text
debug-findmy-devices-fmip-datamanager
```

Reasoning:

- The bounded provider runtime route showed that `FMIPManager` owns a `dataManager` ivar.
- Runtime metadata showed that `FMIPDataManager` has likely useful ivars: `devices`, `crowdSourcedLocations`, `crowdSourcedOriginalLocations`, `deviceConnectedStates`, `safeLocations`, `safeLocationsMapping`, `owner`, and `familyMembers`.
- Direct calls to `FMIPManager.devices`, including count-only calls, crashed Find My, so this probe intentionally avoids that accessor.
- Broad callback swizzling also crashed Find My, so this probe uses a retained `FMIPManager` plus Swift `Mirror` to inspect `dataManager` and its ivars in a bounded way.

Expected interpretation:

- If `data_manager_present` is false, the retained manager path is not enough and the next target should be finding the app-owned `FMIPManager`/`FMIPDataManager` instance.
- If `devices` or `crowdSourcedLocations` has non-zero counts and no crash, add a narrow serializer for those element types.
- If location-like child labels appear but no direct `CLLocation` is found, inspect the referenced child type next.
- If this route crashes, reduce the Swift mirror summary to manager child labels only before touching the `dataManager` value.

## FMIPDataManager ivar probe route result

The broad Swift `Mirror` value-summary route crashed Find My:

- Request started at `2026-07-10 01:10:06`.
- The Find My helper socket ended at `2026-07-10 01:10:11`.
- BlueBubbles marked Find My as force quit and relaunched it.
- A 90 second curl call returned HTTP `000` with no response body.

Interpretation:

- The crash happened around the delayed snapshot point, so the unsafe operation is likely Swift `Mirror` traversal of the retained manager's `dataManager` or one of the selected `FMIPDataManager` fields.
- This still keeps `FMIPDataManager` as the best lead because runtime metadata exposed the right ivars.
- The next probe should be metadata-only: retain/start `FMIPManager`, reach `dataManager` if possible, and report only class/ivar names before touching any `devices` or `crowdSourcedLocations` values.

## Metadata-only FMIPDataManager helper install

Installed helper checksum:

```text
ce071df9bd50a6521706770ed545316c
```

This keeps the same server-facing route:

```text
POST /api/v1/icloud/findmy/devices/debug/fmip-datamanager
```

Changes from the crashed build:

- Snapshot mode is now `objc_runtime_ivar_metadata_retained_fmip_manager_data_manager`.
- The helper no longer uses Swift `Mirror` to summarize `FMIPDataManager` values.
- The helper does not read `devices`, `crowdSourcedLocations`, or any other location-bearing value.
- The helper uses Objective-C runtime metadata to report manager/data-manager class names and ivar names.
- The only object value read is the retained manager's `dataManager` reference through `object_getIvar`.

Expected interpretation:

- If this returns, the retained manager's `dataManager` can be reached and the next step is one-field-at-a-time inspection.
- If it crashes, the retained manager path itself is unsafe after refresh and the next target should be an app-owned manager/data-manager object discovered through the Find My object graph.

## Metadata-only FMIPDataManager route result

The metadata-only route still crashed Find My:

- Request started at `2026-07-10 01:16:57`.
- The Find My helper socket ended at `2026-07-10 01:17:02`.
- BlueBubbles marked Find My as force quit and relaunched it.
- A 90 second curl call returned HTTP `000` with no response body.
- No matching Find My crash report was written to `~/Library/Logs/DiagnosticReports`.

Interpretation:

- Removing Swift `Mirror` value traversal did not make the retained-manager path safe.
- The crash now implicates either retained `FMIPManager` startup/refresh state or delayed `object_getIvar(manager, dataManager)` access.
- The next device-location lead should stop creating a separate `FMIPManager`; instead, inspect Find My's existing object graph for an app-owned `FMIPManager` or `FMIPDataManager` and only then add one-field-at-a-time value reads.

## App-owned FMIP candidate helper install

Installed helper checksum:

```text
d27c53b681b97f5e8de58f411c634874
```

Extended the existing provider-runtime route:

```text
POST /api/v1/icloud/findmy/devices/debug/provider-runtime
```

New diagnostic field:

```text
app_owned_fmip_candidates
```

Reasoning:

- The retained-manager path crashed even after removing Swift `Mirror` value traversal.
- The provider-runtime route has returned safely because it does not create a new `FMIPManager`, call `FMIPManager.devices`, or swizzle FMIPCore callbacks.
- The next lower-risk move is to use that existing route to look for an app-owned `FMIPManager`, `FMIPDataManager`, `dataManager`, `fmipManager`, `devicesProvider`, or `locationProvider` path in the Find My object graph.

Expected interpretation:

- If candidates appear, the next probe should follow the candidate path and inspect one object/field at a time.
- If no candidates appear, the existing root/session object graph is not deep or broad enough, and the next step should expand graph roots or inspect active Devices data-source ivars more directly.
