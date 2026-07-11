# Find My Friend and Device Status Fields

Date: 2026-07-11

This document tracks the status-like fields currently returned, observed, or likely mappable for Find My Friends and Devices. Friends and Devices come from different private-framework paths, so their available fields are not symmetrical.

## Friends

Friends are person/handle-oriented records from the Find Friends/FML path. They expose location/share state, not the underlying phone/watch/device hardware state.

| Field | API field | Source path | Current status | Notes |
| --- | --- | --- | --- | --- |
| Handle / identifier | `handle`, `findmy_handle.identifier` | `FMLHandle` | Returned | Stable contact/share identifier when available. |
| Coordinates | `coordinates` | `FMLLocation.latitude`, `FMLLocation.longitude` | Returned | Array format: `[latitude, longitude]`. |
| Long address | `long_address` | `FMLLocation.address` | Returned | String description of the resolved address. |
| Short address | `short_address` | `FMLLocation.coarseAddressLabel` | Returned | Also used as `subtitle`. |
| Subtitle | `subtitle` | `FMLLocation.coarseAddressLabel` | Returned | Usually a human-readable coarse label. |
| Title / labels | `title` | `FMLLocation.labels` | Returned | Can be an array from the framework; server normalizes some client-facing cases. |
| Last updated | `last_updated` | `FMLLocation.timestamp` | Returned | Server returns milliseconds. |
| Locating in progress | `is_locating_in_progress` | Helper synthesized | Returned | Currently emitted as false/0 by the helper serializer. |
| Location status | `status` | `FMLLocation.locationType` | Returned | Mapped as `legacy`, `live`, or `shallow`. |
| Location type | `location_type` | `FMLLocation.locationType` | Returned | Numeric raw type preserved for diagnostics/clients. |
| Horizontal accuracy | `horizontal_accuracy` | `FMLLocation.horizontalAccuracy` | Returned when selector exists | Numeric accuracy in meters. |
| Vertical accuracy | `vertical_accuracy` | `FMLLocation.verticalAccuracy` | Returned when selector exists | Numeric accuracy in meters. |
| Speed | `speed` | `FMLLocation.speed` | Returned when selector exists | May be null if unavailable. |
| Altitude | `altitude` | `FMLLocation.altitude` | Returned when selector exists | May be null if unavailable. |
| Friend object description | `friend` | FML friend object | Returned | Debug-ish description, not a structured public identity field. |

### Friend Fields Not Expected From This Path

| Field | Status | Reason |
| --- | --- | --- |
| Battery level | Not expected | Friend records represent a person/handle, not a specific device. |
| Battery status | Not expected | Same reason as battery level. |
| OS/system version | Not expected | Not exposed by the current Find Friends/FML location path. |
| Device model | Not expected | The friend location source does not identify the underlying device model. |
| Device class | Not expected | Same reason as device model. |
| Device connected state | Not expected | This is an FMIP device concept, not an FML friend-location concept. |

## Devices

Devices are hardware-oriented records from the Find My/FmipCore path. The current working traversal is:

`FMDevicesListDataSource -> mediator -> devicesProvider -> fmipManager -> dataManager -> devices`

The location-bearing path for a device is:

`FMIPDevice.location -> FMIPLocation.location -> CLLocation`

