# Windows Deployment Guide

## Files Needed to Run on Windows

### Option 1: Installer (Easiest)
- **File**: `dist/Attendance App Setup 0.1.0.exe`
- **Usage**: Double-click to install, then run from Start Menu

### Option 2: Portable (Unpacked Folder)
Copy the entire `dist/win-x64-unpacked/` folder. Required files:

```
win-x64-unpacked/
├── Attendance App.exe          # Main executable - REQUIRED
├── *.dll                        # All DLL files - REQUIRED
├── *.pak                        # Resource files - REQUIRED
├── *.dat                        # Data files - REQUIRED
├── *.bin                        # Binary files - REQUIRED
├── resources/                   # App resources - REQUIRED
│   ├── app.asar                 # Packaged app code
│   └── app.asar.unpacked/       # Unpacked resources
├── locales/                     # Language files - REQUIRED
└── LICENSE.electron.txt         # License file
```

**Minimum Required Files:**
- `Attendance App.exe`
- All `.dll` files in root
- `resources/` folder (entire folder)
- `locales/` folder (entire folder)
- `*.pak`, `*.dat`, `*.bin` files

## Building for Windows x64

To build for standard Windows x64 machines (most common):

```bash
npm run build          # Build Next.js app first
npm run dist           # Build Electron app
```

Or specify x64 target explicitly:

```bash
electron-builder --win --x64
```

This will create:
- `dist/Attendance App Setup 0.1.0.exe` (installer)
- `dist/win-x64-unpacked/` (portable version)

## Current Build Architecture

Your current build is `win-arm64` which is for:
- Windows on ARM devices (Surface Pro X, etc.)

For standard Windows PCs (Intel/AMD), you need `win-x64`.

## Running the Portable Version

1. Copy the entire `win-x64-unpacked` folder to Windows machine
2. Double-click `Attendance App.exe`
3. The app will start automatically

**Note**: The app needs Node.js installed on the target machine OR the Next.js server must be built into the Electron app. Currently, the app tries to start a Next.js server, so ensure Node.js is available.




