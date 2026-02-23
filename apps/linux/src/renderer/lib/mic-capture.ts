/**
 * Native mic capture using getUserMedia + MediaRecorder + AnalyserNode.
 * Captures webm/opus audio and provides real-time volume levels.
 */
export class MicCapture {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;

  async start(deviceId?: string): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    this.recorder = new MediaRecorder(this.stream, {
      mimeType: "audio/webm;codecs=opus",
    });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {this.chunks.push(e.data);}
    };
    this.recorder.start(250);
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.recorder || this.recorder.state === "inactive") {
        resolve(new Blob(this.chunks, { type: "audio/webm" }));
        this.cleanup();
        return;
      }
      this.recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: "audio/webm" }));
      };
      this.recorder.stop();
      this.cleanup();
    });
  }

  /** Returns audio level 0-1 */
  getLevel(): number {
    if (!this.analyser) {return 0;}
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {sum += data[i];}
    return sum / data.length / 255;
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close();
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
  }

  static async listDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audioinput");
  }
}
