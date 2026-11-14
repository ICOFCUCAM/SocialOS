#!/bin/sh
set -eu

: "${CLAMAV_DATABASE:=/tmp/socialos-clamav}"
export CLAMAV_DATABASE
mkdir -p "$CLAMAV_DATABASE"

# Fail closed: the worker must not start without a successfully downloaded
# malware signature database. Recreate/restart the service regularly to refresh.
freshclam --datadir="$CLAMAV_DATABASE" --stdout --verbose

test -s "$CLAMAV_DATABASE/main.cvd" -o -s "$CLAMAV_DATABASE/main.cld"
test -s "$CLAMAV_DATABASE/daily.cvd" -o -s "$CLAMAV_DATABASE/daily.cld"

exec node src/worker.mjs
