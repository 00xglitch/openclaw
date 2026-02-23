import { useRef, useCallback, useEffect } from "react";
import { createVoiceDetector, type VoiceDetectorOptions } from "../lib/voice-detect.js";

export function useAutoSend(
  enabled: boolean,
  onAutoSend: (text: string) => void,
  onClear: () => void,
  onBurstDetected?: () => void,
) {
  const detectorRef = useRef<ReturnType<typeof createVoiceDetector> | null>(null);

  useEffect(() => {
    if (!enabled) {
      detectorRef.current?.reset();
      detectorRef.current = null;
      return;
    }

    detectorRef.current = createVoiceDetector({
      onBurstComplete: (text) => {
        onAutoSend(text);
        onClear();
      },
      onBurstStart: onBurstDetected,
    });

    return () => {
      detectorRef.current?.reset();
      detectorRef.current = null;
    };
  }, [enabled, onAutoSend, onClear, onBurstDetected]);

  const onInput = useCallback(
    (e: Event, currentValue: string) => {
      if (!enabled || !detectorRef.current) {return;}
      detectorRef.current.onInput(e, currentValue);
    },
    [enabled],
  );

  return { onInput };
}
