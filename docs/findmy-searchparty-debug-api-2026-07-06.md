# Find My SearchParty Debug API - 2026-07-06

## Route

Added an authenticated debug-only route:

```text
POST /api/v1/icloud/findmy/searchparty/debug
```

The route sends the private helper action:

```text
debug-findmy-searchparty
```

This is intentionally separate from the Android-facing routes:

```text
POST /api/v1/icloud/findmy/friends/refresh
POST /api/v1/icloud/findmy/devices/refresh
POST /api/v1/icloud/findmy/items/refresh
```

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

No decode failure or transaction timeout was observed for the debug route.

## SearchParty Debug Result

The debug route confirmed that live `SPOwnerSession` objects are captured, and that they expose the expected passive accessors. In this run the caches were not populated:

- `locationCache`: count 0
- `batteryStatusCache`: count 0
- `clientObservedBeacons`: count 0
- `locationSources`: count 0
- `allBeacons`: nil
- `allBeaconsCache`: nil

This means the current Android-facing Devices and Items results are still based on visible Find My UI table cells, not a populated SearchParty cache.

## Packaging Note

Manual `asar pack packages/server dist/mac/BlueBubbles.app/Contents/Resources/app.asar` produced an app bundle that opened but did not start the HTTP server. Rebuilding with electron-builder restored a working app bundle:

```text
NODE_ENV=production ../../node_modules/.bin/webpack --config ./scripts/webpack.main.prod.config.js
NODE_ENV=production ../../node_modules/.bin/electron-builder build --mac --publish never --config ./scripts/electron-builder-config.js
```

After building, the fresh Find My dylib was copied into the generated app resources and into `packages/server/appResources/private-api/macos11/`.
