# Signature Verification

The `<Type>Helper.md5` files within each macOS directory contain a single string that is the Bundle's MD5 hash, per the build type. The hash is a hash of all the file MD5s within the bundle, in the case of the bundle. You can verify the Bundle by running the following command in your macOS terminal. Replacing `/path/to/private/api/folder` with the path to the parent directory of `BlueBubblesHelper.bundle`:

`md5 /path/to/private/api/folder/BlueBubblesHelper.dylib`

**GitHub Release Reference**: https://github.com/BlueBubblesApp/BlueBubbles-Server-Helper/releases

You can also check the current versions of these bundles by opening the `version.txt` file.

## Find My helper artifact

`BlueBubblesFindMyHelper.dylib` is built from the companion
`bluebubbles-helper` Find My target. The server enables it on macOS 15 or later
only when both Private API and **Open FindMy App on Startup** are enabled.
Older supported macOS releases continue to route Friends requests through the
Messages helper when that private API is available.

On macOS 15 or later, the Devices GET route reads the server's latest helper
snapshot without changing the Find My view. The explicit Devices refresh route
requires the dedicated helper to be ready before opening `findmy://devices`
and reading the app-owned FMIP device collection. It does not use Accessibility
clicks, keyboard events, visible-cell scraping, or fixed view-loading delays.

The dedicated Friends helper returns `locations`, boolean `partial` and
`friendListTimedOut` fields, a `timedOutHandles` string array, and a nonnegative
integer `skippedFriends` count. A complete snapshot (`partial: false`) must
report no timeouts or skipped friends. A partial snapshot may conservatively
retain previously cached friends even when no individual timeout is listed.
The Server validates completion metadata, identifiable records, and duplicate
handles before changing the cache. A valid complete empty snapshot clears it;
valid partial snapshots merge without replacing newer cached locations. Older
Messages helpers retain support for responses without completion metadata.

Friends and Devices GET routes retain their cache while the required helper
is unavailable. Refresh routes return HTTP 503 for unavailable readiness;
malformed fresh responses fail and retain the cache. Empty Friends and Devices
caches initialize independently after an accepted helper registration.

The artifact checksum must match its `.md5` file, it must contain `x86_64` and
`arm64` slices, and it must use `@rpath/BlueBubblesFindMyHelper.dylib` as its
install name. Every server build checks this contract through:

```sh
npm run verify:findmy-helper
```

Automation permission requests for Find My and System Events happen only when
the Find My integration is started or its Accessibility fallback is explicitly
used. Normal server startup does not prompt for unrelated Automation access.

Friends HTTP and socket payloads serialize `is_locating_in_progress` as a JSON
boolean, matching the released clients. Native helper `0`/`1` flags are
normalized at the Server boundary.

## Find My release smoke test

TCC Automation grants are tied to the signed application identity. Before a
release, test a normally signed package on a user account without an existing
BlueBubbles Automation grant:

1. Enable Private API and **Open FindMy App on Startup**.
2. Confirm macOS requests Find My and System Events Automation access for
   BlueBubbles.
3. Confirm the helper registers as `com.apple.findmy` and Find My can be hidden.
4. Call the Friends GET, refresh, and GET routes and verify that all three
   succeed without helper, framing, transaction, or permission errors.
5. Call the Devices GET, refresh, and GET routes. Confirm the first GET does not
   switch Find My views and the refreshed response includes both online and
   offline devices without converting missing locations to `(0, 0)`.
