import { extractText } from "../lib/message-extract.js";
import { renderMarkdown } from "../lib/markdown-lite.js";
import type { ChatMessage } from "../lib/protocol-types.js";

type Props = {
  message: ChatMessage;
  agentName?: string;
};

export function MessageBubble({ message, agentName }: Props) {
  const text = extractText(message) ?? "";
  const isUser = message.role === "user";
  const initial = (agentName ?? "A").charAt(0).toUpperCase();

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 gap-2`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-[10px] font-bold text-orange-400">{initial}</span>
        </div>
      )}
      <div className="flex flex-col">
        <div
          className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
            isUser
              ? "bg-orange-600/90 text-white rounded-br-md"
              : "bg-zinc-800/80 text-zinc-200 rounded-bl-md"
          }`}
        >
          {isUser ? <span className="whitespace-pre-wrap">{text}</span> : renderMarkdown(text)}
        </div>
        {message.timestamp && (
          <span className={`text-[10px] text-zinc-600 mt-1 ${isUser ? "text-right" : "text-left"}`}>
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
