#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="Super Kid Saves the Planet"
BIN_NAME="SuperKid"

echo "==> Building Swift binary (release)…"
swift build -c release

APP="dist/${APP_NAME}.app"
rm -rf dist
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web"

cp ".build/release/$BIN_NAME" "$APP/Contents/MacOS/$BIN_NAME"
cp Info.plist "$APP/Contents/Info.plist"

echo "==> Bundling the web game…"
for item in index.html css js assets; do
  cp -R "../$item" "$APP/Contents/Resources/web/$item"
done

echo "==> Done: $APP"
