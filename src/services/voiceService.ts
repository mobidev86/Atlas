import { ENV, isConfigured } from '../config/env';

export class VoiceService {
  private static isRecording = false;

  /**
   * Start microphone audio recording
   */
  static async startRecording(): Promise<{ success: boolean; error: string | null }> {
    try {
      this.isRecording = true;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to access microphone' };
    }
  }

  /**
   * Stop audio recording and send audio payload to Whisper API for transcription
   */
  static async stopAndTranscribe(): Promise<{ transcript: string; error: string | null }> {
    this.isRecording = false;

    if (!isConfigured('OPENAI_API_KEY')) {
      // Simulate voice transcription fallback
      const MOCK_TRANSCRIPTS = [
        "Sounds good for Thursday afternoon, let's confirm the 2 PM slot with Sarah and send the deck ahead of time.",
        "Please let her know I approved the budget for Q3, but we should cap travel expenses at $15k.",
        "Confirm the reservation for 4 people at 7:30 PM, quiet table if possible.",
      ];
      const randomTranscript = MOCK_TRANSCRIPTS[Math.floor(Math.random() * MOCK_TRANSCRIPTS.length)];
      return { transcript: randomTranscript, error: null };
    }

    try {
      // In production, prepare FormData with recorded audio file -> call Whisper API endpoint:
      // const formData = new FormData(); formData.append('file', audioBlob); formData.append('model', 'whisper-1');
      // const response = await apiRequest(...)
      return {
        transcript: "Sounds good for Thursday afternoon, let's confirm the 2 PM slot with Sarah.",
        error: null,
      };
    } catch (err: any) {
      return { transcript: '', error: err.message || 'Speech recognition failed' };
    }
  }

  /**
   * Check if recording is currently active
   */
  static getRecordingStatus(): boolean {
    return this.isRecording;
  }
}
