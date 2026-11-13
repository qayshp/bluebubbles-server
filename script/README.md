# Custom Server operations

The custom app lives at `~/Applications/BlueBubbles-Custom.app`; the shared `/Applications/BlueBubbles.app` may belong to another logged-in user.

- `./script/build_and_run.sh --verify` runs custom regressions, rebuilds UI/server, packages, snapshots the previous app and database, installs, launches and reports health. It keeps the existing app running until packaging succeeds. Dependencies must first be installed using the project Node 20 toolchain and `electron-builder install-app-deps` from `packages/server`.
- `./script/build_and_run.sh --build-only` prepares a package. `--install-only` installs that validated package without repeating the build. `--logs`, `--telemetry` and `--debug` support investigation.
- `./script/health.py --strict` compares seven days of source message/reaction GUIDs with a checked bridge snapshot, reports HTTP/helper/bridge health and returns nonzero on gaps or unavailable helpers. `--days N` chooses 1–90 days. It prints no credentials, handles, GUIDs or message content. One persistent bridge socket is normal while idle; a second HTTP connection appears during queries.
- `./script/diagnose_findmy.py` reports whether the current user's Find My requires library validation and has mapped the custom library. A connected helper with zero friends differs from a library that never connected. POST refresh now reports the latter as an error; GET cached data remains available.
- `./script/install_startup.py`, invoked while the Server is stopped, installs `com.bluebubbles.server` for user login and `local.bluebubbles.custom-health` for a five-minute report. The launcher opens the custom app only if absent, waits for HTTP readiness, then restarts only `com.beeper.bbctl.sh-imessage` for catch-up. The app's `launch-agent` setting corresponds to that service.

Local packages include `custom-build.json` identifying source commit and server hash. Official release checks remain available, but these marked packages cannot automatically replace themselves with an official build. Update through this build workflow to preserve local fixes.


Find My uses a separate helper on macOS 15 and later. Its requested startup preference is distinct from runtime readiness: fresh operations require that helper to register with the Server. An initialization timeout reports Find My as unavailable; Messages and FaceTime availability are independent. Cached GET results remain available. Use the Find My status and targeted retry controls to recheck after system configuration changes.

The requirements panel reports diagnostic observations rather than treating a single SIP status or saved preference as proof of capability. Patched systems can enforce security differently; successful registration is required before enabling fresh Find My operations.

System security configuration belongs to macOS or its boot manager, such as OpenCore Legacy Patcher. BlueBubbles does not configure OCLP, edit EFI, change SIP or library-validation settings, or reboot the Mac. The [Private API setup guide](https://docs.bluebubbles.app/private-api/installation) describes external setup requirements; diagnose and configure those outside the Server.
