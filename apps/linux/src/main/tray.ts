import { Tray, Menu, app, nativeImage, type BrowserWindow } from "electron";
import path from "node:path";

let tray: Tray | null = null;

function showAndNavigate(mainWindow: BrowserWindow, view: string): void {
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("menu:navigate", { view });
}

export function setupTray(mainWindow: BrowserWindow): void {
  const iconPath = path.join(__dirname, "../../assets/icon.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });

  tray = new Tray(icon);
  tray.setToolTip("OpenClaw");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show / Hide",
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "New Session",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send("menu:new-session");
      },
    },
    {
      label: "Chat",
      click: () => showAndNavigate(mainWindow, "chat"),
    },
    {
      label: "Dashboard",
      click: () => showAndNavigate(mainWindow, "board"),
    },
    { type: "separator" },
    {
      label: "Sessions",
      click: () => showAndNavigate(mainWindow, "sessions"),
    },
    {
      label: "Agents",
      click: () => showAndNavigate(mainWindow, "agents"),
    },
    {
      label: "Channels",
      click: () => showAndNavigate(mainWindow, "channels"),
    },
    {
      label: "Logs",
      click: () => showAndNavigate(mainWindow, "logs"),
    },
    { type: "separator" },
    {
      label: "Settings",
      click: () => showAndNavigate(mainWindow, "settings"),
    },
    {
      label: "Quit",
      click: () => {
        (app as typeof app & { isQuitting: boolean }).isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
