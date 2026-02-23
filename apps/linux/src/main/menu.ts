import { Menu, shell, app, type BrowserWindow } from "electron";

function nav(mainWindow: BrowserWindow, view: string) {
  mainWindow.webContents.send("menu:navigate", { view });
}

export function setupMenu(mainWindow: BrowserWindow): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New Session",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow.webContents.send("menu:new-session"),
        },
        { type: "separator" },
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => nav(mainWindow, "settings"),
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: "CmdOrCtrl+Q",
          click: () => app.quit(),
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Chat",
          accelerator: "CmdOrCtrl+1",
          click: () => nav(mainWindow, "chat"),
        },
        {
          label: "Board",
          accelerator: "CmdOrCtrl+2",
          click: () => nav(mainWindow, "board"),
        },
        {
          label: "Calendar",
          accelerator: "CmdOrCtrl+3",
          click: () => nav(mainWindow, "calendar"),
        },
        {
          label: "Search",
          accelerator: "CmdOrCtrl+4",
          click: () => nav(mainWindow, "search"),
        },
        { type: "separator" },
        {
          label: "Sessions",
          accelerator: "CmdOrCtrl+5",
          click: () => nav(mainWindow, "sessions"),
        },
        {
          label: "Agents",
          accelerator: "CmdOrCtrl+6",
          click: () => nav(mainWindow, "agents"),
        },
        {
          label: "Channels",
          accelerator: "CmdOrCtrl+7",
          click: () => nav(mainWindow, "channels"),
        },
        {
          label: "Skills",
          accelerator: "CmdOrCtrl+8",
          click: () => nav(mainWindow, "skills"),
        },
        { type: "separator" },
        {
          label: "Logs",
          accelerator: "CmdOrCtrl+L",
          click: () => nav(mainWindow, "logs"),
        },
        {
          label: "Usage",
          accelerator: "CmdOrCtrl+U",
          click: () => nav(mainWindow, "usage"),
        },
        {
          label: "Config",
          click: () => nav(mainWindow, "config"),
        },
        {
          label: "More",
          click: () => nav(mainWindow, "more"),
        },
        { type: "separator" },
        { role: "toggleDevTools", accelerator: "CmdOrCtrl+Shift+I" },
        { role: "reload", accelerator: "CmdOrCtrl+R" },
        { role: "togglefullscreen", accelerator: "F11" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "close" },
        { type: "separator" },
        {
          label: "Zoom In",
          role: "zoomIn",
        },
        {
          label: "Zoom Out",
          role: "zoomOut",
        },
        {
          label: "Actual Size",
          role: "resetZoom",
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About OpenClaw",
          click: () => nav(mainWindow, "about"),
        },
        {
          label: "Documentation",
          click: () => shell.openExternal("https://docs.openclaw.ai"),
        },
        {
          label: "Report Issue",
          click: () => shell.openExternal("https://github.com/openclaw/openclaw/issues"),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
