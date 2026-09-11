import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { InboxCard } from '../components';
import { VoiceSearchInput } from '../components/VoiceSearchInput';
import { EmailMessage } from '../types';
import { EmailActionableStore } from '../services/emailActionableStore';
import { EmailAnalysisService } from '../services/emailAnalysisService';
import { NotificationService } from '../services/notificationService';

interface InboxScreenProps {
  onOpenReply: (email: EmailMessage) => void;
}

export function InboxScreen({ onOpenReply }: InboxScreenProps) {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState('Not checked');
  const [prompt, setPrompt] = useState('');

  const [isRecording, setIsRecording] = useState(false);

  /**
   * Tracks whether the Inbox screen is currently active.
   */
  const isInboxFocused = useIsFocused();

  const isInboxFocusedRef = useRef(isInboxFocused);

  /**
   * Used to detect the transition:
   *
   * recording -> stopped
   */
  const wasRecordingRef = useRef(false);

  /**
   * Prevent the same voice request from being
   * processed more than once.
   */
  const processedPromptRef = useRef('');

  /**
   * -----------------------------------------
   * Track Inbox screen focus
   * -----------------------------------------
   */
  useEffect(() => {
    isInboxFocusedRef.current = isInboxFocused;

    console.log('Inbox screen focus:', isInboxFocused ? 'ACTIVE' : 'INACTIVE');

    return () => {
      isInboxFocusedRef.current = false;
    };
  }, [isInboxFocused]);

  /**
   * -----------------------------------------
   * Recording state
   * -----------------------------------------
   */
  const handleRecordingStateChange = (recording: boolean) => {
    setIsRecording(recording);

    if (recording) {
      wasRecordingRef.current = true;
    }
  };

  /**
   * -----------------------------------------
   * Check emails
   * -----------------------------------------
   *
   * Fetch -> Triage -> Store
   *
   * The actual email analysis is handled by
   * EmailAnalysisService so it can later continue
   * even when this screen is no longer active.
   */
  const checkEmails = async () => {
    try {
      setLoading(true);

      console.log('========================================');
      console.log('CHECKING EMAILS');
      console.log('========================================');

      await EmailAnalysisService.analyseEmails();

      const actionableCount = EmailActionableStore.getEmails().length;

      if (!isInboxFocusedRef.current && actionableCount > 0) {
        console.log(
          'Inbox is inactive. Showing actionable email notification:',
          actionableCount,
        );

        await NotificationService.showActionableEmailNotification(
          actionableCount,
        );
      }

      /**
       * IMPORTANT:
       *
       * The actionable emails are intentionally
       * NOT displayed immediately.
       */

      setLastSynced(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );

      if (!isInboxFocusedRef.current) {
        console.log('EMAIL ANALYSIS COMPLETE AFTER LEAVING INBOX');
      } else {
        console.log('EMAIL ANALYSIS COMPLETE WHILE INBOX IS ACTIVE');
      }

      console.log('========================================');
      console.log('EMAIL CHECK COMPLETE');
      console.log('========================================');
    } catch (error) {
      console.error('CHECK EMAILS EXCEPTION:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * -----------------------------------------
   * Listen for changes to the global store
   * -----------------------------------------
   */
  useEffect(() => {
    const unsubscribe = EmailActionableStore.subscribe(() => {
      /**
       * The store represents pending actionable
       * emails. The user must explicitly tap
       * "View now".
       */
    });

    return unsubscribe;
  }, []);

  /**
   * -----------------------------------------
   * Reveal actionable emails
   * -----------------------------------------
   */
  const handleViewActionableEmails = () => {
    const actionableEmails = EmailActionableStore.getEmails();

    setEmails(actionableEmails);
  };

  /**
   * -----------------------------------------
   * Detect voice recording completion
   * -----------------------------------------
   */
  useEffect(() => {
    console.log('VOICE EFFECT:', {
      isRecording,
      prompt,
      wasRecording: wasRecordingRef.current,
    });

    if (isRecording) {
      return;
    }

    if (!wasRecordingRef.current) {
      return;
    }

    if (!prompt.trim()) {
      wasRecordingRef.current = false;
      return;
    }

    if (processedPromptRef.current === prompt.trim()) {
      wasRecordingRef.current = false;
      return;
    }

    const searchPrompt = prompt.trim().toLowerCase();

    if (searchPrompt.includes('check') && searchPrompt.includes('email')) {
      processedPromptRef.current = prompt.trim();

      wasRecordingRef.current = false;

      checkEmails();
    }
  }, [isRecording, prompt]);

  /**
   * -----------------------------------------
   * Typed input submission
   * -----------------------------------------
   */
  const handleSearch = () => {
    const searchPrompt = prompt.trim();

    if (!searchPrompt) {
      return;
    }

    console.log('Inbox voice/text search:', searchPrompt);

    const normalizedPrompt = searchPrompt.toLowerCase();

    if (
      normalizedPrompt.includes('check') &&
      normalizedPrompt.includes('email')
    ) {
      processedPromptRef.current = searchPrompt;

      checkEmails();
      return;
    }

    console.log('Inbox command not supported yet:', searchPrompt);
  };

  const pendingActionableCount = EmailActionableStore.getEmails().length;

  return (
    <View>
      <VoiceSearchInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Check my email"
        onSubmitEditing={handleSearch}
        onRecordingStateChange={handleRecordingStateChange}
        showClearButton
        multiline
        numberOfLines={2}
      />

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          paddingHorizontal: 4,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            color: '#64748B',
            fontWeight: '500',
          }}
        >
          Nylas Sync · {lastSynced}
        </Text>
      </View>

      {loading ? (
        <View
          style={{
            alignItems: 'center',
            marginVertical: 24,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              color: '#64748B',
              fontWeight: '500',
            }}
          >
            Analysing your emails…
          </Text>
        </View>
      ) : emails.length > 0 ? (
        emails.map(email => (
          <InboxCard
            key={email.id}
            title={email.senderName}
            subtitle={email.subject}
            message={email.summary}
            isActive={email.priority === 'high'}
            isPriority={email.priority === 'high'}
            onPress={() => onOpenReply(email)}
          />
        ))
      ) : pendingActionableCount > 0 ? (
        <Pressable
          onPress={handleViewActionableEmails}
          style={{
            marginTop: 12,
            marginBottom: 24,
            marginHorizontal: 4,
            paddingHorizontal: 20,
            paddingVertical: 18,
            borderRadius: 16,
            backgroundColor: '#F1F5F9',
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: '#E2E8F0',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: '#1E293B',
                }}
              >
                {pendingActionableCount}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: '#1E293B',
                  marginBottom: 4,
                }}
              >
                You have {pendingActionableCount} email
                {pendingActionableCount === 1 ? '' : 's'} that need your
                attention
              </Text>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#475569',
                }}
              >
                View now →
              </Text>
            </View>
          </View>
        </Pressable>
      ) : (
        <Text
          style={{
            textAlign: 'center',
            color: '#64748B',
            marginVertical: 24,
          }}
        >
          No emails requiring action.
        </Text>
      )}
    </View>
  );
}
