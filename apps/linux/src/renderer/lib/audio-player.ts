let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
const queue: ArrayBuffer[] = [];
let isPlaying = false;

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

async function playBuffer(buffer: ArrayBuffer): Promise<void> {
  const ctx = getContext();

  // Resume if suspended (autoplay policy)
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const audioBuffer = await ctx.decodeAudioData(buffer.slice(0));
  return new Promise<void>((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    currentSource = source;
    source.onended = () => {
      currentSource = null;
      resolve();
    };
    source.start(0);
  });
}

async function processQueue(): Promise<void> {
  if (isPlaying) {return;}
  isPlaying = true;

  while (queue.length > 0) {
    const buffer = queue.shift()!;
    try {
      await playBuffer(buffer);
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  }

  isPlaying = false;
}

export function enqueueAudio(buffer: ArrayBuffer): void {
  queue.push(buffer);
  processQueue();
}

export function stopAudio(): void {
  queue.length = 0;
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      // Already stopped
    }
    currentSource = null;
  }
  isPlaying = false;
}

export function isAudioPlaying(): boolean {
  return isPlaying;
}
