import { ipcMain, safeStorage } from "electron";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_GATEWAY_URL = "wss://127.0.0.1:9443";
const DEFAULT_TTS_URL = "http://127.0.0.1:4123/v1";

const SECRETS_DIR = join(homedir(), ".openclaw", "electron-secrets");

/** Sanitize key to prevent path traversal */
function safeKeyPath(key: string): string {
  const sanitized = key.replace(/[^a-zA-Z0-9._:-]/g, "_");
  const full = join(SECRETS_DIR, sanitized);
  if (!full.startsWith(SECRETS_DIR)) {throw new Error("invalid secret key");}
  return full;
}

/** Encrypt + write a secret via Electron safeStorage */
function setSecret(key: string, value: string): void {
  mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
  const encrypted = safeStorage.encryptString(value);
  writeFileSync(safeKeyPath(key), encrypted, { mode: 0o600 });
}

/** Decrypt + read a secret via Electron safeStorage */
function getSecret(key: string): string | null {
  try {
    const data = readFileSync(safeKeyPath(key));
    return safeStorage.decryptString(Buffer.from(data));
  } catch {
    return null;
  }
}

/** Delete a secret */
function deleteSecret(key: string): void {
  try {
    unlinkSync(safeKeyPath(key));
  } catch { /* not found, ignore */ }
}

/** Read openclaw.json config, caching the parsed result */
function readOpenClawConfig(): Record<string, unknown> {
  try {
    const configPath = join(homedir(), ".openclaw", "openclaw.json");
    const raw = readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Read gateway token from env → config file */
function getGatewayToken(): string {
  if (process.env.OPENCLAW_GATEWAY_TOKEN) {return process.env.OPENCLAW_GATEWAY_TOKEN;}
  const config = readOpenClawConfig();
  const gateway = config.gateway as { auth?: { token?: string } } | undefined;
  return gateway?.auth?.token ?? "";
}

/** Read gateway URL from env → config file → default */
function getGatewayUrl(): string {
  if (process.env.OPENCLAW_GATEWAY_URL) {return process.env.OPENCLAW_GATEWAY_URL;}
  const config = readOpenClawConfig();
  const gateway = config.gateway as { url?: string } | undefined;
  return gateway?.url ?? DEFAULT_GATEWAY_URL;
}

/** Read TTS URL from env → config file → default */
function getTtsUrl(): string {
  if (process.env.OPENAI_TTS_BASE_URL) {return process.env.OPENAI_TTS_BASE_URL;}
  const config = readOpenClawConfig();
  const messages = config.messages as { tts?: { openai?: { baseUrl?: string } } } | undefined;
  return messages?.tts?.openai?.baseUrl ?? DEFAULT_TTS_URL;
}

export function setupIpcHandlers(): void {
  // Gateway config (reads env → openclaw.json → defaults)
  ipcMain.handle("gateway:getConfig", () => ({
    gatewayUrl: getGatewayUrl(),
    token: getGatewayToken(),
    ttsUrl: getTtsUrl(),
  }));

  // Encrypted secrets via Electron safeStorage (OS keychain / libsecret)
  ipcMain.handle("secrets:get", (_event, key: string) => getSecret(key));
  ipcMain.handle("secrets:set", (_event, key: string, value: string) => {
    setSecret(key, value);
  });
  ipcMain.handle("secrets:delete", (_event, key: string) => {
    deleteSecret(key);
  });

  // TTS synthesis via Chatterbox (main process avoids CORS)
  ipcMain.handle("tts:synthesize", async (_event, text: string, voice?: string) => {
    try {
      const ttsUrl = getTtsUrl();
      const apiKey = process.env.OPENAI_API_KEY || "chatterbox-local";

      const response = await fetch(`${ttsUrl}/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "chatterbox",
          input: text,
          voice: voice || "default",
          response_format: "mp3",
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        throw new Error(`TTS ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "TTS failed";
      throw new Error(msg, { cause: err });
    }
  });

  // STT transcription — POST audio to local OpenAI-compatible Whisper endpoint
  ipcMain.handle("stt:transcribe", async (_event, audioBuffer: ArrayBuffer) => {
    try {
      const sttUrl = process.env.OPENAI_STT_BASE_URL || getTtsUrl();
      const apiKey = process.env.OPENAI_API_KEY || "chatterbox-local";

      const formData = new FormData();
      formData.append(
        "file",
        new Blob([audioBuffer], { type: "audio/webm" }),
        "audio.webm",
      );
      formData.append("model", "whisper-1");

      const response = await fetch(`${sttUrl}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        throw new Error(`STT ${response.status}: ${response.statusText}`);
      }

      const result = (await response.json()) as { text?: string };
      return result.text ?? "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "STT failed";
      throw new Error(msg, { cause: err });
    }
  });

  // Gateway discovery — probe common ports on local subnet
  ipcMain.handle("discovery:scan", async () => {
    const candidates = ["127.0.0.1"];
    // Add local subnet IPs (192.168.x.1-254)
    try {
      const os = await import("node:os");
      for (const ifaces of Object.values(os.networkInterfaces())) {
        if (!ifaces) {continue;}
        for (const iface of ifaces) {
          if (iface.family === "IPv4" && !iface.internal) {
            const parts = iface.address.split(".");
            for (let i = 1; i <= 254; i++) {
              const ip = `${parts[0]}.${parts[1]}.${parts[2]}.${i}`;
              if (!candidates.includes(ip)) {candidates.push(ip);}
            }
          }
        }
      }
    } catch { /* no network interfaces */ }

    const port = parseInt(process.env.OPENCLAW_GATEWAY_PORT || "9443", 10);
    const results: { url: string; name: string; version: string }[] = [];

    // Probe in parallel with aggressive timeout — try HTTPS first, fallback to HTTP
    const probes = candidates.map(async (ip) => {
      for (const scheme of ["https", "http"] as const) {
        try {
          const res = await fetch(`${scheme}://${ip}:${port}/health`, {
            signal: AbortSignal.timeout(1500),
          });
          if (res.ok) {
            const data = (await res.json()) as { name?: string; version?: string };
            results.push({
              url: `${scheme === "https" ? "wss" : "ws"}://${ip}:${port}`,
              name: data.name ?? `OpenClaw @ ${ip}`,
              version: data.version ?? "unknown",
            });
            return; // Found — skip other scheme
          }
        } catch { /* unreachable or wrong scheme */ }
      }
    });

    // Limit concurrency: batch 50 at a time to avoid fd exhaustion
    for (let i = 0; i < probes.length; i += 50) {
      await Promise.all(probes.slice(i, i + 50));
    }

    return results;
  });

  // Handy SIGUSR2 trigger (uses execFileSync, no shell injection risk)
  ipcMain.handle("handy:trigger", () => {
    try {
      const output = execFileSync("pgrep", ["-f", "handy"], { timeout: 2000 });
      const pid = output.toString().trim().split("\n")[0];
      if (pid) {
        process.kill(parseInt(pid, 10), "SIGUSR2");
        return true;
      }
    } catch (err) {
      console.warn("handy:trigger — process not found or signal failed:", err instanceof Error ? err.message : err);
    }
    return false;
  });
}
