'use client';

import React, { useEffect, useState } from 'react';
import { calculatePlates } from '@/domain/plates';
import { X, Layers } from 'lucide-react';

interface PlateCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  weight: number;
  barWeight: number;
  availablePlates: number[];
  unit: string;
  exerciseName: string;
}

export function PlateCalculatorModal({
  isOpen,
  onClose,
  weight,
  barWeight,
  availablePlates,
  unit,
  exerciseName,
}: PlateCalculatorModalProps) {
  if (!isOpen) return null;

  const result = calculatePlates(weight, barWeight, availablePlates);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--accent-lime)]" />
            <h3 className="font-bold text-lg text-[var(--foreground)]">Barbell Loading Guide</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--muted-text)] hover:text-[var(--foreground)] rounded-lg min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Close plate calculator"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[var(--background)] p-4 rounded-xl border border-[var(--card-border)] text-center">
          <div className="text-xs text-[var(--muted-text)] uppercase font-semibold tracking-wider">
            {exerciseName} Working Weight
          </div>
          <div className="text-3xl font-black font-mono mt-1 text-[var(--accent-lime)]">
            {result.achievableWeight} {unit}
          </div>
          <div className="text-xs text-[var(--muted-text)] mt-1">
            Barbell: {barWeight} {unit} | Sleeves: {(result.achievableWeight - barWeight)} {unit} total
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-[var(--muted-text)] uppercase tracking-wider mb-3">
            Plates Per Side (Load onto each sleeve)
          </div>

          {result.platesPerSide.length === 0 ? (
            <div className="p-4 text-center rounded-xl border border-[var(--card-border)] text-sm text-[var(--muted-text)]">
              Empty Barbell only (no plates needed).
            </div>
          ) : (
            <div className="space-y-2">
              {result.platesPerSide.map(({ plate, count }) => (
                <div
                  key={plate}
                  className="flex items-center justify-between p-3 bg-[var(--background)] rounded-xl border border-[var(--card-border)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--card-bg)] border border-[var(--accent-lime)]/40 flex items-center justify-center font-bold text-sm text-[var(--foreground)] font-mono">
                      {plate}
                    </div>
                    <div>
                      <span className="font-bold text-sm text-[var(--foreground)]">{plate} {unit} plate</span>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-base bg-[var(--accent-lime)] text-black px-3 py-1 rounded-md">
                    x{count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full bg-[var(--card-hover)] border border-[var(--card-border)] font-semibold py-3 rounded-xl text-sm text-[var(--foreground)] min-h-[48px]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
