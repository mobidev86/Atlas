import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';

import styles from '../styles/styles';
import { ResultCard, PrimaryButton } from '../components';
import { VoiceSearchInput } from '../components/VoiceSearchInput';
import { BookingCard, UserBooking } from '../components/BookingCard';
import { BookingBridge } from '../components/BookingBridge';
import { InAppWebView } from '../components/InAppWebview';
import { SearchResult, FlightOption, HotelOption } from '../types';
import { useAuth } from '../context/AuthContext';
import Ionicons from '@react-native-vector-icons/ionicons';
import { supabase } from '../services/supabase';
import { MessageToast } from '../services/messageToast';
import { DuffelCheckoutService } from '../services/DuffelCheckoutService';

import {
  DuffelCardForm,
  useDuffelCardFormActions,
} from '@duffel/react-native-components-card-form';

import {
  TravelIntent,
  TravelIntentResponse,
  validateTravelIntent,
} from '../utils/travelIntentValidator';

interface TravelScreenProps {
  onBook: (item: string, provider: string, price: string) => void;
}

interface FlightSearchResponse {
  success: boolean;
  type: 'flight';
  flights: FlightOption[];
}

interface HotelSearchResponse {
  success: boolean;
  type: 'hotel';
  hotels: HotelOption[];
}

type TravelSearchResponse = FlightSearchResponse | HotelSearchResponse;

interface PendingBooking {
  title: string;
  provider: string;
  price: string;
}

const TEST_DUFFEL_OFFER_ID = 'off_0000B9gn5qFoFIiOgejCrc';

