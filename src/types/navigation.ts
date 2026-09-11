import { UserBooking } from '../components/BookingCard';

import { AuthMode, ConfirmationState, EmailMessage } from './index';

export type MainTabParamList = {
  Home: undefined;

  Travel: undefined;

  Dining: undefined;

  Inbox: undefined;

  Profile: undefined;
};

export type RootStackParamList = {
  Splash: undefined;

  Auth: { initialMode?: AuthMode } | undefined;

  Subscribe: undefined;

  Onboard: undefined;

  MainTabs: { screen?: keyof MainTabParamList } | undefined;

  Reply: {
    email: EmailMessage;
  };

  Confirm: {
    confirmation: ConfirmationState;

    booking: UserBooking;
  };
};
