import React, { useState } from 'react';
import { View, ScrollView, Pressable, Text, ActivityIndicator } from 'react-native';
import styles from '../styles/styles';
import { PrimaryButton } from '../components';
import { VoiceService } from '../services/voiceService';
import { AIService } from '../services/aiService';
import { NylasService } from '../services/nylasService';

interface ReplyScreenProps {
  onSend: () => void;
}

export function ReplyScreen({ onSend }: ReplyScreenProps) {
  const [isListening, setIsListening] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiDraft, setAiDraft] = useState(
    "Hi Sarah, thanks for the update — the revised payment terms work on our end. Let's plan to finalize by Friday as proposed."
  );

  const waveform = Array.from({ length: 24 }, (_, i) => ({
    height: Math.sin((i / 24) * Math.PI * 2) * 12 + 16,
    key: i,
  }));

  const handleMicToggle = async () => {
    if (!isListening) {
      setIsListening(true);
      await VoiceService.startRecording();
    } else {
      setIsListening(false);
      setLoadingDraft(true);
      const { transcript } = await VoiceService.stopAndTranscribe();
      if (transcript) {
        const generatedDraft = await AIService.generatePolishedReply(
          'Q3 Board Deck Review & Timeline',
          'Hi Omar, attached is the revised slide deck for next week’s board meeting. Please confirm slide 4 budget projections.',
          transcript
        );
        setAiDraft(generatedDraft);
      }
      setLoadingDraft(false);
    }
  };

  const handleSendDraft = async () => {
    setSending(true);
    await NylasService.sendEmailDraft('sarah.kim@acme.com', 'Re: Q3 Board Deck Review & Timeline', aiDraft);
    setSending(false);
    onSend();
  };

  return (
    <ScrollView contentContainerStyle={styles.replyScreenContent} showsVerticalScrollIndicator={false}>
      <View style={styles.bubbleCard}>
        <Text style={styles.bubbleText}>
          Hi — can we finalize the contract terms by Friday? Let me know if the revised clause on
          payment terms works for you.
        </Text>
      </View>

      <Text style={styles.centerLabel}>Dictate your reply</Text>

      <Pressable style={styles.micRingLarge} onPress={handleMicToggle}>
        {isListening && (
          <View style={styles.waveformContainer}>
            {waveform.map(bar => (
              <View key={bar.key} style={[styles.waveformBar, { height: bar.height }]} />
            ))}
          </View>
        )}
        <Text style={styles.micIconLarge}>🎤</Text>
      </Pressable>

      <Text style={styles.hintText}>{isListening ? 'Listening... Tap to process' : 'Tap to dictate'}</Text>

      <View style={styles.draftBoxEnhanced}>
        <Text style={styles.replyLabel}>AI-drafted reply</Text>
        {loadingDraft ? (
          <ActivityIndicator size="small" color="#1E293B" style={{ marginVertical: 12 }} />
        ) : (
          <Text style={styles.replyCopy}>{aiDraft}</Text>
        )}
        <View style={styles.draftStatus}>
          <Text style={styles.draftStatusDot}>●</Text>
          <Text style={styles.draftStatusText}>Ready to send (Zero-retention mode)</Text>
        </View>
      </View>

      <PrimaryButton
        text={sending ? 'Sending via Nylas...' : 'Send reply →'}
        onPress={handleSendDraft}
        fullWidth
      />
    </ScrollView>
  );
}
