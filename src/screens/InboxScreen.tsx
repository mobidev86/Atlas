import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { InboxCard } from '../components';
import { NylasService } from '../services/nylasService';
import { EmailMessage } from '../types';

interface InboxScreenProps {
  onOpenReply: () => void;
}

export function InboxScreen({ onOpenReply }: InboxScreenProps) {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState('Syncing...');

  useEffect(() => {
    loadInbox();
  }, []);

  const loadInbox = async () => {
    setLoading(true);
    const { emails: syncedEmails, lastSynced: syncTime } = await NylasService.fetchPriorityInbox();
    setEmails(syncedEmails);
    setLastSynced(syncTime);
    setLoading(false);
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }}>Nylas Sync · {lastSynced}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1E293B" style={{ marginVertical: 24 }} />
      ) : (
        emails.map(email => (
          <InboxCard
            key={email.id}
            title={email.senderName}
            subtitle={email.subject}
            message={email.summary}
            isActive={email.priority === 'high'}
            isPriority={email.priority === 'high'}
            onPress={email.id === 'msg_1' ? onOpenReply : undefined}
          />
        ))
      )}
    </View>
  );
}