| Field | API/internal field | Source path | Current status | Notes |
| --- | --- | --- | --- | --- |
| Opaque device identifier | `id`, `identifier` | `FMIPDevice.identifier` | Returned | Long opaque string used as the server/API identifier. |
| Device name | `name` | `FMIPDevice.name` | Returned | User/device name. |
| Display name | `deviceDisplayName`, `modelDisplayName` | `FMIPDevice.displayName` | Returned | Human-readable product/display string. |
| Model | `deviceModel`, `rawDeviceModel` | `FMIPDevice.model`, `FMIPDevice.rawDeviceModel` | Returned | Currently maps model/raw model into the API shape. |
| Device class/category | `deviceClass` | `FMIPDevice.category` | Returned | Examples include MacBookPro, iMac, iPhone, Watch, iPad. |
| Is Mac | `isMac` | Derived from category/model | Returned | Server-derived boolean. |
| Battery level | `batteryLevel` | `FMIPDevice.batteryLevel` | Returned | Numeric level when available. Some devices report 0. |
| Battery status | `batteryStatus` | `FMIPDevice.batteryStatus` | Partially mapped | Internal enum is observed; current API mapping is conservative and often `Unknown`. |
| Location capable | `locationCapable` | Server-derived | Returned | Currently true for FMIP device records. |
| Location enabled | `locationEnabled` | Server-derived from location presence | Returned | True when a current location object is present. |
| Location coordinates | `location.latitude`, `location.longitude` | `FMIPDevice.location.location.coordinate` | Returned when present | Real `CLLocation` coordinates. Offline/locationless devices remain in the list without location. |
| Location timestamp | `location.timeStamp` | `CLLocation.timestamp` | Returned when present | Server returns milliseconds. |
| Horizontal accuracy | `location.horizontalAccuracy` | `CLLocation.horizontalAccuracy` | Returned when present | Numeric accuracy in meters. |
| Vertical accuracy | `location.verticalAccuracy` | `CLLocation.verticalAccuracy` | Returned when present | Numeric accuracy in meters. |
| Floor level | `location.floorLevel` | `FMIPLocation.floor` | Returned when present | Numeric floor value from FMIPLocation. |
| Is inaccurate | `location.isInaccurate` | `FMIPLocation.isInaccurate` | Returned when present | Boolean. |
| Is old | `location.isOld` | `FMIPLocation.isOld` | Returned when present | Boolean indicating stale location state. |
| Location finished | `location.locationFinished` | `FMIPLocation.isLocationFinished` | Returned when present | Boolean completion state. |
| Address label | `address.label` | `FMIPDevice.address.label` | Returned when present | Human-readable address label. |
| Formatted address | `address.mapItemFullAddress`, `address.formattedAddressLines` | `FMIPDevice.address.mapItemFormattedAddress` and related fields | Returned when present | Server maps the best formatted address into the existing address shape. |
| Locality | `address.locality` | `FMIPDevice.address.locality` | Returned when present | City/locality. |
| Administrative area | `address.administrativeArea` | `FMIPDevice.address.administrativeArea` | Returned when present | State/region. |
| Country code | `address.countryCode` | `FMIPDevice.address.countryCode` | Returned when present | ISO-like country code from Find My address object. |
| Discovery identifier | `deviceDiscoveryId` | `FMIPDevice.discoveryIdentifier` | Returned when present | UUID-like discovery identifier. |
| BA identifier | `baUuid` | `FMIPDevice.baIdentifier` | Returned when present | UUID-like identifier when present. |
| Crowd-sourced location | `crowdSourcedLocation` | `FMIPDevice.crowdSourcedLocation` | Returned when present; falls back to `location` | Current server maps direct crowd-sourced location if present, otherwise uses current location. |
| Safe locations | `safeLocations` | `FMIPDevice.safeLocations` | Placeholder returned | Current API returns an empty array; helper diagnostics can count internal safe locations. |
| Features | `features` | Existing API shape | Placeholder returned | Current API returns `{}` for FMIP-derived devices. |

## Device Fields Observed Internally But Not Fully API-Mapped Yet

| Field | Internal field | Observed format | Mapping status | Notes |
| --- | --- | --- | --- | --- |
| System version | `FMIPDevice.systemVersion` | String | Not mapped yet | Useful next API addition. |
| Connected state | `FMIPDevice.deviceConnectedState` | `FMIPCore.FMIPDeviceConnectedStateType` enum | Not mapped yet | Needs enum string/value extraction. |
| Beacon type | `FMIPDevice.beaconType` | `FMIPCore.FMIPBeaconType` enum | Not mapped yet | Useful for distinguishing device/beacon classes. |
| Raw battery enum | `FMIPDevice.batteryStatus` | `FMIPCore.FMIPBatteryStatus` enum | Partially mapped | Needs better enum rendering instead of `Unknown`. |
| Historical locations presence | `FMIPDevice.historicalLocations` | Optional array | Diagnostic only | Current helper tracks presence/count, not returned by Android-facing API. |
| Safe locations count | `FMIPDevice.safeLocations` | Array count | Diagnostic only | Could become API-facing later if useful. |
| Crowd-sourced location presence | `FMIPDevice.crowdSourcedLocation` | Optional `FMIPLocation` | Partially mapped | Direct value is mapped if present. Presence flag is not separately returned. |
| Device connected with beacon | `FMIPDevice.deviceConnectedWithBeacon` | Internal field | Not mapped yet | Observed as a candidate status field in the device child labels. |
| Can enable lost mode | `FMIPDevice.canEnableLostMode` | Internal field | Not mapped yet | Existing `FindMyDevice` type has lost-mode-related fields, but FMIP mapping does not fill them yet. |
| Can wipe after lock | `FMIPDevice.canWipeAfterLock` | Internal field | Not mapped yet | Existing `FindMyDevice` type has `canWipeAfterLock`. |
| Dark wake support | `FMIPDevice.canSupportDarkWake` | Internal field | Not mapped yet | Existing `FindMyDevice` type has `darkWake`. |
| Audio channels | `FMIPDevice.audioChannels` | Internal field | Not mapped yet | Existing `FindMyDevice` type supports `audioChannels`. |
| Color | `FMIPDevice.color` | Internal field | Not mapped yet | Existing `FindMyDevice` type supports `deviceColor`. |

## Practical Next Mapping Targets

| Priority | Field | Why |
| --- | --- | --- |
| 1 | `systemVersion` | Easy scalar and useful for device inventory. |
| 2 | Better `batteryStatus` | Already exposed internally; needs enum conversion. |
| 3 | `deviceConnectedState` | Useful status signal for online/nearby/connected-style display. |
| 4 | `beaconType` | Helps classify device/beacon-backed records. |
| 5 | Separate `crowdSourcedLocationPresent` / `historicalLocationsCount` / `safeLocationsCount` | Useful diagnostics without expanding payload size much. |
