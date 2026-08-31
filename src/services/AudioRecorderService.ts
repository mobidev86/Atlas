import AudioRecorder, {
  AudioDataEvent,
  PermissionStatus,
  RecorderState,
} from '@choiminseok/react-native-audio-recorder';

type AudioChunkListener = (data: number[]) => void;
type VolumeListener = (volume: number) => void;
type StateListener = (state: RecorderState) => void;

class AudioRecorderService {
  private audioDataSubscription: {
    remove: () => void;
  } | null = null;

  private stateSubscription: {
    remove: () => void;
  } | null = null;

  private audioChunkListener: AudioChunkListener | null = null;
  private volumeListener: VolumeListener | null = null;
  private stateListener: StateListener | null = null;

  private lastVolumeUpdate = 0;

  async checkAndRequestPermission(): Promise<boolean> {
    const status = await AudioRecorder.checkPermission();

    if (status === PermissionStatus.GRANTED) {
      return true;
    }

    const nextStatus = await AudioRecorder.requestPermission();

    if (nextStatus !== PermissionStatus.GRANTED) {
      throw new Error('Microphone permission is required');
    }

    return true;
  }

  subscribeToAudioChunks(listener: AudioChunkListener): void {
    this.audioChunkListener = listener;

    if (this.audioDataSubscription) {
      return;
    }

    this.audioDataSubscription = AudioRecorder.addListener(
      'audioData',
      (event: AudioDataEvent) => {
        const data = event.chunk.data;

        // Keep sending raw PCM to Deepgram.
        this.audioChunkListener?.(data);

        // Calculate waveform amplitude.
        this.calculateVolume(data);
      },
    );
  }

  subscribeToVolume(listener: VolumeListener): void {
    this.volumeListener = listener;
  }

  subscribeToState(listener: StateListener): void {
    this.stateListener = listener;

    if (this.stateSubscription) {
      return;
    }

    this.stateSubscription = AudioRecorder.addListener('stateChange', event => {
      this.stateListener?.(event.newState);
    });
  }

  private calculateVolume(data: number[]): void {
    if (!data.length) {
      return;
    }

    const now = Date.now();

    // ~30 FPS is enough for a waveform.
    if (now - this.lastVolumeUpdate < 33) {
      return;
    }

    this.lastVolumeUpdate = now;

    let sum = 0;

    for (let i = 0; i < data.length; i++) {
      const sample = data[i];

      sum += sample * sample;
    }

    const rms = Math.sqrt(sum / data.length);

    /**
     * 16-bit PCM:
     *
     * Minimum: -32768
     * Maximum:  32767
     *
     * Normalize RMS to 0 → 1.
     */
    let normalized = rms / 32768;

    normalized = Math.min(1, Math.max(0, normalized));

    /**
     * Make quiet speech more visually noticeable.
     */
    normalized = Math.pow(normalized, 0.6);

    this.volumeListener?.(normalized);
  }

  async start(): Promise<void> {
    await this.checkAndRequestPermission();

    await AudioRecorder.startRecording({
      sampleRate: 16000,
      channels: 1,
      chunkSize: 1024,
      audioSource: 'mic',
    });
  }

  async stop() {
    const result = await AudioRecorder.stopRecording();

    this.volumeListener?.(0);

    return result;
  }

  unsubscribe(): void {
    this.audioDataSubscription?.remove();
    this.stateSubscription?.remove();

    this.audioDataSubscription = null;
    this.stateSubscription = null;

    this.audioChunkListener = null;
    this.volumeListener = null;
    this.stateListener = null;

    this.lastVolumeUpdate = 0;
  }
}

export default new AudioRecorderService();
