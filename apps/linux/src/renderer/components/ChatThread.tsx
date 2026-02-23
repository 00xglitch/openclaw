import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble.js";
import { StreamingBubble } from "./StreamingBubble.js";
import type { ChatMessage } from "../lib/protocol-types.js";

type Props = {
  messages: ChatMessage[];
  streamText: string | null;
  sending: boolean;
  agentName?: string;
};

export function ChatThread({ messages, streamText, sending, agentName }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamText]);

  const isStreaming = streamText !== null;
  const initial = agentName?.charAt(0).toUpperCase();

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-700"
          >
            <rect x="9" y="1" width="6" height="11" rx="3" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          <span className="text-sm">Send a message or tap the mic to start</span>
        </div>
      )}

      {messages.map((msg, i) => (
        <MessageBubble key={`${msg.timestamp ?? i}-${msg.role}`} message={msg} agentName={agentName} />
      ))}

      {isStreaming && <StreamingBubble text={streamText ?? ""} agentInitial={initial} />}

      {sending && !isStreaming && (
        <div className="flex justify-start mb-3 gap-2">
          <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-1">
            <span className="text-[10px] font-bold text-orange-400">{initial ?? "A"}</span>
          </div>
          <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-zinc-800/60 text-zinc-500 text-sm">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
