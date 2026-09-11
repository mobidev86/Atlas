import React, { useState } from 'react';
import { View, ScrollView, Text } from 'react-native';

import styles from '../styles/styles';
import { PrimaryButton } from '../components';
import { VoiceSearchInput } from '../components/VoiceSearchInput';
import { NylasService } from '../services/nylasService';
import { EmailMessage } from '../types';

interface ReplyScreenProps {
  email: EmailMessage;
  onSend: () => void;
}

export function ReplyScreen({ email, onSend }: ReplyScreenProps) {
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);

  /**
   * -----------------------------------------
   * Voice processing state
   * -----------------------------------------
   */
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);

  /**
   * -----------------------------------------
   * Recording state
   * -----------------------------------------
   */
  const handleRecordingStateChange = (isRecording: boolean) => {
    // VoiceSearchInput manages the actual recording.
    // We keep this callback available so the screen
    // can react to recording state later if needed.
    console.log('Reply recording state:', isRecording);
  };

  /**
   * -----------------------------------------
   * Processing state
   * -----------------------------------------
   */
  const handleProcessingStateChange = (isProcessing: boolean) => {
    setIsVoiceProcessing(isProcessing);
  };

  /**
   * -----------------------------------------
   * Reply input submit
   * -----------------------------------------
   *
   * The user's typed/voice reply instruction is kept
   * in `prompt`.
   *
   * AI draft generation will be handled through the
   * appropriate Supabase Edge Function rather than
   * calling AIService directly from this screen.
   */
  const handleSubmitEditing = () => {
    if (!prompt.trim() || isVoiceProcessing) {
      return;
    }

    // Intentionally no AIService call here.
    //
    // The prompt is already available in state and can
    // be sent to the Reply Edge Function when that flow
    // is integrated.
  };

  /**
   * -----------------------------------------
   * Send reply
   * -----------------------------------------
   */
  const handleSendDraft = async () => {
    if (!prompt.trim() || sending) {
      return;
    }

    setSending(true);

    try {
      const replySubject = email.subject.startsWith('Re:')
        ? email.subject
        : `Re: ${email.subject}`;

      await NylasService.sendEmailDraft(
        email.senderEmail,
        replySubject,
        prompt,
      );

      onSend();
    } catch (error) {
      console.error('Failed to send reply:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.replyScreenContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ---------------------------------- */}
      {/* Email summary */}
      {/* ---------------------------------- */}

      <View style={styles.bubbleCard}>
        <Text style={styles.bubbleText}>{email.summary}</Text>
      </View>

      {/* ---------------------------------- */}
      {/* Voice / text reply input */}
      {/* ---------------------------------- */}

      <VoiceSearchInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Say or type your reply..."
        onSubmitEditing={handleSubmitEditing}
        onRecordingStateChange={handleRecordingStateChange}
        onProcessingStateChange={handleProcessingStateChange}
        showClearButton
        multiline
        numberOfLines={3}
        disabled={sending}
      />

      {/* ---------------------------------- */}
      {/* Current reply */}
      {/* ---------------------------------- */}

      <View style={styles.draftBoxEnhanced}>
        <Text style={styles.replyLabel}>Reply</Text>

        <Text style={styles.replyCopy}>
          {prompt || 'Your reply will appear here.'}
        </Text>

        <View style={styles.draftStatus}>
          <Text style={styles.draftStatusDot}>●</Text>

          <Text style={styles.draftStatusText}>Ready to send</Text>
        </View>
      </View>

      {/* ---------------------------------- */}
      {/* Send */}
      {/* ---------------------------------- */}

      <PrimaryButton
        text={sending ? 'Sending via Nylas...' : 'Send reply →'}
        onPress={handleSendDraft}
        fullWidth
      />
    </ScrollView>
  );
}
