# Water Buddy 2.0

A desktop avatar that asks you every hour whether you drank water.

- **YES**: the avatar celebrates and leaves (walking, tiptoeing or sinking out of sight).
- **Remind me later**: the avatar looks disappointed and keeps roaming your screen. Click it to answer, or it asks again after 10 minutes.
- **Menu bar icon 💧**: Ask me now, Arrive by… (pick scooter, car, train or jet), Presenting mode, Open avatar folder, Quit.

## 1. Run it

In Terminal, inside this folder:

```
npm install
npm run test-now
```

`test-now` shows the avatar right away. `npm start` runs it normally (first question after one hour). You need Node.js (check with `node -v`).

## 2. A mix of avatars

Every reminder picks a different avatar. Each avatar is a folder inside `avatars/`:

```
avatars/
  anand/    idle.png ask.png happy.png sad.png walk.png
  wife/     idle.png ask.png ...
  robot/    idle.png ...
```

| File | What it shows | Required |
|------|---------------|----------|
| `idle.png` | standing normally, fallback for any missing pose | yes |
| `ask.png` | holding the water bottle, asking | no |
| `happy.png` | after you press YES | no |
| `sad.png` | disappointed, while roaming | no |
| `walk.png` | walking | no |
| `sneak.png` | tiptoeing (falls back to `walk.png`) | no |
| `peek.png` | peeking from the screen edge (falls back to `idle.png`) | no |

Use transparent PNGs. To use only some avatars, set `"avatars": ["anand", "robot"]` in `config.json`. With no avatar folders yet, random emoji characters appear so you can test the behavior.

## 3. Sneaky actions

Set `"sneaky": false` in `config.json` for plain behavior.

- **Entrances (random):** tiptoe in from the side, peek from the screen edge and hide again before coming out, creep up next to your mouse cursor, pop up from the bottom, drop in from the top.
- **Exits (random):** walk away, tiptoe away, sink out of sight.
- **While disappointed:** wander, pause, peek from the edge, or sneak up beside your cursor and whisper "psst…".

## 4. It stays away while you share your screen

Four layers, so one failing does not break the rest:

1. **Hidden from capture:** the window is marked as protected content, so screen capture normally cannot see it. On newer macOS versions some capture methods may ignore this, so do not rely on it alone.
2. **Zoom:** detected through the `CptHost` process, which only runs while you share.
3. **Teams, Google Meet, others:** the app scans window titles for sharing banners (for example "is sharing your screen"). macOS asks for **Accessibility permission** the first time. Go to System Settings, Privacy & Security, Accessibility, and allow Electron (or Terminal if you start it from there). If the permission is missing, the menu bar shows a warning line.
4. **Manual presenting mode:** press **Cmd + Option + P** (or use the menu bar item) before you present. This always works.

While sharing, the avatar disappears within about 5 seconds and the menu bar icon shows 💧⏸. A reminder that fell due during sharing is shown 20 seconds after you stop sharing.

### Test it once before a real call

1. Run `npm run test-now`, then start a Zoom screen share. The avatar should vanish.
2. For Teams or Meet: start sharing, then run `npm run windows` in another Terminal tab. Look for the small sharing banner title, copy a unique part of it into `windowTitlePatterns` in `config.json`, and restart.

## 5. Settings (`config.json`)

| Setting | Meaning |
|---------|---------|
| `yourName` | name in the speech bubble |
| `avatars` | `"all"` or a list of folder names |
| `avatarHeight` | avatar size in pixels |
| `bottomMargin` | gap in pixels between the avatar's feet and the Dock |
| `vehicles` | rides she can arrive in, with how often each is picked, e.g. `{ "jet": 3, "scooter": 1, "car": 1, "train": 1 }` (a plain list works too) |
| `vehicleChance` | share of reminders that use a vehicle, from `0` to `1` |
| `spriteFacesRight` | set to `false` if your images face left |
| `sneaky` | turn the sneaky actions on or off |
| `intervalMinutes` | time between reminders |
| `snoozeMinutes` | re-ask time after "Remind me later" |
| `activeHours` | only ask between these hours, for example `[8, 23]` |
| `walkSpeed` | walking speed in pixels per second |
| `hotkey` | presenting-mode shortcut |
| `presenting.processNames` | extra process names that mean "sharing" (add more if needed) |
| `presenting.windowTitlePatterns` | window-title fragments that mean "sharing" |
| `presenting.resumeDelaySeconds` | wait after sharing ends before asking |

## 6. Start automatically at login

```
chmod +x install-autostart.sh
./install-autostart.sh
```

To stop auto-start later:

```
launchctl unload ~/Library/LaunchAgents/com.waterbuddy.app.plist
rm ~/Library/LaunchAgents/com.waterbuddy.app.plist
```
