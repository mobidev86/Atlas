import React, { useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  Linking,
  StyleSheet,
  Alert,
  Text,
} from 'react-native';
import { ResultCard, PrimaryButton } from '../components';
import { VoiceSearchInput } from '../components/VoiceSearchInput';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { InAppWebView } from '../components/InAppWebview';
import GetLocation from 'react-native-get-location';

interface DiningScreenProps {
  onBook: (item: string, provider: string, price: string) => void;
}

interface RestaurantRecommendation {
  rank: number;
  label: string;
  reason: string;
  placeId: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  priceLevelLabel: string | null;
  openNow: boolean | null;
  distanceMeters: number | null;
  distanceKm: number | null;
  travelMinutes: number | null;
  websiteUri: string | null;
  googleMapsUri: string | null;
  editorialSummary: string | null;
}

interface DiningRecommendationResponse {
  success: boolean;

  intent?: {
    cuisine: string | null;
    locationText: string | null;
    maxDistanceKm: number | null;
    maxTravelMinutes: number | null;
    minRating: number | null;
    priceLevels: string[];
    occasion: string | null;
    openNow: boolean;
    meal: string | null;
    preferences: string[];
  };

  search?: {
    query: string;
    resultCount: number;
    suitableResultCount: number;
    dataSource: 'google_places' | 'fallback_sample' | string;
    googleError?: string;
  };

  recommendations?: RestaurantRecommendation[];

  error?: string;
}

