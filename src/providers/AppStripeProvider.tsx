import React, { ReactElement } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import Config from 'react-native-config';

interface Props {
  children: ReactElement;
}

export default function AppStripeProvider({ children }: Props): ReactElement {
  return (
    <StripeProvider
      publishableKey={
        'pk_test_51U14cHLBzqVdCxhPjGhdHiDwk5uu93suGRWSdgO5oTXxbMLWyB7TcmaqX5vngUGsJbNhQIFGU9CwbBOAP1whC1Nd00iIZdgRcv'
      }
      merchantIdentifier="merchant.com.atlasproject"
      urlScheme="atlas"
    >
      {children}
    </StripeProvider>
  );
}
