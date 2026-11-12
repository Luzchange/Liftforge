import React from 'react';

export function LiftForgeIcon({ className = 'w-6 h-6', color = 'var(--accent-lime)' }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="LiftForge Logo"
    >
      {/* Barbell Bar */}
      <rect x="56" y="96" width="400" height="18" rx="9" fill={color} />
      {/* Outer Plates */}
      <rect x="42" y="52" width="24" height="106" rx="6" fill={color} />
      <rect x="72" y="66" width="20" height="78" rx="5" fill={color} />
      <rect x="446" y="52" width="24" height="106" rx="6" fill={color} />
      <rect x="420" y="66" width="20" height="78" rx="5" fill={color} />
      {/* Inner Collars */}
      <rect x="96" y="91" width="10" height="28" rx="3" fill={color} />
      <rect x="406" y="91" width="10" height="28" rx="3" fill={color} />
      {/* Head */}
      <circle cx="256" cy="180" r="32" fill={color} />
      {/* Arms in V-grip */}
      <path
        d="M 170 114 L 224 230 L 256 250 L 288 230 L 342 114"
        stroke={color}
        strokeWidth="26"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Torso */}
      <path d="M 230 250 L 282 250 L 274 340 L 238 340 Z" fill={color} />
      {/* Athletic Legs */}
      <path
        d="M 242 338 L 204 430 L 160 456"
        stroke={color}
        strokeWidth="28"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 270 338 L 308 430 L 352 456"
        stroke={color}
        strokeWidth="28"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Platform */}
      <rect x="130" y="470" width="252" height="14" rx="7" fill={color} />
    </svg>
  );
}
