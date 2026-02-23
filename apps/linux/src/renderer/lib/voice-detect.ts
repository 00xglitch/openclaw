// Detects rapid text insertion from xdotool (Handy STT) vs normal typing.
// xdotool inserts characters at <5ms intervals; humans type at 50-200ms.

export type VoiceDetectorOptions = {
  onBurstComplete: (text: string) => void;
  onBurstStart?: () => void;  // Fires once when burst threshold first crossed (e.g. stop TTS)
  burstThresholdMs?: number;  // Max ms between chars to count as burst (default: 10)
  burstMinChars?: number;     // Min chars for a burst (default: 5)
  settleMs?: number;          // Ms after last char before sending (default: 400)
};

export function createVoiceDetector(opts: VoiceDetectorOptions) {
  let burstChars = 0;
  let lastInputTime = 0;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let isBursting = false;

  const thresholdMs = opts.burstThresholdMs ?? 10;
  const minChars = opts.burstMinChars ?? 5;
  const settleMs = opts.settleMs ?? 400;

  return {
    onInput(_event: Event, currentValue: string): void {
      const now = performance.now();
      const delta = now - lastInputTime;
      lastInputTime = now;

      if (delta < thresholdMs) {
        burstChars++;
        if (burstChars >= minChars && !isBursting) {
          isBursting = true;
          opts.onBurstStart?.();
        }
      } else {
        burstChars = 1;
      }

      if (isBursting) {
        if (settleTimer) {clearTimeout(settleTimer);}
        settleTimer = setTimeout(() => {
          if (currentValue.trim()) {
            opts.onBurstComplete(currentValue.trim());
          }
          isBursting = false;
          burstChars = 0;
        }, settleMs);
      }
    },

    reset(): void {
      isBursting = false;
      burstChars = 0;
      if (settleTimer) {clearTimeout(settleTimer);}
      settleTimer = null;
    },
  };
}
