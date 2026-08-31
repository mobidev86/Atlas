type TranscriptListener = (transcript: {
  text: string;
  isFinal: boolean;
  speechFinal: boolean;
}) => void;

class DeepgramSocketService {
  private socket: WebSocket | null = null;

  private connectPromise: Promise<void> | null = null;

  private transcriptListener: TranscriptListener | null = null;

  /**
   * Connect to Deepgram using a temporary token.
   */
  connect(token: string): Promise<void> {
    // Already connected
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    // Connection already in progress
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      const url =
        'wss://api.deepgram.com/v1/listen' +
        '?model=nova-3' +
        '&language=multi' +
        '&encoding=linear16' +
        '&sample_rate=16000' +
        '&channels=1' +
        '&interim_results=true' +
        '&smart_format=true' +
        '&punctuate=true' +
        '&endpointing=300';

      console.log('Connecting to Deepgram...');

      this.socket = new WebSocket(url, ['bearer', token]);

      this.socket.onopen = () => {
        console.log('Deepgram WebSocket connected');

        this.connectPromise = null;

        resolve();
      };

      this.socket.onerror = error => {
        console.error('Deepgram WebSocket error:', error);

        this.connectPromise = null;

        reject(new Error('Failed to connect to Deepgram'));
      };

      this.socket.onclose = event => {
        console.log('Deepgram WebSocket closed:', event.code, event.reason);

        this.socket = null;
        this.connectPromise = null;
      };

      this.socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data);

          console.log('Deepgram message:' + JSON.stringify(message));

          if (message.type !== 'Results') {
            return;
          }

          const alternative = message.channel?.alternatives?.[0];

          if (!alternative) {
            return;
          }

          const text = alternative.transcript ?? '';

          if (!text) {
            return;
          }

          this.transcriptListener?.({
            text,
            isFinal: message.is_final ?? false,
            speechFinal: message.speech_final ?? false,
          });
        } catch (error) {
          console.error('Failed to parse Deepgram message:', error);
        }
      };
    });

    return this.connectPromise;
  }

  /**
   * Subscribe to Deepgram transcript events.
   */
  subscribeToTranscript(listener: TranscriptListener): void {
    this.transcriptListener = listener;
  }

  /**
   * Send raw PCM audio to Deepgram.
   *
   * The recorder provides 16-bit PCM samples
   * as number[].
   */
  sendAudio(samples: number[]): void {
    if (!this.socket) {
      console.warn('Deepgram socket is not initialized');
      return;
    }

    if (this.socket.readyState !== WebSocket.OPEN) {
      console.warn('Deepgram socket is not connected');
      return;
    }

    console.log('Sending audio to Deepgram:', samples.length);

    const buffer = new ArrayBuffer(samples.length * 2);

    const view = new DataView(buffer);

    for (let i = 0; i < samples.length; i++) {
      view.setInt16(i * 2, samples[i], true);
    }

    this.socket.send(buffer);
  }

  /**
   * Tell Deepgram that no more audio will be sent
   * for the current recording.
   *
   * Deepgram will finalize the current transcript
   * and return the final Results event.
   */
  finalize(): void {
    if (!this.socket) {
      console.warn('Deepgram socket is not initialized');
      return;
    }

    if (this.socket.readyState !== WebSocket.OPEN) {
      console.warn('Deepgram socket is not connected');
      return;
    }

    console.log('Sending Finalize message to Deepgram');

    this.socket.send(
      JSON.stringify({
        type: 'Finalize',
      }),
    );
  }

  /**
   * Check whether Deepgram WebSocket is connected.
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Close the Deepgram WebSocket.
   */
  disconnect(): void {
    if (this.socket) {
      console.log('Disconnecting Deepgram...');

      this.socket.close();

      this.socket = null;
    }

    this.connectPromise = null;
    this.transcriptListener = null;
  }
}

export default new DeepgramSocketService();
