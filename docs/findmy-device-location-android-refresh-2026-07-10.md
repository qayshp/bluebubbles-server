# Find My Device Location Android Refresh Path

Date: 2026-07-10

## Summary

Devices now use the app-owned `FMIPDataManager.devices` path on macOS Sequoia/private-API mode instead of the older `refresh-findmy-devices` helper action.

The older refresh route timed out and caused Find My to be force-quit/restarted. The replacement path uses the compact helper action:

`debug-findmy-devices-datamanager-devices`

That helper action walks:

`FMDevicesListDataSource -> mediator -> devicesProvider -> fmipManager -> dataManager -> devices`

Then the server transforms each compact `FMIPDevice` record into the existing `FindMyDevice` API shape.

## Server API changes

Added private API method:

`PrivateApiFindMy.debugDevicesDataManagerDevices()`

Added debug HTTP route:

`POST /api/v1/icloud/findmy/devices/debug/datamanager-devices`

Changed Sequoia private-API device refresh:

`POST /api/v1/icloud/findmy/devices/refresh`

This route now calls `debugDevicesDataManagerDevices()` and maps the compact FMIP records to `FindMyDevice` objects.

Changed Sequoia private-API device read:

`GET /api/v1/icloud/findmy/devices`

When private API is enabled on Sequoia, this route now delegates to the same refresh path so Android clients polling the non-refresh route also receive device records.

## Transformed fields

The server currently maps these FMIP compact fields into `FindMyDevice`:

- `identifier` -> `id` and `identifier`
- `name` -> `name`
- `displayName` -> `deviceDisplayName` and `modelDisplayName`
- `model` or `rawDeviceModel` -> `deviceModel` and `rawDeviceModel`
- `category` -> `deviceClass`
- `batteryLevel` -> `batteryLevel`
- `address` -> `address`
- `location.location` -> `location`
- `crowdSourcedLocation.location` -> `crowdSourcedLocation`
- `discoveryIdentifier` -> `deviceDiscoveryId`
- `baIdentifier` -> `baUuid`

The `location` object uses the existing BlueBubbles shape:

```json
{
  "latitude": 0,
  "longitude": 0,
  "horizontalAccuracy": 35,
  "verticalAccuracy": 0,
  "timeStamp": 1783706016000,
  "floorLevel": 0,
  "isInaccurate": false,
  "isOld": false,
  "locationFinished": false
}
```

Coordinates are zeroed in this document intentionally; runtime responses contain the actual `CLLocation` coordinate values from Find My.

## Test evidence

Tested locally against the running dev server on 2026-07-10.

Debug route:

`POST /api/v1/icloud/findmy/devices/debug/datamanager-devices`

Result:

- HTTP 200
- About 5.7 seconds
- 37 device records returned
- 12 records had non-null `location`

Android-facing refresh route:

`POST /api/v1/icloud/findmy/devices/refresh`

Result:

- HTTP 200
- About 8.5 seconds
- 37 `FindMyDevice` records returned
- 12 records had non-null `location`

Android-facing read route:

`GET /api/v1/icloud/findmy/devices`

Result:

- HTTP 200
- About 5.9 seconds
- 37 `FindMyDevice` records returned
- 12 records had non-null `location`

Server log evidence after the change:

```text
Find My device refresh via FMIPDataManager: devices=37 withLocation=12
Request to /api/v1/icloud/findmy/devices/refresh took 8455 ms
Find My device refresh via FMIPDataManager: devices=37 withLocation=12
Request to /api/v1/icloud/findmy/devices took 5933 ms
```

No helper JSON decode error or Find My dylib crash was observed for the new compact route.

## Remaining notes

- Offline devices still appear, but with `location: null` or absent.
- Items remain blocked by the local Search Party/item-location issue on this Mac.
- The route still opens/selects the Find My Devices view through the existing URL-scheme path before querying the helper.
