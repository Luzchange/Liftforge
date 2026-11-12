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

        {/* Barbell Diagram Visualization */}
        <div className="bg-[var(--background)] p-4 rounded-2xl border border-[var(--card-border)] overflow-x-auto">
          <div className="text-[11px] font-bold text-[var(--muted-text)] uppercase tracking-wider mb-3 text-center">
            Barbell Sleeve Diagram (Per Side)
          </div>
          <div className="flex items-center justify-center min-w-[280px] h-28 relative">
            {/* Collar / Shaft */}
            <div className="w-12 h-4 bg-zinc-600 rounded-l-md relative flex items-center justify-end pr-1">
              <span className="text-[9px] text-zinc-300 font-mono font-bold">Bar</span>
            </div>
            {/* Barbell Sleeve Collar ring */}
            <div className="w-4 h-16 bg-zinc-400 rounded-xs border border-zinc-500 shadow-sm" />
            
            {/* Plates loaded on sleeve */}
            <div className="flex items-center gap-1 pl-1 pr-3 bg-zinc-800/40 py-2 border-y-2 border-zinc-700 min-h-[70px]">
              {result.platesPerSide.length === 0 ? (
                <div className="text-xs text-[var(--muted-text)] font-mono italic px-4">
                  No plates — collar only
                </div>
              ) : (
                result.platesPerSide.flatMap(({ plate, count }, pIdx) =>
                  Array.from({ length: count }).map((_, cIdx) => {
                    // Height and colors according to plate weight
                    const isBig = plate >= 20 || (unit === 'lb' && plate >= 45);
                    const isMed = (plate >= 10 && plate < 20) || (unit === 'lb' && plate >= 25 && plate < 45);
                    const heightClass = isBig ? 'h-24 w-5' : isMed ? 'h-18 w-4' : 'h-12 w-3.5';
                    const colorClass =
                      plate === 25 || plate === 55
                        ? 'bg-red-600 text-white'
                        : plate === 20 || plate === 45
                        ? 'bg-blue-600 text-white'
                        : plate === 15 || plate === 35
                        ? 'bg-amber-500 text-black'
                        : plate === 10 || plate === 25
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-300 text-black';

                    return (
                      <div
                        key={`${pIdx}-${cIdx}`}
                        className={`${heightClass} ${colorClass} rounded-sm flex items-center justify-center shadow-md font-mono font-extrabold text-[10px] select-none border border-black/20`}
                        title={`${plate} ${unit}`}
                      >
                        <span className="rotate-90 whitespace-nowrap">{plate}</span>
                      </div>
                    );
                  })
                )
              )}
            </div>

            {/* Barbell Sleeve Tip */}
            <div className="w-6 h-4 bg-zinc-500 rounded-r-md border border-zinc-600" />
          </div>
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
