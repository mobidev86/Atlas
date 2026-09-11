import React, { useState, useEffect } from 'react';
import { View, Pressable, Text, ActivityIndicator } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import styles, { colors } from '../styles/styles';
import { SecondaryButton } from '../components';
import { supabase } from '../services/supabase';

interface HomeScreenProps {
  onOpenTravel: () => void;
  onOpenDining: () => void;
  onOpenInbox: () => void;
}

interface Booking {
  id: string;
  bookingType: string;
  source: string | null;
  destination: string | null;
  bookingId: string;
  bookingReference: string | null;
  status: string;
  fullName: string;
  passengerName: string | null;
  departureDate: string | null;
  returnDate: string | null;
  hotelName: string | null;
  airline: string | null;
  price: number | null;
  currency: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export function HomeScreen({
  onOpenTravel,
  onOpenDining,
  onOpenInbox,
}: HomeScreenProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);

  useEffect(() => {
    fetchTodaysBookings();
  }, []);

  const fetchTodaysBookings = async () => {
    try {
      setIsLoadingBookings(true);

      const { data, error } = await supabase.functions.invoke(
        'get-todays-bookings',
      );

      if (error) {
        console.error('Failed to fetch today bookings:', error);
        setBookings([]);
        return;
      }

      if (!data?.success) {
        console.error(
          'get-todays-bookings error:',
          data?.error || 'Unknown error',
        );
        setBookings([]);
        return;
      }

      setBookings(data.bookings || []);
    } catch (error) {
      console.error('Unexpected error fetching today bookings:', error);
      setBookings([]);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) {
      return '';
    }

    try {
      const date = new Date(`${dateString}T00:00:00`);

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getBookingStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return 'Confirmed';

      case 'processing':
        return 'Processing';

      case 'cancelled':
        return 'Cancelled';

      case 'failure':
        return 'Failed';

      default:
        return status || 'Unknown';
    }
  };

  const getBookingStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return '#10B981';

      case 'processing':
        return '#F59E0B';

      case 'cancelled':
        return '#EF4444';

      case 'failure':
        return '#EF4444';

