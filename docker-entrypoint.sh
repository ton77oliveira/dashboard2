#!/bin/sh
set -e

node /app/backend/src/server.js &
api_pid="$!"

trap 'kill "$api_pid" 2>/dev/null || true; exit 0' INT TERM

nginx -g 'daemon off;'
