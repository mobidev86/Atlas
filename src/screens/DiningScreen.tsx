import React, { useState } from 'react';
import { View, TextInput, ActivityIndicator } from 'react-native';
import styles from '../styles/styles';
import { ResultCard, PrimaryButton } from '../components';
import { DiningService } from '../services/diningService';
import { SearchResult } from '../types';
import { useAuth } from '../context/AuthContext';

interface DiningScreenProps {
  onBook: (item: string, provider: string, price: string) => void;
}

const DEFAULT_DINING_RESULTS: SearchResult[] = [
  {
    title: 'Le Bernardin',
    meta: 'French Fine Dining · Quiet · 0.4mi',
    price: '$$$$ · 7:30 PM',
    badges: ['QUIET AMBIANCE', 'NO SHELLFISH MATCHED'],
  },
  {
    title: 'Gramercy Tavern',
    meta: 'American Contemporary · Low noise · 0.8mi',
    price: '$$$ · 8:00 PM',
    badges: ['OPENTABLE', 'EXECUTIVE RECOMMENDED'],
  },
];

export function DiningScreen({ onBook }: DiningScreenProps) {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>(DEFAULT_DINING_RESULTS);

  const handleSearch = async () => {
    setLoading(true);
    const { results: searchResults } = await DiningService.searchDining(
      prompt || 'Quiet spot for a business lunch nearby',
      user?.diningPreferences || { ambiance: 'quiet', dietaryRestrictions: ['no shellfish'] }
    );
    setLoading(false);
    if (searchResults.length > 0) {
      setResults(searchResults);
    }
  };

  const handleReserve = (title: string, price: string) => {
    const provider = title.includes('Bernardin') ? 'Yelp Fusion API' : 'OpenTable API';
    onBook(title, provider, price);
  };

  return (
    <View>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Quiet spot for a business lunch nearby"
          placeholderTextColor="#8A95A6"
          value={prompt}
          onChangeText={setPrompt}
          onSubmitEditing={handleSearch}
        />
      </View>
      <PrimaryButton
        text={loading ? '✦ Finding nearby tables...' : '✦ Find nearby'}
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
          onPress={() => handleReserve(item.title, item.price)}
        />
      ))}
    </View>
  );
}
