# Find My SearchParty Debug API - 2026-07-06

## Route

Added authenticated debug-only routes:

```text
POST /api/v1/icloud/findmy/searchparty/debug
POST /api/v1/icloud/findmy/searchparty/beacons/start
POST /api/v1/icloud/findmy/searchparty/beacons
```

The routes send these private helper actions:

```text
debug-findmy-searchparty
debug-findmy-searchparty-beacons-start
debug-findmy-searchparty-beacons
```

This is intentionally separate from the Android-facing routes:

```text
POST /api/v1/icloud/findmy/friends/refresh
POST /api/v1/icloud/findmy/devices/refresh
POST /api/v1/icloud/findmy/items/refresh
```

## Beacon Probe Flow

The beacon probe is async because `SPOwnerSession allBeaconsWithCompletion:` returns through a completion block.

Call start first:

```bash
curl -X POST "http://127.0.0.1:1234/api/v1/icloud/findmy/searchparty/beacons/start?password=$BLUEBUBBLES_PASSWORD"
```

The start response returns fields such as:

```json
{
  "status": "started",
  "probe_id": "UUID",
  "session_id": "0x60000010c700",
  "captured_owner_session_count": 2
}
```

Then poll status:

```bash
curl -X POST "http://127.0.0.1:1234/api/v1/icloud/findmy/searchparty/beacons?password=$BLUEBUBBLES_PASSWORD"
```

When the completion fires, the poll response contains:

```json
{
  "status": "completed",
  "result_class": "__NSSetI",
  "beacon_count": 53,
  "serialized_count": 53
}
```

The important implementation detail is that the helper completion result is an `NSSet`, not an array. The helper converts it with `[(NSSet *)beaconsResult allObjects]` before serialization.

## Runtime Test

The rebuilt app was launched from:

```text
/Users/qayspoonawala/Documents/Codex/2026-06-13/use-the-local-blue-bubbles-installation/bluebubbles-server/packages/server/releases/mac/BlueBubbles.app
```

Private API helper pings were observed for:

- `com.apple.findmy`
- `com.apple.MobileSMS`

API checks returned:

- Friends refresh: HTTP 200, 8 records
- Devices refresh: HTTP 200, 13 records
- Items refresh: HTTP 200, 12 records
- SearchParty debug: HTTP 200, 2 captured `SPOwnerSession` objects
- SearchParty beacon start: HTTP 200, `status=started`
- SearchParty beacon poll: HTTP 200, `status=completed`
- SearchParty beacon result class: `__NSSetI`
- SearchParty beacon records: 53 returned, 53 serialized

No decode failure or transaction timeout was observed for the debug routes.

## SearchParty Debug Result

The debug route confirmed that live `SPOwnerSession` objects are captured, and that they expose the expected passive accessors. In this run the caches were not populated:

- `locationCache`: count 0
- `batteryStatusCache`: count 0
- `clientObservedBeacons`: count 0
- `locationSources`: count 0
- `allBeacons`: nil
- `allBeaconsCache`: nil

The synchronous caches are not enough for a full item/device source. The successful beacon data comes from `SPOwnerSession allBeaconsWithCompletion:`.

Example names observed in the async beacon set:

- `Qays’s Subaru Keys (apple)`
- `Belltown Court Keys (donut)`
- `Qays's Ridge Wallet`
- `Qays’s iPhone`
- `qhp-mbp-14-6`
- `Qays’s Toyota Keys (banana)`
- `Pink Wallet`
- `DJ's wallet (flower)`
- `Qays’s House Keys`
- `Qays's Purple MagSafe Wallet`

The current Android-facing Devices and Items results are still based on visible Find My UI table cells. The SearchParty beacon probe is debug-only until the `SPBeacon` fields are mapped into stable item/device response shapes.

## Packaging Note

Manual `asar pack packages/server dist/mac/BlueBubbles.app/Contents/Resources/app.asar` produced an app bundle that opened but did not start the HTTP server. Rebuilding with electron-builder restored a working app bundle:

```text
NODE_ENV=production ../../node_modules/.bin/webpack --config ./scripts/webpack.main.prod.config.js
NODE_ENV=production ../../node_modules/.bin/electron-builder build --mac --publish never --config ./scripts/electron-builder-config.js
```

If electron-builder fails during native rebuild with npm 11 `devEngines` parsing, and native modules are already available, this worked:

```text
NODE_ENV=production ../../node_modules/.bin/electron-builder build --mac --publish never --config ./scripts/electron-builder-config.js -c.npmRebuild=false
```

After building, the fresh Find My dylib was copied into the generated app resources and into `packages/server/appResources/private-api/macos11/`.
