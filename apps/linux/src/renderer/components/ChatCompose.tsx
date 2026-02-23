import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type FormEvent } from "react";

type Props = {
  onSend: (text: string) => void;
  onInputEvent?: (e: Event, value: string) => void;
  onClearRef?: (clear: () => void) => void;
  disabled: boolean;
  voiceMode: boolean;
};

export function ChatCompose({ onSend, onInputEvent, onClearRef, disabled, voiceMode }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const msg = text.trim();
    if (!msg || disabled) {return;}
    onSend(msg);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(
    (e: FormEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      setText(target.value);

      // Auto-resize
      target.style.height = "auto";
      target.style.height = Math.min(target.scrollHeight, 160) + "px";

      // Voice detection
      onInputEvent?.(e.nativeEvent, target.value);
    },
    [onInputEvent],
  );

  // Allow external clearing (for auto-send)
  const clearInput = useCallback(() => {
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, []);

  // Expose clear function to parent
  useEffect(() => {
    onClearRef?.(clearInput);
  }, [onClearRef, clearInput]);

  return (
    <div className="border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-sm px-3 py-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={voiceMode ? "Speak or type..." : "Message..."}
            disabled={disabled}
            rows={1}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 disabled:opacity-50 transition-colors"
          />
          {voiceMode && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            </div>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="p-2.5 rounded-xl bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-30 disabled:hover:bg-orange-600 transition-colors"
          title="Send (Enter)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
