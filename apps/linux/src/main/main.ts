import { app, BrowserWindow, globalShortcut, session } from "electron";
import path from "node:path";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { setupIpcHandlers } from "./ipc-handlers.js";
import { setupTray } from "./tray.js";
import { setupMenu } from "./menu.js";

// Auto-detect display server (X11 or Wayland)
app.commandLine.appendSwitch("ozone-platform-hint", "auto");

// PipeWire mic capture (Arch/Fedora use PipeWire by default)
app.commandLine.appendSwitch("enable-features", "WebRTCPipeWireCapturer");

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let localServerUrl: string | null = null;

// Serve renderer files from a local HTTP server so the origin is
// http://localhost:PORT instead of file:// (gateway rejects file:// origins).
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

async function startLocalServer(): Promise<string> {
  const rendererDir = path.join(__dirname, "../renderer");
  const server = createServer(async (req, res) => {
    let filePath = path.join(rendererDir, req.url === "/" ? "index.html" : req.url ?? "index.html");
    // Prevent path traversal
    if (!filePath.startsWith(rendererDir)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const ext = path.extname(filePath);
    const mime = MIME[ext] ?? "application/octet-stream";
    try {
      const data = await readFile(filePath);
      res.writeHead(200, { "Content-Type": mime });
      res.end(data);
    } catch {
      // SPA fallback — serve index.html for unknown routes
      try {
        const index = await readFile(path.join(rendererDir, "index.html"));
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(index);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    }
  });

  return new Promise((resolve) => {
    // Fixed port so gateway allowedOrigins can whitelist http://127.0.0.1:5199
    server.listen(5199, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const url = `http://127.0.0.1:${port}`;
      resolve(url);
    });
  });
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 480,
    minHeight: 500,
    frame: true,
    title: "OpenClaw",
    icon: path.join(__dirname, "../../assets/icon.png"),
    backgroundColor: "#0a0a0f",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      sandbox: true,
      contextIsolation: true,
    },
  });

  // Load the renderer — prefer dev server URL, then local HTTP server, then file://
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else if (localServerUrl) {
    win.loadURL(localServerUrl);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Hide instead of close
  win.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  return win;
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {mainWindow.restore();}
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Only grant microphone, not camera/screen
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
      const mediaTypes = "mediaTypes" in details ? (details.mediaTypes as string[] | undefined) : undefined;
      callback(permission === "media" && mediaTypes?.includes("audio") === true);
    });

    // Allow Electron's internal permission checks for media
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
      return permission === "media";
    });

    // Accept self-signed certs only for loopback and the configured gateway host
    session.defaultSession.setCertificateVerifyProc((request, callback) => {
      const hostname = request.hostname;
      const isLocal = hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost";
      let isGateway = false;
      try {
        const gwUrl = process.env.OPENCLAW_GATEWAY_URL;
        if (gwUrl) {isGateway = new URL(gwUrl).hostname === hostname;}
      } catch { /* invalid URL, ignore */ }
      callback(isLocal || isGateway ? 0 : -2);
    });

    setupIpcHandlers();

    // Start local HTTP server for production builds (avoids file:// origin)
    if (!process.env.ELECTRON_RENDERER_URL) {
      localServerUrl = await startLocalServer();
    }

    mainWindow = createWindow();
    setupMenu(mainWindow);
    setupTray(mainWindow);

    // Global shortcut to toggle window
    globalShortcut.register("Super+Shift+O", () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow?.show();
        mainWindow?.focus();
      }
    });
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });

  app.on("window-all-closed", () => {
    // Keep running in tray on Linux
  });
}
