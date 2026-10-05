const { app, BrowserWindow, Tray, Menu, screen, ipcMain, shell, nativeImage, globalShortcut } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const POSES = ['idle', 'ask', 'happy', 'sad', 'walk', 'sneak', 'peek'];
const EXTENSIONS = ['png', 'webp', 'gif', 'jpg', 'jpeg'];
const PLACEHOLDERS = ['🧍', '🦊', '🐧', '🤖', '🐸'];
const ACTIVE_STATES = ['asking', 'entering', 'roaming', 'disappointed'];

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const presenting = config.presenting;

let win = null;
let tray = null;
let timer = null;
let pending = false;
let deferred = false;
let manualPresenting = false;
let autoSharing = false;
let windowScanBlocked = false;
let rendererState = 'hidden';
let lastAvatar = null;

const isSharing = () => manualPresenting || autoSharing;
const pick = (list) => list[Math.floor(Math.random() * list.length)];

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function loadPoses(name) {
  const poses = {};
  const dir = path.join(__dirname, 'avatars', name);
  for (const pose of POSES) {
    for (const ext of EXTENSIONS) {
      const file = path.join(dir, `${pose}.${ext}`);
      if (fs.existsSync(file)) {
        poses[pose] = pathToFileURL(file).href;
        break;
      }
    }
  }
  return poses;
}

function listAvatars() {
  const root = path.join(__dirname, 'avatars');
  if (!fs.existsSync(root)) return [];
  let names = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  if (Array.isArray(config.avatars)) {
    names = names.filter((name) => config.avatars.includes(name));
  }
  return names.filter((name) => Object.keys(loadPoses(name)).length > 0);
}

function pickAvatar() {
  const names = listAvatars();
  if (names.length === 0) return { name: null, poses: {} };
  const pool = names.length > 1 ? names.filter((name) => name !== lastAvatar) : names;
  const name = pick(pool);
  lastAvatar = name;
  return { name, poses: loadPoses(name) };
}

function createWindow() {
  // workArea excludes the menu bar and Dock, so the avatar stands just above the Dock.
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setContentProtection(Boolean(presenting.contentProtection));
  win.loadFile('index.html');
}

function fitWindow() {
  if (win && !win.isDestroyed()) win.setBounds(screen.getPrimaryDisplay().workArea);
}

function isActiveHour() {
  const [start, end] = config.activeHours;
  const hour = new Date().getHours();
  return hour >= start && hour < end;
}

// vehicle: force an arrival by that vehicle (from the "Arrive by" menu), even if the avatar is on screen.
function askNow(vehicle) {
  if (isSharing()) {
    deferred = true;
    return;
  }
  if (!win || win.isDestroyed()) return;
  const avatar = pickAvatar();
  win.webContents.send('ask', { ...avatar, placeholder: pick(PLACEHOLDERS), vehicle });
}

function vehicleList() {
  const v = config.vehicles;
  return Array.isArray(v) ? v : Object.keys(v || {});
}

function fire() {
  if (!isActiveHour() && !pending) {
    scheduleNext(config.intervalMinutes);
    return;
  }
  askNow();
}

function scheduleNext(minutes) {
  clearTimeout(timer);
  timer = setTimeout(fire, minutes * 60 * 1000);
}

function run(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 4000 }, (error, stdout) => {
      resolve({ error, out: String(stdout || '') });
    });
  });
}

async function detectSharing() {
  for (const name of presenting.processNames) {
    const { error } = await run('pgrep', ['-x', name]);
    if (!error) return true;
  }
  if (presenting.scanWindowTitles) {
    const script = 'tell application "System Events" to get name of every window of every application process';
    const { error, out } = await run('osascript', ['-e', script]);
    if (error) {
      if (!windowScanBlocked) {
        windowScanBlocked = true;
        updateTray();
      }
    } else {
      if (windowScanBlocked) {
        windowScanBlocked = false;
        updateTray();
      }
      const text = out.toLowerCase();
      if (presenting.windowTitlePatterns.some((pattern) => text.includes(pattern.toLowerCase()))) {
        return true;
      }
    }
  }
  return false;
}

function onSharingChanged(sharing) {
  updateTray();
  if (!win || win.isDestroyed()) return;
  if (sharing) {
    if (ACTIVE_STATES.includes(rendererState)) deferred = true;
    win.webContents.send('suppress');
    win.hide();
  } else {
    win.showInactive();
    if (deferred) {
      deferred = false;
      setTimeout(() => {
        if (isSharing()) deferred = true;
        else askNow();
      }, presenting.resumeDelaySeconds * 1000);
    }
  }
}

async function checkSharing() {
  const before = isSharing();
  autoSharing = await detectSharing();
  const now = isSharing();
  if (now !== before) onSharingChanged(now);
  setTimeout(checkSharing, presenting.checkEverySeconds * 1000);
}

function setManualPresenting(value) {
  const before = isSharing();
  manualPresenting = value;
  const now = isSharing();
  if (now !== before) onSharingChanged(now);
  else updateTray();
}

function updateTray() {
  if (!tray) return;
  tray.setTitle(isSharing() ? '💧⏸' : '💧');
  const items = [
    { label: 'Ask me now', click: () => askNow() },
    {
      label: 'Arrive by…',
      enabled: vehicleList().length > 0,
      submenu: vehicleList().map((name) => ({
        label: name.charAt(0).toUpperCase() + name.slice(1),
        click: () => askNow(name)
      }))
    },
    {
      label: `Presenting mode (${config.hotkey})`,
      type: 'checkbox',
      checked: manualPresenting,
      click: () => setManualPresenting(!manualPresenting)
    },
    { label: autoSharing ? 'Screen share detected: avatar hidden' : 'No screen share detected', enabled: false }
  ];
  if (windowScanBlocked) {
    items.push({ label: 'Window scan needs Accessibility permission', enabled: false });
  }
  items.push(
    { type: 'separator' },
    { label: 'Open avatar folder', click: () => shell.openPath(path.join(__dirname, 'avatars')) },
    { label: 'Quit', click: () => app.quit() }
  );
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

ipcMain.handle('get-setup', () => ({ config }));

ipcMain.on('set-interactive', (_event, interactive) => {
  if (!win || win.isDestroyed()) return;
  if (interactive) win.setIgnoreMouseEvents(false);
  else win.setIgnoreMouseEvents(true, { forward: true });
});

ipcMain.on('renderer-state', (_event, state) => {
  rendererState = state;
});

ipcMain.on('answer', (_event, choice) => {
  if (choice === 'yes') {
    pending = false;
    scheduleNext(config.intervalMinutes);
  } else {
    pending = true;
    scheduleNext(config.snoozeMinutes);
  }
});

app.whenReady().then(async () => {
  if (app.dock) app.dock.hide();
  createWindow();
  screen.on('display-metrics-changed', fitWindow);
  screen.on('display-added', fitWindow);
  screen.on('display-removed', fitWindow);
  tray = new Tray(nativeImage.createEmpty());
  updateTray();

  globalShortcut.register(config.hotkey, () => setManualPresenting(!manualPresenting));

  autoSharing = await detectSharing();
  if (!isSharing()) win.showInactive();
  updateTray();
  setTimeout(checkSharing, presenting.checkEverySeconds * 1000);

  scheduleNext(config.intervalMinutes);
  if (process.argv.includes('--now')) {
    win.webContents.once('did-finish-load', () => setTimeout(askNow, 1200));
  }
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {});
