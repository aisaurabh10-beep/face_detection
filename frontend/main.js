const { app, BrowserWindow, globalShortcut, protocol } = require("electron");
const path = require("path");
const url = require("url");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      // It is highly recommended to use a preload script for security, 
      // but keeping your current config for compatibility.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"), // Optional: if you add one later
    }
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    // Development: Load from the local Next.js dev server
    win.loadURL("http://localhost:3015");
  } else {
    // Production: Load the static index.html from the 'out' folder
    // Using win.loadFile ensures local paths work correctly in the EXE
    win.loadFile(path.join(__dirname, "out", "index.html"));
    
    // IMPORTANT: If you use Next.js dynamic routes (e.g., /student/[id]),
    // reloading the page might show a blank screen. 
    // This listener handles "Page Not Found" by redirecting back to index.html
    // so the Next.js client-side router can take over.
    win.webContents.on('did-fail-load', () => {
      win.loadFile(path.join(__dirname, "out", "index.html"));
    });
  }

  // Disable Developer Tools & Inspection for production
  win.webContents.on("context-menu", e => e.preventDefault());
  
  app.on('browser-window-focus', () => {
    globalShortcut.register("CommandOrControl+Shift+I", () => {});
    globalShortcut.register("CommandOrControl+Shift+C", () => {});
    globalShortcut.register("F12", () => {});
  });

  app.on('browser-window-blur', () => {
    globalShortcut.unregisterAll();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});