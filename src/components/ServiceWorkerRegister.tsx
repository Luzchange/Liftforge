'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Only register service worker on Web/PWA, NOT inside native Capacitor WebView
    if (Capacitor.isNativePlatform()) {
      return;
    }

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => console.log('Service Worker registered:', reg.scope))
          .catch((err) => console.error('Service Worker registration failed:', err));
      });
    }
  }, []);

  return null;
}
