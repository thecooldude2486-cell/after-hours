#!/bin/bash
cd -- "$(dirname "$0")"
printf '\nAFTER HOURS — open http://127.0.0.1:4173 in a desktop browser.\nKeep this terminal open while playing.\n\n'
if command -v node >/dev/null 2>&1; then
  node server.mjs
else
  python3 -m http.server 4173 --bind 127.0.0.1
fi
