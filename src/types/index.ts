export type AuthMode = 'login' | 'register';

export type ScreenName =
  | 'splash'
  | 'login'
  | 'register'
  | 'subscribe'
  | 'onboard'
  | 'home'
  | 'travel'
  | 'dining'
  | 'inbox'
  | 'reply'
  | 'confirm'
  | 'profile'
  | '';

export type TabKey = 'home' | 'travel' | 'dining' | 'inbox' | 'profile';

export interface ConfirmationState {
  item: string;
  provider: string;
  price: string;
  subtitle: string;
}

export interface TabItem {
  key: TabKey;
  icon: string;
  label: string;
}

export interface SearchResult {
  title: string;
  meta: string;
  price: string;
  badges: string[];
}

// User Profile & Preferences
export interface TravelPreferences {
  seatType: 'aisle' | 'window' | 'middle';
  minHotelRating: number;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
  preferredAirlines?: string[];
  preferredHotelChains?: string[];
}

export interface DiningPreferences {
  ambiance: 'quiet' | 'lively' | 'casual' | 'romantic' | 'fine_dining';
  dietaryRestrictions: string[];
  preferredCuisines?: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  stripeCustomerId?: string;
  subscriptionStatus: 'active' | 'trialing' | 'canceled' | 'none';
  subscriptionTier?: 'executive' | 'standard';
  autoBookEnabled: boolean;
  zeroRetentionEnabled: boolean;
  travelPreferences: TravelPreferences;
  diningPreferences: DiningPreferences;
  nylasGrantId?: string;
  nylasAccountStatus: 'connected' | 'syncing' | 'disconnected';
  lastEmailSyncedAt?: string;
}

// ToDo List Types
export interface TodoItem {
  id: string;
  userId?: string;
  label: string;
  done: boolean;
  priority: 'high' | 'medium' | 'low';
  sourceType?: 'manual' | 'email' | 'calendar';
  sourceRefId?: string;
  dueDate?: string;
  createdAt?: string;
}

// Travel & Booking Types
export interface TravelIntent {
  destination: string;
  origin?: string;
  departureDate?: string;
  returnDate?: string;
  cabinPreference?: string;
  hotelStars?: number;
  amenities?: string[];
}

export interface FlightOption {
  id: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  price: string;
  cabinClass: string;
  badge?: string;
}

export interface HotelOption {
  id: string;
  hotelName: string;
  location: string;
  rating: number;
  pricePerNight: string;
  roomType: string;
  amenities: string[];
  badge?: string;
}

export interface BookingRecord {
  id: string;
  userId: string;
  bookingType: 'flight' | 'hotel' | 'bundle';
  title: string;
  provider: string;
  price: string;
  subtitle?: string;
  status:
    | 'searching'
    | 'filtering'
    | 'confirming'
    | 'confirmed'
    | 'failed'
    | 'cancelled';
  rawIntentPrompt?: string;
  structuredIntent?: TravelIntent;
  confirmationCode?: string;
  failureReason?: string;
  createdAt: string;
}

// Dining Types
export interface RestaurantOption {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  priceRange: string;
  ambiance: string;
  address: string;
  availableTimes: string[];
  deepLinkUrl?: string;
}

export interface DiningReservation {
  id: string;
  userId: string;
  restaurantName: string;
  location: string;
  partySize: number;
  reservationTime: string;
  status: 'searching' | 'recommended' | 'confirmed' | 'failed' | 'cancelled';
  deepLinkUrl?: string;
  dietaryNotes?: string;
  ambiance?: string;
  createdAt: string;
}

// Email & Voice Types
export interface EmailMessage {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  receivedAt: string;
  summary: string;
  priority: 'high' | 'medium' | 'low';
  bodySnippet: string;
  fullBody?: string;
  isRead: boolean;
}

export interface EmailDraft {
  id: string;
  originalEmailId: string;
  senderName: string;
  subject: string;
  voiceTranscript?: string;
  aiGeneratedDraft: string;
  editedDraft?: string;
  status: 'drafting' | 'ready' | 'sent' | 'discarded';
}
