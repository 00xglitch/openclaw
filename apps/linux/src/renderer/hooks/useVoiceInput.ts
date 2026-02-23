import { useState, useCallback, useRef, useEffect } from "react";
import { MicCapture } from "../lib/mic-capture.js";
import { createSilenceDetector } from "../lib/silence-detect.js";

type Options = {
  onTranscription: (text: string) => void;
  onError: (message: string) => void;
  silenceDurationMs?: number;
  deviceId?: string;
};

export function useVoiceInput({
  onTranscription,
  onError,
  silenceDurationMs = 2000,
  deviceId,
}: Options) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [level, setLevel] = useState(0);
  const captureRef = useRef<MicCapture | null>(null);
  const silenceRef = useRef<{ stop: () => void } | null>(null);
  const levelTimerRef = useRef<number>(0);

  // Stable ref for the stop handler (avoids stale closure in silence detector)
  const doStop = useCallback(async () => {
    silenceRef.current?.stop();
    silenceRef.current = null;
    window.clearInterval(levelTimerRef.current);
    setLevel(0);

    const capture = captureRef.current;
    if (!capture) {return;}
    captureRef.current = null;
    setRecording(false);
    setTranscribing(true);

    try {
      const blob = await capture.stop();
      const buffer = await blob.arrayBuffer();
      const text = await window.openclawBridge.sttTranscribe(buffer);
      if (text.trim()) {
        onTranscription(text.trim());
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }, [onTranscription, onError]);

  // Keep latest doStop in a ref for the silence detector callback
  const stopFnRef = useRef(doStop);
  stopFnRef.current = doStop;

  const startRecording = useCallback(async () => {
    if (captureRef.current) {return;} // Already recording

    try {
      const capture = new MicCapture();
      await capture.start(deviceId);
      captureRef.current = capture;
      setRecording(true);

      levelTimerRef.current = window.setInterval(() => {
        setLevel(capture.getLevel());
      }, 50);

      silenceRef.current = createSilenceDetector(() => capture.getLevel(), {
        thresholdLevel: 0.02,
        silenceDurationMs,
        onSilence: () => stopFnRef.current(),
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Mic access denied");
    }
  }, [deviceId, silenceDurationMs, onError]);

  const stopRecording = useCallback(() => {
    stopFnRef.current();
  }, []);

  const toggleRecording = useCallback(() => {
    if (captureRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      silenceRef.current?.stop();
      window.clearInterval(levelTimerRef.current);
      captureRef.current?.stop();
    };
  }, []);

  return {
    recording,
    transcribing,
    level,
    toggleRecording,
    startRecording,
    stopRecording,
  };
}
