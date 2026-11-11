import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SettingsProvider } from '@/context/SettingsContext';
import { Navigation } from '@/components/Navigation';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'LiftForge - Progressive Strength Training',
  description: 'Original mobile-first 5x5 barbell strength training progression PWA.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LiftForge',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0F1416',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <body className="antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--accent-lime)] selection:text-black">
        <SettingsProvider>
          <ServiceWorkerRegister />
          <main className="min-h-screen pb-20">{children}</main>
          <Navigation />
        </SettingsProvider>
      </body>
    </html>
  );
}