export function TravelScreen({ onBook }: TravelScreenProps) {
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchType, setSearchType] = useState<'flight' | 'hotel' | null>(null);

  const [pendingBooking, setPendingBooking] = useState<PendingBooking | null>(
    null,
  );

  const [selectedFlight, setSelectedFlight] = useState<FlightOption | null>(
    null,
  );

  const [componentClientKey, setComponentClientKey] = useState<string | null>(
    null,
  );

  const [showCardForm, setShowCardForm] = useState(false);
  const [cardValid, setCardValid] = useState(false);
  const [creatingCard, setCreatingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const [isDuffelLoading, setIsDuffelLoading] = useState(false);

  const [showInAppWebView, setShowInAppWebView] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const [isFinalizingDuffelBooking, setIsFinalizingDuffelBooking] =
    useState(false);

  /**
   * True while VoiceSearchInput is recording/transcribing.
   *
   * This is NOT the visible "Processing your request..." state.
   */
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);

  /**
   * True ONLY while TravelScreen is executing
   * determineBookingIntent / parseTravelIntent.
   *
   * This is the state that controls the visible
   * "Processing your request..." label.
   */
  const [isIntentProcessing, setIsIntentProcessing] = useState(false);

  /**
   * -----------------------------------------
   * User Bookings
   * -----------------------------------------
   */
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  const { ref: cardFormRef, createCardForTemporaryUse } =
    useDuffelCardFormActions();

  const showError = (message: string, title = 'Error') => {
    MessageToast.error(message, 3000, title);
  };

  const showSuccess = (message: string, title = 'Success') => {
    MessageToast.success(message, 3000, title);
  };

  /**
   * -----------------------------------------
   * Fetch User Bookings
   * -----------------------------------------
   */
  const fetchBookings = useCallback(async () => {
    if (!user?.id) {
      setBookings([]);
      return;
    }

    try {
      setBookingsLoading(true);
      setBookingsError(null);

      const { data, error } = await supabase
        .from('user_bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('FETCH USER BOOKINGS ERROR:', error);
        setBookingsError('Unable to load your bookings.');
        return;
      }

      setBookings((data ?? []) as UserBooking[]);
    } catch (error) {
      console.error('FETCH USER BOOKINGS EXCEPTION:', error);
      setBookingsError('Unable to load your bookings.');
    } finally {
      setBookingsLoading(false);
    }
  }, [user?.id]);

  /**
   * Load bookings when the TravelScreen/user becomes available.
   */
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  /**
   * -----------------------------------------
   * Parse Booking Intent
   * -----------------------------------------
   */
  const parseTravelIntent = async (
    travelPrompt: string,
  ): Promise<TravelIntent | null> => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'parse-booking-intent',
        {
          body: {
            prompt: travelPrompt,
          },
        },
      );

      console.log('PARSE BOOKING INTENT RESPONSE:', data);

      if (error) {
        console.error('PARSE BOOKING INTENT ERROR:', error);

        if ('context' in error && error.context) {
          try {
            const errorBody = await error.context.json();

            console.error('PARSE BOOKING INTENT ERROR BODY:', errorBody);

            showError(
              errorBody?.error || 'Unable to process your travel request.',
              errorBody?.code === 'UNSUPPORTED_TRAVEL_REQUEST'
                ? 'Unsupported Request'
                : 'Travel Error',
            );
          } catch (parseError) {
            console.error('Could not parse error response:', parseError);

            showError('Unable to process your travel request.', 'Travel Error');
          }
        } else {
          showError(
            error.message || 'Unable to process your travel request.',
            'Travel Error',
          );
        }

        return null;
      }

      const response = data as TravelIntentResponse;

      console.log('PARSED BOOKING INTENT:', response);

      if (!response?.success) {
        showError(
          response?.error || 'This travel request is not supported.',
          response?.code === 'UNSUPPORTED_TRAVEL_REQUEST'
            ? 'Unsupported Request'
            : 'Travel Error',
        );

        return null;
      }

      if (!response.intent) {
        showError(
          'Unable to understand your travel request.',
          'Invalid Request',
        );

        return null;
      }

      const validationError = validateTravelIntent(response.intent);

      if (validationError) {
        showError(validationError, 'Missing Information');

        return null;
      }

      return response.intent;
    } catch (error) {
      console.error('PARSE BOOKING INTENT EXCEPTION:', error);

      showError(
        'Something went wrong while processing your travel request.',
        'Travel Error',
      );

      return null;
    }
  };

  /**
   * -----------------------------------------
   * Automatically determine booking CTA
   * -----------------------------------------
   *
   * IMPORTANT:
   *
   * The visible processing state starts ONLY here,
   * immediately before parseTravelIntent().
   *
   * Starting the microphone does NOT show the
   * "Processing your request..." label.
   */
  useEffect(() => {
    const determineBookingIntent = async () => {
      const travelPrompt = prompt.trim();

      if (!travelPrompt || isVoiceProcessing) {
        return;
      }

      setIsIntentProcessing(true);

      try {
        const travelIntent = await parseTravelIntent(travelPrompt);

        if (!travelIntent) {
          setSearchType(null);
          return;
        }

        if (travelIntent.type === 'flight' || travelIntent.type === 'hotel') {
          setSearchType(travelIntent.type);
        } else {
          setSearchType(null);
        }
      } finally {
        setIsIntentProcessing(false);
      }
    };

    determineBookingIntent();
  }, [prompt, isVoiceProcessing]);

  /**
   * -----------------------------------------
   * Convert FlightOption → SearchResult
   * -----------------------------------------
   */
  const mapFlightToSearchResult = (flight: FlightOption): SearchResult => {
    const stopText =
      flight.stops === undefined
        ? undefined
        : flight.stops === 0
        ? 'Non-stop'
        : `${flight.stops} stop${flight.stops === 1 ? '' : 's'}`;

    const cabinText = flight.cabinClass
      ? flight.cabinClass.replace(/_/g, ' ')
      : undefined;

    const metaParts = [
      `${flight.origin} → ${flight.destination}`,
      flight.duration,
      stopText,
      cabinText,
    ].filter(Boolean);

    return {
      title: `${flight.airline} ${flight.flightNumber}`,
      meta: metaParts.join(' · '),
      price: `${flight.currency ?? ''} ${flight.price}`.trim(),
      badges: flight.badge
        ? [flight.badge]
        : cabinText
        ? [cabinText.toUpperCase()]
        : [],
    };
  };

  /**
   * -----------------------------------------
   * Convert HotelOption → SearchResult
   * -----------------------------------------
   */
  const mapHotelToSearchResult = (hotel: HotelOption): SearchResult => {
    const metaParts = [
      hotel.location,
      hotel.rating !== undefined ? `${hotel.rating}★` : undefined,
      hotel.roomType,
    ].filter(Boolean);

    return {
      title: hotel.hotelName,
      meta: metaParts.join(' · '),
      price: `${hotel.pricePerNight} / night`,
      badges: hotel.badge ? [hotel.badge] : [],
    };
  };

  /**
   * -----------------------------------------
   * Search
   * -----------------------------------------
   */
  const handleSearch = async () => {
    const travelPrompt = prompt.trim();

    if (!travelPrompt) {
      showError('Please enter or speak a travel request.', 'Validation');

      return;
    }

    if (loading) {
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setResults([]);

    try {
      const travelIntent = await parseTravelIntent(travelPrompt);

      if (!travelIntent) {
        return;
      }

      if (travelIntent.type === 'flight' || travelIntent.type === 'hotel') {
        setSearchType(travelIntent.type);
      } else {
        setSearchType(null);
      }

      console.log('VALID TRAVEL INTENT:', JSON.stringify(travelIntent));

      const { data, error } = await supabase.functions.invoke('travel-search', {
        body: {
          intent: travelIntent,
        },
      });

      console.log('TRAVEL SEARCH ERROR:', JSON.stringify(error));

      if (error) {
        throw error;
      }

      if (!data?.success) {
        showError(
          data?.error || 'Unable to find travel options.',
          'Travel Search Error',
        );

        return;
      }

      const searchResponse = data as TravelSearchResponse;

      if (searchResponse.type === 'flight') {
        const flightResults = searchResponse.flights.map(
          mapFlightToSearchResult,
        );

        setResults(flightResults);

        if (flightResults.length === 0) {
          showError('No flights were found for your search.', 'No Results');
        }

        return;
      }

      if (searchResponse.type === 'hotel') {
        const hotelResults = searchResponse.hotels.map(mapHotelToSearchResult);

        setResults(hotelResults);

        if (hotelResults.length === 0) {
          showError('No hotels were found for your search.', 'No Results');
        }

        return;
      }

      showError('Unsupported travel search type.', 'Travel Search Error');
    } catch (error) {
      console.error('TRAVEL SEARCH EXCEPTION:', error);

      showError(
        'Something went wrong while processing your travel request.',
        'Travel Error',
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * -----------------------------------------
   * Open Duffel Card Form
   * -----------------------------------------
   */
  const handleOpenCardForm = (flight?: FlightOption) => {
    if (!componentClientKey) {
      showError(
        'Checkout is still initializing. Please try again.',
        'Checkout',
      );

      return;
    }

    if (flight) {
      setSelectedFlight(flight);
    }

    setCardValid(false);
    setCreatingCard(false);
    setCardError(null);
    setShowCardForm(true);
  };

  /**
   * -----------------------------------------
   * Create Temporary Duffel Card
   * -----------------------------------------
   */
  const handleCreateCard = async () => {
    if (creatingCard) {
      return;
    }

    try {
      setCreatingCard(true);
      setCardError(null);

      console.log('Client key exists:', !!componentClientKey);

      createCardForTemporaryUse();
    } catch (error) {
      console.error('DUFFEL CARD: CREATE CARD EXCEPTION');

      setCreatingCard(false);

      let errorMessage = 'Unable to create the temporary card.';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        const possibleError = error as unknown as Record<string, unknown>;

        errorMessage = String(
          possibleError.message ??
            possibleError.error ??
            possibleError.detail ??
            errorMessage,
        );
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      console.error('DUFFEL CARD EXCEPTION MESSAGE:', errorMessage);

      setCardError(errorMessage);
    }
  };

  /**
   * -----------------------------------------
   * Booking
   * -----------------------------------------
   */
  const handleBookItem = (title: string, price: string, index: number) => {
    if (searchType === 'flight') {
      handleOpenCardForm();

      return;
    }

    const provider = 'Duffel Stays';

    setPendingBooking({
      title,
      provider,
      price,
    });
  };

  /**
   * -----------------------------------------
   * Booking Bridge
   * -----------------------------------------
   */
  const handleBridgeComplete = () => {
    if (!pendingBooking) {
      return;
    }

    onBook(pendingBooking.title, pendingBooking.provider, pendingBooking.price);

    setPendingBooking(null);
  };

  /**
   * -----------------------------------------
   * Open Duffel Checkout In-App
   * -----------------------------------------
   */
  const openDuffelCheckout = async (type: 'flight' | 'hotel') => {
    if (isDuffelLoading) {
      return;
    }

    try {
      setIsDuffelLoading(true);

      const result = await DuffelCheckoutService.createSession(type);

      if (!result.success || !result.url) {
        showError(result.error || 'Unable to open Duffel checkout.');

        return;
      }

      console.log('DUFFEL CHECKOUT URL:', result.url);

      setCheckoutUrl(result.url);
      setShowInAppWebView(true);
    } catch (error) {
      console.error('Error opening Duffel checkout:', error);

      showError('Something went wrong while opening Duffel checkout.');
    } finally {
      setIsDuffelLoading(false);
    }
  };

  /**
   * -----------------------------------------
   * Duffel Checkout Callback
   * -----------------------------------------
   */
  const handleDuffelCheckoutNavigation = async (url: string) => {
    const callbackPath = '/functions/v1/duffel-checkout-callback';

    if (!url.includes(callbackPath)) {
      return;
    }

    if (isFinalizingDuffelBooking) {
      return;
    }

    try {
      const callbackUrl = new URL(url);

      const status = callbackUrl.searchParams.get('status');

      const orderId = callbackUrl.searchParams.get('order_id');

      const reference = callbackUrl.searchParams.get('reference');

      console.log('========== DUFFEL CHECKOUT RESULT ==========');

      console.log('STATUS:', status);
      console.log('ORDER ID:', orderId);
      console.log('REFERENCE:', reference);

      if (status === 'success') {
        if (!orderId || !reference) {
          console.error('Duffel callback missing order_id or reference.');

          setShowInAppWebView(false);
          setCheckoutUrl(null);

          showError('Unable to finalize your booking.');

          return;
        }

        setIsFinalizingDuffelBooking(true);

        console.log('Calling duffel-checkout-callback...');

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        console.log('Duffel callback HTTP status:', response.status);

        const result = await response.json();

        console.log('Duffel callback response:', result);

        if (!response.ok || !result?.success) {
          console.error('Duffel booking finalization failed:', result);

          setIsFinalizingDuffelBooking(false);

          setShowInAppWebView(false);
          setCheckoutUrl(null);

          showError(result?.error ?? 'Unable to finalize your booking.');

          return;
        }

        console.log('========== DUFFEL BOOKING FINALIZED ==========');

        console.log('ORDER ID:', result.order_id);

        console.log('BOOKING REFERENCE:', result.booking_reference);

        console.log('SOURCE:', result.source);

        console.log('DESTINATION:', result.destination);

        setIsFinalizingDuffelBooking(false);

        setShowInAppWebView(false);
        setCheckoutUrl(null);

        await fetchBookings();

        showSuccess('Your booking was completed successfully.');

        return;
      }

      if (status === 'failure') {
        console.log('Duffel checkout failed.');

        setShowInAppWebView(false);
        setCheckoutUrl(null);

        showError('The booking could not be completed.');

        return;
      }

      if (status === 'abandoned') {
        console.log('Duffel checkout abandoned.');

        setShowInAppWebView(false);
        setCheckoutUrl(null);

        showError('The checkout was cancelled.');

        return;
      }

      console.warn('Unknown Duffel callback status:', status);

      setShowInAppWebView(false);
      setCheckoutUrl(null);
    } catch (error) {
      console.error('Error processing Duffel checkout callback:', error);

      setIsFinalizingDuffelBooking(false);

      setShowInAppWebView(false);
      setCheckoutUrl(null);

      showError('Unable to finalize your booking.');
    }
  };

  /**
   * -----------------------------------------
   * Booking Card Navigation
   * -----------------------------------------
   */
  const handleBookingCardPress = (booking: UserBooking) => {
    const confirmation = {
      item:
        booking.booking_type === 'flight'
          ? `${booking.source ?? '—'} → ${booking.destination ?? '—'}`
          : booking.hotel_name ?? 'Hotel Booking',

      provider:
        booking.booking_type === 'flight'
          ? booking.airline ?? 'Duffel'
          : booking.hotel_name ?? 'Duffel Stays',

      price:
        booking.price !== null && booking.price !== undefined
          ? `${booking.currency ?? ''} ${booking.price}`.trim()
          : '—',

      subtitle:
        booking.status === 'success'
          ? 'Your booking has been confirmed.'
          : 'Your booking details',
    };

    const parentNavigation = navigation.getParent();

    if (parentNavigation) {
      parentNavigation.navigate('Confirm', {
        confirmation,
        booking,
      });

      return;
    }

    navigation.navigate('Confirm', {
      confirmation,
      booking,
    });
  };

  /**
   * -----------------------------------------
   * UI
   * -----------------------------------------
   */
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={screenStyles.screenScroll}
        contentContainerStyle={screenStyles.screenScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------------------------- */}
        {/* Reusable Search Input */}
        {/* ---------------------------------- */}

        <VoiceSearchInput
          value={prompt}
          onChangeText={value => {
            setPrompt(value);

            if (!value.trim()) {
              setSearchType(null);
              setSelectedFlight(null);
            }
          }}
          placeholder={"Say or type: 'Flight to Dubai next Tuesday'"}
          onProcessingStateChange={setIsVoiceProcessing}
          showClearButton
          multiline
          numberOfLines={2}
        />

        {/* ---------------------------------- */}
        {/* Intent Processing */}
        {/* ---------------------------------- */}

        {isIntentProcessing && (
          <View style={screenStyles.processingContainer}>
            <ActivityIndicator size="small" color="#1E293B" />

            <Text style={screenStyles.processingText}>
              Processing your request...
            </Text>
          </View>
        )}

        {/* ---------------------------------- */}
        {/* Search CTA */}
        {/* ---------------------------------- */}

        {!isVoiceProcessing &&
          !isIntentProcessing &&
          searchType === 'flight' && (
            <PrimaryButton
              text={
                isDuffelLoading ? '✦ Searching Flights...' : '✦ Find Flights'
              }
              onPress={() => openDuffelCheckout('flight')}
              fullWidth
              disabled={isDuffelLoading}
            />
          )}

        {!isVoiceProcessing &&
          !isIntentProcessing &&
          searchType === 'hotel' && (
            <PrimaryButton
              text={isDuffelLoading ? '✦ Searching Hotels...' : '✦ Find Hotels'}
              onPress={() => openDuffelCheckout('hotel')}
              fullWidth
              disabled={isDuffelLoading}
            />
          )}

        {/* ---------------------------------- */}
        {/* My Bookings */}
        {/* ---------------------------------- */}

        <View style={screenStyles.bookingsSection}>
          <View style={screenStyles.bookingsSectionHeader}>
            <View>
              <Text style={screenStyles.bookingsTitle}>My Bookings</Text>

              <Text style={screenStyles.bookingsSubtitle}>
                Your recent trips
              </Text>
            </View>

            <TouchableOpacity
              onPress={fetchBookings}
              disabled={bookingsLoading}
              style={screenStyles.refreshButton}
              hitSlop={8}
            >
              {bookingsLoading ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <Ionicons name="refresh-outline" size={20} color="#111827" />
              )}
            </TouchableOpacity>
          </View>

          {bookingsLoading && bookings.length === 0 && (
            <View style={screenStyles.bookingsLoading}>
              <ActivityIndicator size="small" color="#1E293B" />

              <Text style={screenStyles.bookingsLoadingText}>
                Loading your bookings...
              </Text>
            </View>
          )}

          {!bookingsLoading && bookings.length === 0 && !bookingsError && (
            <View style={screenStyles.emptyBookings}>
              <View style={screenStyles.emptyBookingsIcon}>
                <Ionicons name="briefcase-outline" size={24} color="#6B7280" />
              </View>

              <Text style={screenStyles.emptyBookingsTitle}>
                No bookings yet
              </Text>

              <Text style={screenStyles.emptyBookingsText}>
                Your completed trips will appear here.
              </Text>
            </View>
          )}

          {bookingsError && (
            <View style={screenStyles.bookingError}>
              <Ionicons name="alert-circle-outline" size={19} color="#B42318" />

              <Text style={screenStyles.bookingErrorText}>{bookingsError}</Text>

              <TouchableOpacity
                onPress={fetchBookings}
                style={screenStyles.retryButton}
              >
                <Text style={screenStyles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {bookings.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={screenStyles.bookingsHorizontalContent}
            >
              {bookings.map(booking => (
                <TouchableOpacity
                  key={booking.id}
                  style={screenStyles.bookingCardWrapper}
                  activeOpacity={0.85}
                  onPress={() => handleBookingCardPress(booking)}
                >
                  <BookingCard booking={booking} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {loading && (
          <ActivityIndicator
            size="large"
            color="#1E293B"
            style={{
              marginVertical: 16,
            }}
          />
        )}

        {!loading &&
          results.map((item, idx) => (
            <ResultCard
              key={`${item.title}-${idx}`}
              title={item.title}
              meta={item.meta}
              price={item.price}
              badges={item.badges}
              onPress={() => handleBookItem(item.title, item.price, idx)}
            />
          ))}

        {/* ---------------------------------- */}
        {/* Booking Bridge */}
        {/* ---------------------------------- */}

        <BookingBridge
          visible={!!pendingBooking}
          title={pendingBooking?.title ?? ''}
          onComplete={handleBridgeComplete}
        />

        {/* ---------------------------------- */}
        {/* In-App WebView */}
        {/* ---------------------------------- */}

        <InAppWebView
          visible={showInAppWebView}
          url={checkoutUrl}
          title={searchType === 'hotel' ? 'Hotel Checkout' : 'Flight Checkout'}
          onNavigationStateChange={url => handleDuffelCheckoutNavigation(url)}
          onClose={() => {
            setShowInAppWebView(false);
            setCheckoutUrl(null);
          }}
        />

        {/* ---------------------------------- */}
        {/* Duffel Card Modal */}
        {/* ---------------------------------- */}

        <Modal
          visible={showCardForm}
          animationType="slide"
          transparent
          onRequestClose={() => {
            if (!creatingCard) {
              setShowCardForm(false);
            }
          }}
        >
          <View style={screenStyles.modalOverlay}>
            <View style={screenStyles.cardModal}>
              <View style={screenStyles.modalHandle} />

              <ScrollView
                style={screenStyles.cardScrollView}
                contentContainerStyle={screenStyles.cardScrollContent}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                <View style={screenStyles.cardHeader}>
                  <View style={screenStyles.cardHeaderText}>
                    <View style={screenStyles.paymentIconContainer}>
                      <Ionicons name="card-outline" size={22} color="#111827" />
                    </View>

                    <View style={screenStyles.paymentHeaderCopy}>
                      <Text style={screenStyles.cardTitle}>
                        Payment details
                      </Text>

                      <Text style={screenStyles.cardSubtitle}>
                        Securely enter your card information
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      if (!creatingCard) {
                        setShowCardForm(false);
                      }
                    }}
                    style={screenStyles.cardCloseButton}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={22} color="#374151" />
                  </TouchableOpacity>
                </View>

                <View style={screenStyles.offerInfo}>
                  <View style={screenStyles.offerIconContainer}>
                    <Ionicons
                      name="airplane-outline"
                      size={20}
                      color="#111827"
                    />
                  </View>

                  <View style={screenStyles.offerInfoContent}>
                    <Text style={screenStyles.offerInfoTitle}>
                      Flight selected
                    </Text>

                    <Text style={screenStyles.offerInfoText}>
                      {selectedFlight
                        ? `${selectedFlight.airline} ${selectedFlight.flightNumber}`
                        : 'Test Duffel offer'}
                    </Text>

                    <View style={screenStyles.offerIdRow}>
                      <Text style={screenStyles.offerIdLabel}>Offer ID</Text>

                      <Text style={screenStyles.offerIdValue} numberOfLines={1}>
                        {TEST_DUFFEL_OFFER_ID}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={screenStyles.cardSection}>
                  <Text style={screenStyles.sectionLabel}>
                    CARD INFORMATION
                  </Text>

                  <View style={screenStyles.cardFormContainer}>
                    {cardError && (
                      <View style={screenStyles.cardError}>
                        <View style={screenStyles.cardErrorIcon}>
                          <Ionicons
                            name="alert-circle-outline"
                            size={20}
                            color="#B42318"
                          />
                        </View>

                        <View style={screenStyles.cardErrorContent}>
                          <Text style={screenStyles.cardErrorTitle}>
                            Payment error
                          </Text>

                          <Text style={screenStyles.cardErrorText}>
                            {cardError}
                          </Text>
                        </View>
                      </View>
                    )}

                    {!componentClientKey ? (
                      <View style={screenStyles.cardLoading}>
                        <View style={screenStyles.loadingIconContainer}>
                          <ActivityIndicator size="small" color="#111827" />
                        </View>

                        <Text style={screenStyles.cardLoadingTitle}>
                          Initializing checkout
                        </Text>

                        <Text style={screenStyles.cardLoadingText}>
                          Preparing secure payment fields...
                        </Text>
                      </View>
                    ) : (
                      <>
                        <View style={screenStyles.duffelFieldsContainer}>
                          <DuffelCardForm
                            ref={cardFormRef}
                            clientKey={componentClientKey}
                            intent="to-create-card-for-temporary-use"
                            onValidateSuccess={() => {
                              console.log('DUFFEL CARD FORM VALID');

                              setCardValid(true);
                              setCardError(null);
                            }}
                            onValidateFailure={() => {
                              console.log('DUFFEL CARD FORM INVALID');

                              setCardValid(false);
                            }}
                            onCreateCardForTemporaryUseSuccess={card => {
                              console.log(
                                'DUFFEL TEMPORARY CARD CREATED:',
                                JSON.stringify(card),
                              );

                              console.log('DUFFEL CARD ID:', card.id);

                              console.log(
                                'DUFFEL OFFER ID:',
                                TEST_DUFFEL_OFFER_ID,
                              );

                              setCreatingCard(false);

                              showError(
                                `Card created successfully.\n\nCard ID: ${card.id}`,
                                'Duffel Card Test',
                              );

                              setShowCardForm(false);
                            }}
                            onCreateCardForTemporaryUseFailure={error => {
                              console.error(
                                'DUFFEL CARD CREATION FAILURE:',
                                error,
                              );

                              setCreatingCard(false);

                              const errorObject = error as unknown as Record<
                                string,
                                unknown
                              >;

                              console.error(
                                'DUFFEL CARD CREATION FAILURE DETAILS:',
                                JSON.stringify(errorObject, null, 2),
                              );

                              const errorMessage =
                                typeof errorObject?.message === 'string'
                                  ? errorObject.message
                                  : typeof errorObject?.error === 'string'
                                  ? errorObject.error
                                  : typeof errorObject?.detail === 'string'
                                  ? errorObject.detail
                                  : 'Unable to create the temporary card.';

                              setCardError(errorMessage);
                            }}
                            styles={{
                              input: {
                                color: '#111827',
                                fontSize: 16,
                              },
                              label: {
                                color: '#374151',
                                fontWeight: '600',
                              },
                              errorMessage: {
                                color: '#B42318',
                              },
                              formField: {
                                marginBottom: 16,
                              },
                              formContainer: {
                                gap: 12,
                              },
                              sectionTitle: {
                                fontSize: 18,
                                fontWeight: '700',
                              },
                            }}
                          />
                        </View>

                        <View style={screenStyles.securityNote}>
                          <Ionicons
                            name="lock-closed-outline"
                            size={15}
                            color="#6B7280"
                          />

                          <Text style={screenStyles.securityText}>
                            Your payment information is securely processed.
                          </Text>
                        </View>

                        <View style={screenStyles.continueButtonContainer}>
                          <PrimaryButton
                            text={
                              creatingCard ? '✦ Processing...' : '✦ Continue'
                            }
                            onPress={handleCreateCard}
                            fullWidth
                            disabled={!cardValid || creatingCard}
                          />
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const screenStyles = StyleSheet.create({
  screenScroll: {
    flex: 1,
  },

  screenScrollContent: {
    paddingBottom: 24,
  },

  /**
   * -----------------------------------------
   * PROCESSING
   * -----------------------------------------
   */

  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  processingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#475569',
  },

  /**
   * -----------------------------------------
   * MY BOOKINGS
   * -----------------------------------------
   */

  bookingsSection: {
    marginTop: 18,
    marginBottom: 12,
  },

  bookingsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
  },

  bookingsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },

  bookingsSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#6B7280',
  },

  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bookingsLoading: {
    minHeight: 100,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  bookingsLoadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },

  emptyBookings: {
    minHeight: 130,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  emptyBookingsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },

  emptyBookingsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },

  emptyBookingsText: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },

  bookingError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FDA29B',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  bookingErrorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    lineHeight: 17,
    color: '#B42318',
  },

  retryButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  retryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },

  bookingsHorizontalContent: {
    paddingHorizontal: 2,
    paddingRight: 12,
  },

  bookingCardWrapper: {
    width: 310,
    marginRight: 12,
  },

  /**
   * -----------------------------------------
   * CARD MODAL
   * -----------------------------------------
   */

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    justifyContent: 'flex-end',
  },

  cardModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '94%',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: -8,
    },
    elevation: 20,
  },

  modalHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 18,
  },

  cardScrollView: {
    flexGrow: 0,
  },

  cardScrollContent: {
    paddingBottom: 8,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  cardHeaderText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },

  paymentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  paymentHeaderCopy: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },

  cardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
  },

  cardCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  offerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 22,
  },

  offerIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  offerInfoContent: {
    flex: 1,
    minWidth: 0,
  },

  offerInfoTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },

  offerInfoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginTop: 1,
  },

  offerIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  offerIdLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginRight: 6,
  },

  offerIdValue: {
    flex: 1,
    fontSize: 10,
    color: '#9CA3AF',
  },

  cardSection: {
    width: '100%',
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  cardFormContainer: {
    width: '100%',
  },

  duffelFieldsContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    overflow: 'hidden',
  },

  cardError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FDA29B',
    borderRadius: 14,
    padding: 13,
    marginBottom: 16,
  },

  cardErrorIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  cardErrorContent: {
    flex: 1,
  },

  cardErrorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B42318',
    marginBottom: 3,
  },

  cardErrorText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#B42318',
  },

  cardLoading: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 20,
  },

  loadingIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  cardLoadingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },

  cardLoadingText: {
    marginTop: 5,
    fontSize: 13,
    color: '#6B7280',
  },

  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingHorizontal: 8,
  },

  securityText: {
    marginLeft: 6,
    fontSize: 11,
    color: '#6B7280',
  },

  continueButtonContainer: {
    marginTop: 16,
    marginBottom: 4,
  },
});
