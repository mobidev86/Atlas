import React from 'react';
import { View, Text, StyleSheet, DimensionValue } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';

export interface UserBooking {
  id: string;
  user_id: string | null;
  booking_type: string;
  source: string | null;
  destination: string | null;
  booking_id: string;
  status: 'success' | 'failure' | 'cancelled' | 'processing' | string;
  booking_reference: string | null;
  fullName: string;
  created_at: string | null;
  updated_at: string | null;
  departure_date: string | null;
  return_date: string | null;
  hotel_name: string | null;
  airline: string | null;
  passenger_name: string | null;
  price: number | string | null;
  currency: string | null;
}

interface BookingCardProps {
  booking: UserBooking;
  width?: DimensionValue;
}

function formatBookingDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatBookingPrice(booking: UserBooking): string | null {
  if (booking.price === null || booking.price === undefined) {
    return null;
  }

  const numericPrice =
    typeof booking.price === 'number' ? booking.price : Number(booking.price);

  if (Number.isNaN(numericPrice)) {
    return String(booking.price);
  }

  return `${booking.currency || ''} ${numericPrice.toFixed(2)}`.trim();
}

function getBookingStatusLabel(status: string): string {
  switch (status) {
    case 'success':
      return 'Confirmed';

    case 'processing':
      return 'Processing';

    case 'failure':
      return 'Failed';

    case 'cancelled':
      return 'Cancelled';

    default:
      return status
        ? status.charAt(0).toUpperCase() + status.slice(1)
        : 'Unknown';
  }
}

function getBookingStatusIcon(status: string): string {
  switch (status) {
    case 'success':
      return 'checkmark-circle-outline';

    case 'processing':
      return 'time-outline';

    case 'failure':
      return 'alert-circle-outline';

    case 'cancelled':
      return 'close-circle-outline';

    default:
      return 'information-circle-outline';
  }
}

export function BookingCard({ booking, width = 310 }: BookingCardProps) {
  const isFlight = booking.booking_type === 'flight';

  const departureDate = formatBookingDate(booking.departure_date);
  const returnDate = formatBookingDate(booking.return_date);
  const formattedPrice = formatBookingPrice(booking);
  const statusLabel = getBookingStatusLabel(booking.status);

  return (
    <View style={[cardStyles.bookingCard, { width }]}>
      <View style={cardStyles.bookingHeader}>
        <View style={cardStyles.bookingTypeIcon}>
          <Ionicons
            name={isFlight ? 'airplane-outline' : 'business-outline'}
            size={21}
            color="#111827"
          />
        </View>

        <View style={cardStyles.bookingHeaderContent}>
          <Text style={cardStyles.bookingType}>
            {isFlight ? 'Flight' : 'Hotel'}
          </Text>

          <Text style={cardStyles.bookingProvider} numberOfLines={1}>
            {isFlight
              ? booking.airline || 'Duffel'
              : booking.hotel_name || 'Duffel Stays'}
          </Text>
        </View>

        <View
          style={[
            cardStyles.statusBadge,
            booking.status === 'success' && cardStyles.statusSuccess,
            booking.status === 'processing' && cardStyles.statusProcessing,
            booking.status === 'failure' && cardStyles.statusFailure,
            booking.status === 'cancelled' && cardStyles.statusCancelled,
          ]}
        >
          <Ionicons
            name={getBookingStatusIcon(booking.status) as any}
            size={13}
            color="#374151"
          />

          <Text style={cardStyles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      {isFlight && (
        <>
          <View style={cardStyles.routeContainer}>
            <View style={cardStyles.routeLocation}>
              <Text style={cardStyles.routeCode} numberOfLines={1}>
                {booking.source || '—'}
              </Text>

              <Text style={cardStyles.routeLabel}>From</Text>
            </View>

            <View style={cardStyles.routeArrow}>
              <View style={cardStyles.routeLine} />

              <Ionicons name="airplane" size={16} color="#111827" />

              <View style={cardStyles.routeLine} />
            </View>

            <View
              style={[cardStyles.routeLocation, cardStyles.routeLocationRight]}
            >
              <Text style={cardStyles.routeCode} numberOfLines={1}>
                {booking.destination || '—'}
              </Text>

              <Text style={cardStyles.routeLabel}>To</Text>
            </View>
          </View>

          {(departureDate || returnDate) && (
            <View style={cardStyles.bookingInfoRow}>
              {departureDate && (
                <View style={cardStyles.bookingInfoItem}>
                  <Ionicons name="calendar-outline" size={16} color="#6B7280" />

                  <View style={cardStyles.bookingInfoCopy}>
                    <Text style={cardStyles.bookingInfoLabel}>Departure</Text>

                    <Text style={cardStyles.bookingInfoValue}>
                      {departureDate}
                    </Text>
                  </View>
                </View>
              )}

              {returnDate && (
                <View style={cardStyles.bookingInfoItem}>
                  <Ionicons name="calendar-outline" size={16} color="#6B7280" />

                  <View style={cardStyles.bookingInfoCopy}>
                    <Text style={cardStyles.bookingInfoLabel}>Return</Text>

                    <Text style={cardStyles.bookingInfoValue}>
                      {returnDate}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {booking.passenger_name && (
            <View style={cardStyles.bookingDetailRow}>
              <Ionicons name="person-outline" size={16} color="#6B7280" />

              <Text style={cardStyles.bookingDetailText} numberOfLines={2}>
                {booking.passenger_name}
              </Text>
            </View>
          )}
        </>
      )}

      {booking.booking_reference && (
        <View style={cardStyles.referenceContainer}>
          <Text style={cardStyles.referenceLabel}>Booking reference</Text>

          <Text style={cardStyles.referenceValue} numberOfLines={1}>
            {booking.booking_reference}
          </Text>
        </View>
      )}

      <View style={cardStyles.bookingFooter}>
        <Text style={cardStyles.bookingIdText} numberOfLines={1}>
          {booking.booking_id}
        </Text>

        {formattedPrice && (
          <Text style={cardStyles.bookingPrice}>{formattedPrice}</Text>
        )}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    padding: 15,
  },

  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  bookingTypeIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  bookingHeaderContent: {
    flex: 1,
    minWidth: 0,
  },

  bookingType: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  bookingProvider: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    marginLeft: 6,
  },

  statusSuccess: {
    backgroundColor: '#ECFDF3',
  },

  statusProcessing: {
    backgroundColor: '#FFF7ED',
  },

  statusFailure: {
    backgroundColor: '#FEF3F2',
  },

  statusCancelled: {
    backgroundColor: '#F3F4F6',
  },

  statusText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },

  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  routeLocation: {
    width: 65,
  },

  routeLocationRight: {
    alignItems: 'flex-end',
  },

  routeCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  routeLabel: {
    marginTop: 2,
    fontSize: 10,
    color: '#9CA3AF',
  },

  routeArrow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },

  routeLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D1D5DB',
  },

  bookingInfoRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginBottom: 10,
  },

  bookingInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  bookingInfoCopy: {
    marginLeft: 7,
    minWidth: 0,
  },

  bookingInfoLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  bookingInfoValue: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },

  bookingDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginBottom: 10,
  },

  bookingDetailText: {
    flex: 1,
    marginLeft: 7,
    fontSize: 11,
    color: '#4B5563',
  },

  referenceContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 1,
  },

  referenceLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  referenceValue: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.5,
  },

  bookingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 10,
  },

  bookingIdText: {
    flex: 1,
    marginRight: 8,
    fontSize: 8,
    color: '#9CA3AF',
  },

  bookingPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
});
