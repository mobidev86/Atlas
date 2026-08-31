import { useCallback, useEffect, useRef, useState } from 'react';

import { RecorderState } from '@choiminseok/react-native-audio-recorder';

import AudioRecorderService from '../services/AudioRecorderService';
import DeepgramSocketService from '../services/deepgramSocketService';
import { supabase } from '../services/supabase';

type TranscriptChangeCallback = (text: string) => void;

export const useAudioRecorder = (
  onTranscriptChange?: TranscriptChangeCallback,
) => {
  const [state, setState] = useState<RecorderState>(RecorderState.IDLE);

  const [isRecording, setIsRecording] = useState(false);

  /**
   * True while we are preparing the Deepgram connection
   * and starting the microphone.
   *
   * This is separate from isTranscribing so the UI can show:
   *
   * "Getting ready to listen..."
   *
   * before Deepgram/microphone are actually ready.
   */
  const [isPreparingToListen, setIsPreparingToListen] = useState(false);

  const [isTranscribing, setIsTranscribing] = useState(false);

  const [transcript, setTranscript] = useState('');

  const [text, setText] = useState('');

  const [transcriptText, setTranscriptText] = useState('');

  const [interimTranscript, setInterimTranscript] = useState('');

  const [error, setError] = useState<string | null>(null);

  const isDeepgramConnectedRef = useRef(false);

  const [volumeLevel, setVolumeLevel] = useState(0);

  /**
   * Keeps the latest callback available to the
   * Deepgram listener without re-registering
   * the listener every time the screen renders.
   */
  const onTranscriptChangeRef = useRef<TranscriptChangeCallback | undefined>(
    onTranscriptChange,
  );

  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
  }, [onTranscriptChange]);

  /**
   * Subscribe to Deepgram transcripts and
   * microphone audio chunks.
   */
  useEffect(() => {
    console.log('Registering Deepgram transcript listener');

    DeepgramSocketService.subscribeToTranscript(
      ({ text: newText, isFinal, speechFinal }) => {
        console.log('DEEPGRAM TRANSCRIPT:', {
          newText,
          isFinal,
          speechFinal,
        });

        if (!newText) {
          return;
        }

        /**
         * Deepgram has returned text.
         * Stop showing the "Listening..." state.
         */
        setIsTranscribing(false);

        if (isFinal) {
          setText(prev => {
            const updated = `${prev}${prev ? ' ' : ''}${newText}`.trim();

            console.log('FINAL TRANSCRIPT:', updated);

            setTranscript(updated);
            setTranscriptText(updated);

            /**
             * Update the TextInput on the screen.
             */
            onTranscriptChangeRef.current?.(updated);

            return updated;
          });

          setInterimTranscript('');
        } else {
          /**
           * This is an interim Deepgram result.
           * It can change as more audio arrives.
           */
          setInterimTranscript(newText);

          /**
           * Update the TextInput immediately
           * with final + interim text.
           */
          setText(prev => {
            const displayText = `${prev}${prev ? ' ' : ''}${newText}`.trim();

            onTranscriptChangeRef.current?.(displayText);

            /**
             * IMPORTANT:
             * Do not store the interim result in
             * the permanent text state.
             */
            return prev;
          });
        }

        /**
         * speechFinal means Deepgram considers
         * this speech segment complete.
         */
        if (speechFinal) {
          console.log('Deepgram speech final');

          setIsTranscribing(false);

          setTimeout(() => {
            if (!isDeepgramConnectedRef.current) {
              DeepgramSocketService.disconnect();
            }
          }, 300);
        }
      },
    );

    /**
     * Receive raw PCM audio chunks and send them
     * directly to Deepgram.
     */
    AudioRecorderService.subscribeToAudioChunks((data: number[]) => {
      if (!isDeepgramConnectedRef.current) {
        return;
      }

      DeepgramSocketService.sendAudio(data);
    });

    AudioRecorderService.subscribeToVolume(volume => {
      setVolumeLevel(volume);
    });

    /**
     * Listen to microphone state changes.
     */
    AudioRecorderService.subscribeToState(newState => {
      console.log('Recorder state:', newState);

      setState(newState);

      setIsRecording(newState === RecorderState.RECORDING);
    });

    return () => {
      AudioRecorderService.unsubscribe();

      DeepgramSocketService.disconnect();
    };
  }, []);

  /**
   * Get a fresh temporary Deepgram token
   * from the Supabase Edge Function.
   */
  const getDeepgramToken = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('deepgram-token');

    if (error) {
      console.error('Failed to get Deepgram token:', error);

      throw new Error('Failed to get Deepgram authentication token');
    }

    if (!data?.success || !data?.token) {
      console.error('Invalid Deepgram token response:', data);

      throw new Error('Invalid Deepgram authentication response');
    }

    return data.token;
  }, []);

  /**
   * Start recording.
   */
  const startRecording = useCallback(async () => {
    try {
      setError(null);

      /**
       * IMPORTANT:
       * Immediately show the "Getting ready to listen..."
       * state before doing any async work.
       */
      setIsPreparingToListen(true);

      /**
       * Reset previous voice input.
       */
      setTranscript('');
      setText('');
      setTranscriptText('');
      setInterimTranscript('');

      /**
       * Show loading/listening state.
       */
      setIsTranscribing(true);

      /**
       * Clear the TextInput.
       */
      onTranscriptChangeRef.current?.('');

      /**
       * Get a fresh temporary Deepgram token.
       */
      const token = await getDeepgramToken();

      /**
       * Connect to Deepgram.
       */
      await DeepgramSocketService.connect(token);

      isDeepgramConnectedRef.current = true;

      console.log('Deepgram connected. Starting microphone...');

      /**
       * Start microphone recording.
       */
      await AudioRecorderService.start();

      /**
       * At this point:
       *
       * - Deepgram is connected
       * - Microphone has started
       *
       * So we are no longer preparing.
       */
      setIsPreparingToListen(false);

      console.log('Voice recording started');
    } catch (error) {
      console.error('Failed to start voice recording:', error);

      isDeepgramConnectedRef.current = false;

      DeepgramSocketService.disconnect();

      setIsPreparingToListen(false);
      setIsTranscribing(false);

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to start voice recording';

      setError(message);

      throw error;
    }
  }, [getDeepgramToken]);

  /**
   * Stop recording.
   */
  const stopRecording = useCallback(async () => {
    try {
      console.log('STOP: stopping microphone...');

      /**
       * Stop microphone first.
       */
      const result = await AudioRecorderService.stop();

      console.log('STOP: microphone stopped');

      /**
       * Prevent additional audio chunks
       * from being sent.
       */
      isDeepgramConnectedRef.current = false;

      /**
       * IMPORTANT:
       * Do NOT disconnect Deepgram here.
       *
       * Deepgram still needs to return the
       * final transcript.
       */
      DeepgramSocketService.finalize();

      setIsTranscribing(false);

      return result;
    } catch (error) {
      console.error('Failed to stop voice recording:', error);

      isDeepgramConnectedRef.current = false;

      DeepgramSocketService.disconnect();

      setIsPreparingToListen(false);
      setIsTranscribing(false);

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to stop voice recording';

      setError(message);

      throw error;
    }
  }, []);

  return {
    state,
    isRecording,
    isPreparingToListen,
    isTranscribing,
    transcript,
    interimTranscript,
    text,
    transcriptText,
    error,
    volumeLevel,
    startRecording,
    stopRecording,
  };
};
