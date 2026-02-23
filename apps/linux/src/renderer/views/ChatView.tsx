import { ChatThread } from "../components/ChatThread.js";
import { ChatCompose } from "../components/ChatCompose.js";
import type { ChatMessage } from "../lib/protocol-types.js";

type Props = {
  messages: ChatMessage[];
  streamText: string | null;
  sending: boolean;
  agentName: string;
  error: string | null;
  connected: boolean;
  voiceMode: boolean;
  onSend: (text: string) => void;
  onInputEvent?: (e: Event, value: string) => void;
  onClearRef?: (fn: () => void) => void;
};

export function ChatView({
  messages,
  streamText,
  sending,
  agentName,
  error,
  connected,
  voiceMode,
  onSend,
  onInputEvent,
  onClearRef,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <ChatThread
          messages={messages}
          streamText={streamText}
          sending={sending}
          agentName={agentName}
        />
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-950/50 border-t border-red-900/50 text-red-400 text-xs">
          {error}
        </div>
      )}

      <ChatCompose
        onSend={onSend}
        onInputEvent={voiceMode ? onInputEvent : undefined}
        onClearRef={onClearRef}
        disabled={!connected || sending}
        voiceMode={voiceMode}
      />
    </div>
  );
}
