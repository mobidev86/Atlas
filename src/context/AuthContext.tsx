import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, TravelPreferences, DiningPreferences } from '../types';
import { AuthService } from '../services/authService';
import { SubscriptionService } from '../services/subscriptionService';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error: string | null }>;
  register: (email: string, password?: string, name?: string) => Promise<{ success: boolean; error: string | null }>;
  logout: () => Promise<void>;
  subscribe: () => Promise<{ success: boolean; error: string | null }>;
  updateTravelPreferences: (prefs: Partial<TravelPreferences>) => void;
  updateDiningPreferences: (prefs: Partial<DiningPreferences>) => void;
  toggleAutoBook: () => void;
  toggleZeroRetention: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initial session load
    AuthService.getCurrentUser().then(u => {
      setUser(u);
      setIsLoading(false);
    });
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    const { user: loggedInUser, error } = await AuthService.login(email, password);
    setIsLoading(false);
    if (error || !loggedInUser) {
      return { success: false, error: error || 'Login failed' };
    }
    setUser(loggedInUser);
    return { success: true, error: null };
  };

  const register = async (email: string, password?: string, name?: string) => {
    setIsLoading(true);
    const { user: registeredUser, error } = await AuthService.register(email, password, name);
    setIsLoading(false);
    if (error || !registeredUser) {
      return { success: false, error: error || 'Registration failed' };
    }
    setUser(registeredUser);
    return { success: true, error: null };
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
  };

  const subscribe = async () => {
    const { success, user: updatedUser, error } = await SubscriptionService.subscribeUser();
    if (success && updatedUser) {
      setUser(updatedUser);
    }
    return { success, error };
  };

  const updateTravelPreferences = (prefs: Partial<TravelPreferences>) => {
    if (!user) return;
    const updated = AuthService.updateUserProfile({
      travelPreferences: { ...user.travelPreferences, ...prefs },
    });
    if (updated) setUser({ ...updated });
  };

  const updateDiningPreferences = (prefs: Partial<DiningPreferences>) => {
    if (!user) return;
    const updated = AuthService.updateUserProfile({
      diningPreferences: { ...user.diningPreferences, ...prefs },
    });
    if (updated) setUser({ ...updated });
  };

  const toggleAutoBook = () => {
    if (!user) return;
    const updated = AuthService.updateUserProfile({
      autoBookEnabled: !user.autoBookEnabled,
    });
    if (updated) setUser({ ...updated });
  };

  const toggleZeroRetention = () => {
    if (!user) return;
    const updated = AuthService.updateUserProfile({
      zeroRetentionEnabled: !user.zeroRetentionEnabled,
    });
    if (updated) setUser({ ...updated });
  };

  const isAuthenticated = !!user;
  const isSubscribed = !!user && (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing');

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isSubscribed,
        isLoading,
        login,
        register,
        logout,
        subscribe,
        updateTravelPreferences,
        updateDiningPreferences,
        toggleAutoBook,
        toggleZeroRetention,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
