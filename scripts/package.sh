#!/usr/bin/env bash
# Builds dist/kitty-pomodoro.zip, ready to upload to the Chrome Web Store.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/kitty-pomodoro.zip
zip -r dist/kitty-pomodoro.zip manifest.json background.js offscreen.html offscreen.js \
  popup shared fonts icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png
echo "Created dist/kitty-pomodoro.zip"
