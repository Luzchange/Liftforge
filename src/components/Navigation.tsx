'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, PlayCircle, History, TrendingUp, Settings } from 'lucide-react';

function NavigationItems() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Today', icon: Calendar },
    { href: '/workout', label: 'Workout', icon: PlayCircle },
    { href: '/history', label: 'History', icon: History },
    { href: '/progress', label: 'Progress', icon: TrendingUp },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 min-w-[48px] min-h-[48px] rounded-lg transition-colors ${
              isActive
                ? 'text-[var(--accent-lime)] font-semibold'
                : 'text-[var(--muted-text)] hover:text-[var(--foreground)]'
            }`}
          >
            <Icon className="w-5 h-5 mb-1 stroke-[2.2]" />
            <span className="text-[11px] tracking-wide">{link.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function Navigation() {
  return (
    <nav
      aria-label="Main Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)] border-t border-[var(--card-border)] pb-safe transition-colors"
    >
      <Suspense fallback={<div className="h-16" />}>
        <NavigationItems />
      </Suspense>
    </nav>
  );
}
