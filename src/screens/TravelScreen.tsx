import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useVoice, VoiceMode } from 'react-native-voicekit';
import styles from '../styles/styles';
import { ResultCard, PrimaryButton } from '../components';
import { TravelService } from '../services/travelService';
import { SearchResult } from '../types';
import { useAuth } from '../context/AuthContext';

interface TravelScreenProps {
  onBook: (item: string, provider: string, price: string) => void;
}

const DEFAULT_RESULTS: SearchResult[] = [
  {
    title: 'Emirates EK 0202 — Business Class',
    meta: 'JFK → DXB · Aug 4 · 12h30m',
    price: '$3,420',
    badges: ['AISLE SEAT MATCHED', 'BUSINESS CLASS'],
  },
  {
    title: 'The Ritz-Carlton, Dubai',
    meta: '4.9★ · Executive Suite · JBR',
    price: '$650 / night',
    badges: ['5-STAR RATING', 'FREE CANCELLATION'],
  },
];

// Cap a single voice request at 60s — generous for a detailed request
// ("suggest a summer vacation for 2-3 days, budget X, preference Y")
// while staying well under upload/file-size limits if this later routes
// through any cloud transcription fallback.
const MAX_LISTEN_MS = 60_000;

export function TravelScreen({ onBook }: TravelScreenProps) {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>(DEFAULT_RESULTS);
  const [hasSearched, setHasSearched] = useState(false);
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { available, listening, transcript, startListening, stopListening } =
    useVoice({
      locale: 'en-US',
      mode: VoiceMode.Continuous,
      enablePartialResults: true,
    });

  // Mirror the live transcript into the editable prompt field while listening,
  // so the user sees their sentence forming in real time (Wispr-Flow style)
  // and can still edit it after they stop talking.
  useEffect(() => {
    if (listening) {
      setPrompt(transcript);
    }
  }, [transcript, listening]);

  const handleMicPress = () => {
    if (listening) {
      stopListening();
      if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
      return;
    }
    setPrompt('');
    startListening();
    autoStopTimer.current = setTimeout(() => {
      stopListening();
    }, MAX_LISTEN_MS);
  };

  useEffect(() => {
    return () => {
      if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    };
  }, []);

  const handleSearch = async () => {
    if (!prompt.trim()) return;
    if (listening) stopListening();
    setLoading(true);
    setHasSearched(true);
    try {
      const { results: searchResults, error } =
        await TravelService.searchTravel(
          prompt,
          user?.travelPreferences || {
            seatType: 'aisle',
            minHotelRating: 4,
            cabinClass: 'business',
          },
        );
      if (error) {
        setResults([]);
      } else {
        setResults(searchResults);
      }
    } catch (err) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBookItem = (title: string, price: string) => {
    const provider =
      title.includes('Emirates') || title.includes('Flight')
        ? 'Amadeus API'
        : 'Booking.com API';
    onBook(title, provider, price);
  };

  return (
    <View>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Say or type: 'Flight to Dubai next Tuesday'"
          placeholderTextColor="#8A95A6"
          value={prompt}
          onChangeText={setPrompt}
          onSubmitEditing={handleSearch}
          editable={!listening}
        />
        {available && (
          <TouchableOpacity onPress={handleMicPress} style={{ padding: 8 }}>
            <Text style={{ fontSize: 20 }}>{listening ? '⏹' : '🎙'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {listening && (
        <Text style={{ color: '#8A95A6', marginBottom: 8 }}>Listening…</Text>
      )}
      {!available && (
        <Text style={{ color: '#8A95A6', marginBottom: 8 }}>
          Voice input isn't available on this device — you can still type your
          request.
        </Text>
      )}

      <PrimaryButton
        text={loading ? '✦ Searching flights & hotels...' : '✦ Find options'}
        onPress={handleSearch}
        fullWidth
      />

      {loading && (
        <ActivityIndicator
          size="large"
          color="#1E293B"
          style={{ marginVertical: 16 }}
        />
      )}

      {!loading && hasSearched && results.length === 0 && (
        <Text style={{ marginTop: 16, color: '#8A95A6' }}>
          No matching flights or hotels found — try adjusting your request.
        </Text>
      )}

      {results.map((item, idx) => (
        <ResultCard
          key={idx}
          title={item.title}
          meta={item.meta}
          price={item.price}
          badges={item.badges}
          onPress={() => handleBookItem(item.title, item.price)}
        />
      ))}
    </View>
  );
}