export function DiningScreen({ onBook }: DiningScreenProps) {
  const { user } = useAuth();

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [recommendations, setRecommendations] = useState<
    RestaurantRecommendation[]
  >([]);

  const [showMapWebView, setShowMapWebView] = useState(false);
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  const [searchSource, setSearchSource] = useState<
    'google_places' | 'fallback_sample' | null
  >(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    GetLocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 60000,
    })
      .then(location => {
        setLatitude(location.latitude);
        setLongitude(location.longitude);
      })
      .catch(error => {
        const { code, message } = error;
        console.warn(code, message);
      });
  };

  const handleSearch = async () => {
    if (loading) {
      return;
    }

    const searchPrompt = prompt.trim() || 'Find me a good restaurant nearby';

    setLoading(true);
    setRecommendations([]);
    setSearchSource(null);

    try {
      const diningPreferences = user?.diningPreferences || null;

      const { data, error } = await supabase.functions.invoke(
        'recommend-restaurant',
        {
          body: {
            prompt: searchPrompt,
            diningPreferences,
          },
        },
      );

      if (error) {
        console.error('recommend-restaurant Edge Function error:', error);

        throw new Error(
          error.message || 'Unable to find restaurant recommendations.',
        );
      }

      if (!data) {
        throw new Error(
          'The restaurant recommendation service returned no data.',
        );
      }

      const response = data as DiningRecommendationResponse;

      console.log(
        'recommend-restaurant response:',
        JSON.stringify(response, null, 2),
      );

      if (!response.success) {
        throw new Error(
          response.error || 'Unable to find restaurant recommendations.',
        );
      }

      const returnedRecommendations = Array.isArray(response.recommendations)
        ? response.recommendations
        : [];

      setRecommendations(returnedRecommendations);

      const source = response.search?.dataSource;

      if (source === 'fallback_sample') {
        setSearchSource('fallback_sample');
      } else if (source === 'google_places') {
        setSearchSource('google_places');
      }

      if (response.search?.googleError) {
        console.warn(
          'Google Places search error:',
          response.search.googleError,
        );
      }
    } catch (error) {
      console.error('Dining search error:', error);

      setRecommendations([]);
      setSearchSource(null);

      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while searching for restaurants.';

      Alert.alert('Unable to find restaurants', message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewOnMap = (recommendation: RestaurantRecommendation) => {
    if (recommendation.googleMapsUri) {
      setMapUrl(recommendation.googleMapsUri);
      setShowMapWebView(true);
      return;
    }

    if (recommendation.latitude != null && recommendation.longitude != null) {
      const url = `https://www.google.com/maps/search/?api=1&query=${recommendation.latitude},${recommendation.longitude}`;

      setMapUrl(url);
      setShowMapWebView(true);
    }
  };

  const handleOpenWebsite = async (
    recommendation: RestaurantRecommendation,
  ) => {
    if (!recommendation.websiteUri) {
      return;
    }

    try {
      const supported = await Linking.canOpenURL(recommendation.websiteUri);

      if (!supported) {
        Alert.alert(
          'Unable to open website',
          'The restaurant website could not be opened.',
        );

        return;
      }

      await Linking.openURL(recommendation.websiteUri);
    } catch (error) {
      console.error('Unable to open restaurant website:', error);

      Alert.alert(
        'Unable to open website',
        'Something went wrong while opening the restaurant website.',
      );
    }
  };

  return (
    <View>
      <VoiceSearchInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Quiet spot for a business lunch nearby"
        onSubmitEditing={handleSearch}
        showClearButton
        multiline
        numberOfLines={2}
      />

      <PrimaryButton
        text={loading ? '✦ Finding restaurants...' : '✦ Find nearby'}
        onPress={handleSearch}
        fullWidth
      />

      {loading && (
        <View style={screenStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E293B" />

          <Text style={screenStyles.loadingText}>
            Finding the best restaurant options for you...
          </Text>
        </View>
      )}

      {!loading && recommendations.length === 0 && prompt.trim().length > 0 && (
        <View style={screenStyles.emptyContainer}>
          <Text style={screenStyles.emptyTitle}>
            No matching restaurants found
          </Text>

          <Text style={screenStyles.emptyText}>
            Try changing your cuisine, location, rating, price, or other
            requirements.
          </Text>
        </View>
      )}

      {!loading &&
        recommendations.map((recommendation, index) => {
          const metaParts: string[] = [];

          if (recommendation.rating !== null) {
            metaParts.push(`★ ${recommendation.rating.toFixed(1)}`);
          }

          if (
            recommendation.userRatingCount !== null &&
            recommendation.userRatingCount > 0
          ) {
            metaParts.push(
              `${recommendation.userRatingCount.toLocaleString()} reviews`,
            );
          }

          if (recommendation.travelMinutes !== null) {
            metaParts.push(`${recommendation.travelMinutes} min`);
          } else if (recommendation.distanceKm !== null) {
            metaParts.push(`${recommendation.distanceKm.toFixed(2)} km`);
          }

          if (recommendation.openNow === true) {
            metaParts.push('Open now');
          } else if (recommendation.openNow === false) {
            metaParts.push('Closed now');
          }

          if (recommendation.address) {
            metaParts.push(recommendation.address);
          }

          const meta =
            metaParts.length > 0
              ? metaParts.join(' · ')
              : 'Restaurant recommendation';

          const price = recommendation.priceLevelLabel || '';

          const badges: string[] = [];

          if (recommendation.label) {
            badges.push(recommendation.label.toUpperCase());
          }

          if (recommendation.openNow === true) {
            badges.push('OPEN NOW');
          }

          const summary = recommendation.editorialSummary;

          return (
            <View
              key={recommendation.placeId || `${recommendation.name}-${index}`}
              style={screenStyles.cardContainer}
            >
              <ResultCard
                title={recommendation.name}
                meta={meta}
                price={price}
                badges={badges}
                reason={recommendation.reason}
                onViewMap={() => handleViewOnMap(recommendation)}
              />

              {!!summary && (
                <Text style={screenStyles.summaryText} numberOfLines={3}>
                  {summary}
                </Text>
              )}

              {recommendation.websiteUri && (
                <View style={screenStyles.websiteRow}>
                  <Text style={screenStyles.websiteText}>
                    Restaurant website available
                  </Text>

                  <Text
                    style={screenStyles.websiteLink}
                    onPress={() => handleOpenWebsite(recommendation)}
                  >
                    Visit
                  </Text>
                </View>
              )}
            </View>
          );
        })}

      <InAppWebView
        visible={showMapWebView}
        url={mapUrl}
        title="Map"
        onClose={() => {
          setShowMapWebView(false);
          setMapUrl(null);
        }}
      />
    </View>
  );
}

const screenStyles = StyleSheet.create({
  cardContainer: {
    width: '100%',
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },

  summaryText: {
    marginHorizontal: 12,
    marginBottom: 10,
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
  },

  websiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 12,
  },

  websiteText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
  },

  websiteLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 30,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },

  emptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
    textAlign: 'center',
  },
});
