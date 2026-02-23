import { contextBridge, ipcRenderer } from "electron";

export type DiscoveredInstance = {
  url: string;
  name: string;
  version: string;
};

export type OpenClawBridge = {
  getConfig: () => Promise<{ gatewayUrl: string; token: string; ttsUrl: string }>;
  ttsSynthesize: (text: string, voice?: string) => Promise<ArrayBuffer>;
  sttTranscribe: (audio: ArrayBuffer) => Promise<string>;
  discoveryScan: () => Promise<DiscoveredInstance[]>;
  handyTrigger: () => Promise<boolean>;
  secretsGet: (key: string) => Promise<string | null>;
  secretsSet: (key: string, value: string) => Promise<void>;
  secretsDelete: (key: string) => Promise<void>;
  quit: () => void;
  minimize: () => void;
  onMenuNavigate: (callback: (view: string) => void) => void;
  onMenuNewSession: (callback: () => void) => void;
  platform: string;
};

contextBridge.exposeInMainWorld("openclawBridge", {
  getConfig: () => ipcRenderer.invoke("gateway:getConfig"),
  ttsSynthesize: (text: string, voice?: string) => ipcRenderer.invoke("tts:synthesize", text, voice),
  sttTranscribe: (audio: ArrayBuffer) => ipcRenderer.invoke("stt:transcribe", audio),
  discoveryScan: () => ipcRenderer.invoke("discovery:scan"),
  handyTrigger: () => ipcRenderer.invoke("handy:trigger"),
  secretsGet: (key: string) => ipcRenderer.invoke("secrets:get", key),
  secretsSet: (key: string, value: string) => ipcRenderer.invoke("secrets:set", key, value),
  secretsDelete: (key: string) => ipcRenderer.invoke("secrets:delete", key),
  quit: () => ipcRenderer.send("app:quit"),
  minimize: () => ipcRenderer.send("app:minimize"),
  onMenuNavigate: (callback: (view: string) => void) => {
    ipcRenderer.on("menu:navigate", (_event, { view }) => callback(view));
  },
  onMenuNewSession: (callback: () => void) => {
    ipcRenderer.on("menu:new-session", () => callback());
  },
  platform: process.platform,
} satisfies OpenClawBridge);
