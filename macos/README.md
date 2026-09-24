# macOS app (native wrapper)

This folder contains a minimal native macOS app that loads the game in a
**WKWebView** — so it runs in its own window, offline, with the game files
bundled inside the app.

## What it is
- `Sources/SuperKid/main.swift` — SwiftUI + `WKWebView` wrapper.
- `build.sh` — compiles the app and assembles a double-clickable `.app`
  (bundling `index.html`, `css/`, `js/`, and `assets/` from the repo root).

## Requirements
- **Full Xcode** (not just Command Line Tools). Point the active developer
  directory at Xcode with:
  ```bash
  xcode-select -s /Applications/Xcode.app/Contents/Developer
  ```
  (this usually needs admin rights).

## Build
```bash
cd macos
bash build.sh
```
The app is written to:
```
macos/dist/Super Kid Saves the Planet.app
```
Drag it into `/Applications` (or anywhere) and double-click to play.

> The app is unsigned (personal use). On first launch, right-click → **Open**
> to bypass Gatekeeper, or sign it with your Apple Developer ID.
