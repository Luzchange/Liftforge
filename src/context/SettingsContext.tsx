'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserSettings } from '@/domain/types';
import { db, getOrCreateSettings } from '@/domain/db';

interface SettingsContextType {
  settings: UserSettings | null;
  loading: boolean;
  updateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  reloadSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  loading: true,
  updateSettings: async () => {},
  reloadSettings: async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const s = await getOrCreateSettings();
      setSettings(s);
      applyTheme(s.theme);
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (theme: 'dark' | 'light' | 'system') => {
    let effective = theme;
    if (theme === 'system') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', effective);
  };

  const updateSettings = async (partial: Partial<UserSettings>) => {
    const current = settings || (await getOrCreateSettings());
    const updated: UserSettings = {
      ...current,
      ...partial,
      updatedAt: Date.now(),
    };
    await db.settings.put(updated);
    setSettings(updated);
    if (partial.theme) {
      applyTheme(partial.theme);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, reloadSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
