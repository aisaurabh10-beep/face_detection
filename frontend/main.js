const { app, BrowserWindow, globalShortcut } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let nextProcess;

function startNextServer() {
  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

  nextProcess = spawn(
    npxCmd,
    ["next", "start", "-p", "3015"],
    {
      cwd: __dirname,
      stdio: "inherit",
      shell: true
    }
  );
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      devTools: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadURL("http://localhost:3015");

  // Disable inspect & shortcuts
  win.webContents.on("context-menu", e => e.preventDefault());
  globalShortcut.register("CommandOrControl+Shift+I", () => {});
  globalShortcut.register("CommandOrControl+Shift+C", () => {});
  globalShortcut.register("F12", () => {});
}

app.whenReady().then(() => {
  startNextServer();
  setTimeout(createWindow, 3000);
});

app.on("window-all-closed", () => {
  if (nextProcess) nextProcess.kill();
  if (process.platform !== "darwin") app.quit();
});
