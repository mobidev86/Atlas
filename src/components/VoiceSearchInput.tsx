import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

import Ionicons from '@react-native-vector-icons/ionicons';

import styles from '../styles/styles';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import AudioWaveform from './AudioWaveform';

interface VoiceSearchInputProps {
  value: string;
  onChangeText: (value: string) => void;

  placeholder?: string;

  onSubmitEditing?: () => void;

  onRecordingStateChange?: (isRecording: boolean) => void;

  onProcessingStateChange?: (isProcessing: boolean) => void;

  disabled?: boolean;

  showClearButton?: boolean;

  multiline?: boolean;
  numberOfLines?: number;

  containerStyle?: any;
}

export function VoiceSearchInput({
  value,
  onChangeText,
  placeholder = 'Say or type your request...',
  onSubmitEditing,
  onRecordingStateChange,
  onProcessingStateChange,
  disabled = false,
  showClearButton = true,
  multiline = true,
  numberOfLines = 2,
  containerStyle,
}: VoiceSearchInputProps) {
  /**
   * Local text displayed by the input.
   *
   * This allows voice transcription to appear in real time
   * without directly updating TravelScreen from the recorder
   * callback.
   */
  const [displayText, setDisplayText] = useState(value);

  /**
   * Keep track of whether the local value is currently being
   * changed by voice transcription.
   */
  const isVoiceUpdatingRef = useRef(false);

  /**
   * Keep the latest transcript so it can be committed to
   * the parent after rendering.
   */
  const pendingTranscriptRef = useRef<string | null>(null);

  /**
   * Keep a stable reference to the parent's callback.
   */
  const onChangeTextRef = useRef(onChangeText);

  useEffect(() => {
    onChangeTextRef.current = onChangeText;
  }, [onChangeText]);

  /**
   * Keep local text synchronized with TravelScreen when the
   * user types, clears the input, or the parent otherwise
   * changes the value.
   *
   * We intentionally don't overwrite local voice transcription
   * while recording.
   */
  useEffect(() => {
    if (!isVoiceUpdatingRef.current) {
      setDisplayText(value);
    }
  }, [value]);

  /**
   * -----------------------------------------
   * Recorder callback
   * -----------------------------------------
   */
  const handleRecorderText = useCallback((transcribedText: string) => {
    isVoiceUpdatingRef.current = true;

    /**
     * Real-time update inside VoiceSearchInput.
     */
    setDisplayText(transcribedText);

    /**
     * Remember the latest transcript so we can safely
     * forward it to the parent after the recorder finishes.
     */
    pendingTranscriptRef.current = transcribedText;
  }, []);

  const {
    isRecording,
    isPreparingToListen,
    isTranscribing,
    text,
    startRecording,
    stopRecording,
    volumeLevel,
  } = useAudioRecorder(handleRecorderText);

  /**
   * IMPORTANT:
   *
   * This callback is ONLY used to tell TravelScreen that
   * voice processing is still happening.
   *
   * It does NOT control the visible processing label.
   *
   * TravelScreen owns that label and displays it only when
   * determineBookingIntent() starts.
   */
  const isProcessing = isTranscribing;

  /**
   * -----------------------------------------
   * Recording state
   * -----------------------------------------
   */
  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  /**
   * -----------------------------------------
   * Processing state
   * -----------------------------------------
   */
  useEffect(() => {
    onProcessingStateChange?.(isProcessing);
  }, [isProcessing, onProcessingStateChange]);

  /**
   * -----------------------------------------
   * Sync final transcription to parent
   * -----------------------------------------
   */
  useEffect(() => {
    if (!isRecording && !isPreparingToListen && !isTranscribing) {
      const pendingText = pendingTranscriptRef.current;

      if (pendingText !== null) {
        pendingTranscriptRef.current = null;

        isVoiceUpdatingRef.current = false;

        if (pendingText.trim()) {
          onChangeTextRef.current(pendingText);
        }
      }
    }
  }, [isRecording, isPreparingToListen, isTranscribing]);

  /**
   * -----------------------------------------
   * Microphone
   * -----------------------------------------
   */
  const handleMicPress = useCallback(async () => {
    if (disabled) {
      return;
    }

    try {
      if (isRecording) {
        await stopRecording();
        return;
      }

      /**
       * Starting a new recording replaces the previous
       * prompt.
       */
      pendingTranscriptRef.current = null;
      isVoiceUpdatingRef.current = true;

      setDisplayText('');

      /**
       * Parent update happens from an event handler,
       * so this is safe.
       */
      onChangeTextRef.current('');

      await startRecording();
    } catch (error) {
      console.error('VoiceSearchInput recording error:', error);
    }
  }, [disabled, isRecording, startRecording, stopRecording]);

  /**
   * -----------------------------------------
   * Text input
   * -----------------------------------------
   */
  const handleTextChange = useCallback((newText: string) => {
    isVoiceUpdatingRef.current = false;
    pendingTranscriptRef.current = null;

    setDisplayText(newText);

    /**
     * This is triggered by a user event, so updating
     * TravelScreen here is safe.
     */
    onChangeTextRef.current(newText);
  }, []);

  /**
   * -----------------------------------------
   * Clear
   * -----------------------------------------
   */
  const handleClear = useCallback(() => {
    if (disabled || isRecording) {
      return;
    }

    isVoiceUpdatingRef.current = false;
    pendingTranscriptRef.current = null;

    setDisplayText('');

    onChangeTextRef.current('');
  }, [disabled, isRecording]);

  return (
    <View
      style={[
        styles.searchBox,
        screenStyles.searchBoxLayout,
        isRecording && screenStyles.recordingSearchBox,
        disabled && screenStyles.disabledSearchBox,
        containerStyle,
      ]}
    >
      {/* ---------------------------------- */}
      {/* Text Input */}
      {/* ---------------------------------- */}

      <View style={screenStyles.inputRow}>
        <TextInput
          style={[styles.searchInput, screenStyles.recordingInput]}
          placeholder={
            isPreparingToListen
              ? 'Getting ready to listen...'
              : isRecording || isTranscribing
              ? 'Listening...'
              : placeholder
          }
          placeholderTextColor="#8A95A6"
          value={displayText}
          onChangeText={handleTextChange}
          editable={!disabled && !isRecording && !isProcessing}
          returnKeyType="search"
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? 'top' : 'center'}
          onSubmitEditing={onSubmitEditing}
        />

        {!isRecording &&
          !isProcessing &&
          showClearButton &&
          displayText.trim().length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              style={screenStyles.closeButton}
              hitSlop={8}
              disabled={disabled}
            >
              <Ionicons name="close-circle" size={20} color="#8A95A6" />
            </TouchableOpacity>
          )}
      </View>

      {/* ---------------------------------- */}
      {/* Waveform + Mic */}
      {/* ---------------------------------- */}

      <View style={screenStyles.bottomRow}>
        {isRecording ? (
          <View style={screenStyles.waveformWrapper}>
            <AudioWaveform volume={volumeLevel} isRecording={isRecording} />
          </View>
        ) : (
          <View style={screenStyles.emptyWaveformSpace} />
        )}

        <TouchableOpacity
          onPress={handleMicPress}
          style={screenStyles.micButton}
          hitSlop={8}
          disabled={disabled}
        >
          <Ionicons
            name={isRecording ? 'stop-circle-outline' : 'mic'}
            size={isRecording ? 30 : 20}
            color={disabled ? '#9CA3AF' : '#000'}
            style={
              !isRecording
                ? {
                    marginBottom: 2,
                  }
                : undefined
            }
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const screenStyles = StyleSheet.create({
  searchBoxLayout: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingVertical: 8,
  },

  recordingSearchBox: {
    minHeight: 130,
    paddingVertical: 10,
  },

  disabledSearchBox: {
    opacity: 0.6,
  },

  inputRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },

  recordingInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 60,
  },

  closeButton: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
    flexShrink: 0,
  },

  bottomRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    marginTop: 4,
  },

  waveformWrapper: {
    flex: 1,
    height: 56,
    justifyContent: 'center',
    alignItems: 'stretch',
    overflow: 'hidden',
    minWidth: 0,
  },

  emptyWaveformSpace: {
    flex: 1,
    minWidth: 0,
  },

  micButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
});
