/**
 * Monitors audio level from a source and fires onSilence after
 * sustained silence (level below threshold for the specified duration).
 */
export type SilenceDetectOptions = {
  thresholdLevel: number;    // 0-1, below = silence
  silenceDurationMs: number; // how long silence must last
  onSilence: () => void;
  checkIntervalMs?: number;  // defaults to 100
};

export function createSilenceDetector(
  getLevel: () => number,
  opts: SilenceDetectOptions,
) {
  let silenceStart: number | null = null;
  const interval = opts.checkIntervalMs ?? 100;

  const timer = setInterval(() => {
    const level = getLevel();
    if (level < opts.thresholdLevel) {
      if (silenceStart === null) {
        silenceStart = Date.now();
      } else if (Date.now() - silenceStart >= opts.silenceDurationMs) {
        clearInterval(timer);
        opts.onSilence();
      }
    } else {
      silenceStart = null;
    }
  }, interval);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
