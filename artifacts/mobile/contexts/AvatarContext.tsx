import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AvatarChoice } from '@/components/UserAvatar';

const AVATAR_KEY = 'jazment_avatar_preference';

interface AvatarContextValue {
  avatar: AvatarChoice;
  isReady: boolean;
  selectAvatar: (choice: AvatarChoice) => Promise<void>;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const [avatar, setAvatar] = useState<AvatarChoice>('male');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY)
      .then((stored) => {
        if (stored === 'male' || stored === 'female') setAvatar(stored);
      })
      .catch((error) => console.error('Unable to restore avatar preference', error))
      .finally(() => setIsReady(true));
  }, []);

  const selectAvatar = useCallback(async (choice: AvatarChoice) => {
    setAvatar(choice);
    try {
      await AsyncStorage.setItem(AVATAR_KEY, choice);
    } catch (error) {
      console.error('Unable to save avatar preference', error);
    }
  }, []);

  const value = useMemo(() => ({ avatar, isReady, selectAvatar }), [avatar, isReady, selectAvatar]);

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useAvatar() {
  const context = useContext(AvatarContext);
  if (!context) throw new Error('useAvatar must be used within AvatarProvider');
  return context;
}