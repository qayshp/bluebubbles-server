#!/bin/bash
set -euo pipefail
APP="$HOME/Applications/BlueBubbles-Custom.app"
# Verify the configured user-local executable, rather than another user's instance.
if ! /bin/ps -U "$(id -u)" -o comm= | /usr/bin/grep -Fqx "$APP/Contents/MacOS/BlueBubbles"; then
    /usr/bin/open -n "$APP" --args --disable-gpu --relaunch
fi
ready=0
for attempt in {1..60}; do
    if /usr/bin/curl -fsS --max-time 2 http://127.0.0.1:1234/ -o /dev/null; then ready=1; break; fi
    sleep 1
done
if [ "$ready" != 1 ]; then echo 'Custom Server did not become ready' >&2; exit 1; fi
/usr/bin/launchctl kickstart -k "gui/$(id -u)/com.beeper.bbctl.sh-imessage"
echo 'Custom Server ready; bridge catch-up started'
