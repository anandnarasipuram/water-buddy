#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
ELECTRON="$DIR/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
PLIST="$HOME/Library/LaunchAgents/com.waterbuddy.app.plist"

if [ ! -f "$ELECTRON" ]; then
  echo "Electron not found. Run 'npm install' in $DIR first."
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.waterbuddy.app</string>
  <key>ProgramArguments</key>
  <array>
    <string>$ELECTRON</string>
    <string>$DIR</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Done. Water Buddy now starts automatically when you log in."
