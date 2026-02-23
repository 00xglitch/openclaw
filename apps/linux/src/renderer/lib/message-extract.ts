// Adapted from ui/src/ui/chat/message-extract.ts

const THINKING_RE = /<\s*think(?:ing)?\s*>[\s\S]*?<\s*\/\s*think(?:ing)?\s*>/gi;

function stripThinkingTags(text: string): string {
  return text.replace(THINKING_RE, "").trim();
}

const ENVELOPE_PREFIX = /^\[([^\]]+)\]\s*/;
const ENVELOPE_CHANNELS = [
  "WebChat", "WhatsApp", "Telegram", "Signal", "Slack", "Discord",
  "iMessage", "Teams", "Matrix", "BlueBubbles",
];

function looksLikeEnvelopeHeader(header: string): boolean {
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\b/.test(header)) {return true;}
  if (/\d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/.test(header)) {return true;}
  return ENVELOPE_CHANNELS.some((label) => header.startsWith(`${label} `));
}

function stripEnvelope(text: string): string {
  const match = text.match(ENVELOPE_PREFIX);
  if (!match) {return text;}
  const header = match[1] ?? "";
  if (!looksLikeEnvelopeHeader(header)) {return text;}
  return text.slice(match[0].length);
}

export function extractText(message: unknown): string | null {
  const m = message as Record<string, unknown>;
  const role = typeof m.role === "string" ? m.role : "";
  const content = m.content;

  if (typeof content === "string") {
    return role === "assistant" ? stripThinkingTags(content) : stripEnvelope(content);
  }

  if (Array.isArray(content)) {
    const parts = content
      .map((p) => {
        const item = p as Record<string, unknown>;
        if (item.type === "text" && typeof item.text === "string") {return item.text;}
        return null;
      })
      .filter((v): v is string => typeof v === "string");
    if (parts.length > 0) {
      const joined = parts.join("\n");
      return role === "assistant" ? stripThinkingTags(joined) : stripEnvelope(joined);
    }
  }

  if (typeof m.text === "string") {
    return role === "assistant" ? stripThinkingTags(m.text) : stripEnvelope(m.text);
  }

  return null;
}
