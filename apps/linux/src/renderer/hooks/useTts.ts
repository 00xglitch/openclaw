import { useRef, useCallback } from "react";
import { enqueueAudio, stopAudio } from "../lib/audio-player.js";
import { extractText } from "../lib/message-extract.js";
import type { ChatMessage } from "../lib/protocol-types.js";

export function useTts(enabled: boolean) {
  const lastSpokenRef = useRef<string>("");
  const busyRef = useRef(false);

  const speakMessage = useCallback(
    async (message: ChatMessage) => {
      if (!enabled || busyRef.current) {return;}
      if (message.role !== "assistant") {return;}

      const text = extractText(message);
      if (!text || text === lastSpokenRef.current) {return;}

      // Avoid re-speaking the same message
      lastSpokenRef.current = text;

      // Truncate long messages for TTS
      const ttsText = text.length > 500 ? text.slice(0, 500) + "..." : text;

      busyRef.current = true;
      try {
        const audioBuffer = await window.openclawBridge.ttsSynthesize(ttsText);
        enqueueAudio(audioBuffer);
      } catch (err) {
        console.error("TTS failed:", err);
      } finally {
        busyRef.current = false;
      }
    },
    [enabled],
  );

  const stop = useCallback(() => {
    stopAudio();
    busyRef.current = false;
  }, []);

  return { speakMessage, stop };
}