      default:
        return colors.navy;
    }
  };

  const formatPrice = (price: number | null, currency: string | null) => {
    if (price === null || price === undefined) {
      return null;
    }

    const formattedPrice = Number(price).toFixed(2);

    return currency ? `${currency} ${formattedPrice}` : formattedPrice;
  };

  const isFlightBooking = (booking: Booking) => {
    return booking.bookingType?.toLowerCase() === 'flight';
  };

  const isHotelBooking = (booking: Booking) => {
    return (
      booking.bookingType?.toLowerCase() === 'hotel' ||
      booking.bookingType?.toLowerCase() === 'stay'
    );
  };

  return (
    <View>
      {/* Hero Card */}
      {/* <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Executive utility</Text>
        <Text style={styles.heroTitle}>
          Everything you need is one prompt away.
        </Text>
        <Text style={styles.heroText}>
          Travel, dining, and inbox replies are coordinated in one calm flow.
        </Text>
        <SecondaryButton
          text="Start a new request"
          onPress={onOpenTravel}
        />
      </View> */}

      {/* Popular Actions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Popular actions</Text>
      </View>

      <Pressable style={styles.moduleCard} onPress={onOpenTravel}>
        <View style={[styles.iconWrap, styles.navyTint]}>
          <Ionicons name="airplane" size={20} color={colors.navy} />
        </View>

        <View style={styles.moduleBody}>
          <Text style={styles.moduleTitle}>Travel & hotels</Text>

          <Text style={styles.moduleSub}>
            Flights, stays, and itinerary updates
          </Text>
        </View>
      </Pressable>

      <Pressable style={styles.moduleCard} onPress={onOpenDining}>
        <View style={[styles.iconWrap, styles.rustTint]}>
          <Ionicons name="restaurant" size={20} color={colors.rustBrown} />
        </View>

        <View style={styles.moduleBody}>
          <Text style={styles.moduleTitle}>Dining</Text>

          <Text style={styles.moduleSub}>
            Discover a quiet place and reserve it
          </Text>
        </View>
      </Pressable>

      <Pressable style={styles.moduleCard} onPress={onOpenInbox}>
        <View style={[styles.iconWrap, styles.goldTint]}>
          <Ionicons name="mail" size={20} color={colors.navy} />
        </View>

        <View style={styles.moduleBody}>
          <Text style={styles.moduleTitle}>Inbox & replies</Text>

          <Text style={styles.moduleSub}>
            Review highlights and send polished replies
          </Text>
        </View>
      </Pressable>

      {/* Today's Bookings */}
      <View style={styles.todoSectionHeader}>
        <Text style={styles.sectionTitle}>Today's bookings</Text>

        {!isLoadingBookings && (
          <Text style={styles.todoProgress}>
            {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
          </Text>
        )}
      </View>

      {/* Loading */}
      {isLoadingBookings && (
        <View
          style={{
            paddingVertical: 24,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="small" color={colors.navy} />

          <Text
            style={[
              styles.todoLabel,
              {
                marginTop: 8,
              },
            ]}
          >
            Loading today's bookings...
          </Text>
        </View>
      )}

      {/* No bookings */}
      {!isLoadingBookings && bookings.length === 0 && (
        <View
          style={{
            paddingVertical: 20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="calendar-outline" size={28} color={colors.navy} />

          <Text
            style={[
              styles.todoLabel,
              {
                marginTop: 8,
              },
            ]}
          >
            No bookings for today
          </Text>
        </View>
      )}

      {/* Today's Booking Items */}
      {!isLoadingBookings &&
        bookings.map(booking => {
          const flight = isFlightBooking(booking);
          const hotel = isHotelBooking(booking);

          const statusColor = getBookingStatusColor(booking.status);

          const price = formatPrice(booking.price, booking.currency);

          return (
            <Pressable key={booking.id} style={styles.todoCard}>
              {/* Booking Icon */}
              <View
                style={[
                  styles.todoCheckbox,
                  {
                    backgroundColor: flight ? colors.navy : colors.rustBrown,
                    borderColor: flight ? colors.navy : colors.rustBrown,
                  },
                ]}
              >
                <Ionicons
                  name={flight ? 'airplane' : 'bed'}
                  size={15}
                  color="#FFFFFF"
                />
              </View>

              {/* Booking Details */}
              <View
                style={[
                  styles.todoBody,
                  {
                    paddingRight: 8,
                  },
                ]}
              >
                {/* Flight */}
                {flight && (
                  <>
                    <Text style={styles.todoLabel} numberOfLines={1}>
                      {booking.airline || 'Flight'}
                    </Text>

                    <Text style={styles.todoLabel} numberOfLines={1}>
                      {booking.source || '—'} → {booking.destination || '—'}
                    </Text>

                    <Text
                      style={[
                        styles.todoLabel,
                        {
                          fontSize: 12,
                          opacity: 0.65,
                          marginTop: 2,
                        },
                      ]}
                    >
                      {formatDate(booking.departureDate)}
                      {booking.returnDate
                        ? ` – ${formatDate(booking.returnDate)}`
                        : ''}
                    </Text>

                    {booking.bookingReference && (
                      <Text
                        style={[
                          styles.todoLabel,
                          {
                            fontSize: 11,
                            opacity: 0.55,
                            marginTop: 2,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        Ref: {booking.bookingReference}
                      </Text>
                    )}
                  </>
                )}

                {/* Hotel / Stay */}
                {hotel && (
                  <>
                    <Text style={styles.todoLabel} numberOfLines={1}>
                      {booking.hotelName || 'Hotel stay'}
                    </Text>

                    {booking.source && (
                      <Text style={styles.todoLabel} numberOfLines={1}>
                        {booking.source}
                      </Text>
                    )}

                    <Text
                      style={[
                        styles.todoLabel,
                        {
                          fontSize: 12,
                          opacity: 0.65,
                          marginTop: 2,
                        },
                      ]}
                    >
                      {formatDate(booking.departureDate)}
                      {booking.returnDate
                        ? ` – ${formatDate(booking.returnDate)}`
                        : ''}
                    </Text>

                    {booking.bookingReference && (
                      <Text
                        style={[
                          styles.todoLabel,
                          {
                            fontSize: 11,
                            opacity: 0.55,
                            marginTop: 2,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        Ref: {booking.bookingReference}
                      </Text>
                    )}
                  </>
                )}

                {/* Fallback for an unknown booking type */}
                {!flight && !hotel && (
                  <>
                    <Text style={styles.todoLabel} numberOfLines={1}>
                      {booking.bookingType || 'Booking'}
                    </Text>

                    <Text
                      style={[
                        styles.todoLabel,
                        {
                          fontSize: 12,
                          opacity: 0.65,
                          marginTop: 2,
                        },
                      ]}
                    >
                      {formatDate(booking.departureDate)}
                    </Text>
                  </>
                )}
              </View>

              {/* Right Side */}
              <View
                style={{
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  minWidth: 65,
                }}
              >
                <View
                  style={[
                    styles.todoPriorityDot,
                    {
                      backgroundColor: statusColor,
                      marginBottom: price ? 6 : 0,
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.todoLabel,
                    {
                      fontSize: 10,
                      color: statusColor,
                      fontWeight: '600',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {getBookingStatusLabel(booking.status)}
                </Text>

                {price && (
                  <Text
                    style={[
                      styles.todoLabel,
                      {
                        fontSize: 11,
                        fontWeight: '600',
                        marginTop: 4,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {price}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
    </View>
  );
}
