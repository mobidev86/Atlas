import React, { useState } from 'react';
import { View, TextInput, Text, ActivityIndicator } from 'react-native';
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

export function TravelScreen({ onBook }: TravelScreenProps) {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>(DEFAULT_RESULTS);

  const handleSearch = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    const { results: searchResults } = await TravelService.searchTravel(
      prompt,
      user?.travelPreferences || { seatType: 'aisle', minHotelRating: 4, cabinClass: 'business' }
    );
    setLoading(false);
    if (searchResults.length > 0) {
      setResults(searchResults);
    }
  };

  const handleBookItem = (title: string, price: string) => {
    const provider = title.includes('Emirates') || title.includes('Flight') ? 'Amadeus API' : 'Booking.com API';
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
        />
      </View>
      <PrimaryButton
        text={loading ? '✦ Searching flights & hotels...' : '✦ Find options'}
        onPress={handleSearch}
        fullWidth
      />

      {loading && <ActivityIndicator size="large" color="#1E293B" style={{ marginVertical: 16 }} />}

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
