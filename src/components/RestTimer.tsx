'use client';

import React, { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, Plus, Check } from 'lucide-react';

interface RestTimerProps {
  endTimestamp?: number;
  durationSeconds: number;
  onTimerComplete?: () => void;
  onUpdateTimer: (endTimestamp: number | undefined, duration: number, pausedSeconds?: number) => void;
  soundEnabled?: boolean;
}

export function RestTimer({
  endTimestamp,
  durationSeconds,
  onTimerComplete,
  onUpdateTimer,
  soundEnabled,
}: RestTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!endTimestamp) {
      setSecondsRemaining(0);
      return;
    }

    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((endTimestamp - now) / 1000));
      setSecondsRemaining(diff);

      if (diff === 0) {
        if (soundEnabled && typeof window !== 'undefined') {
          try {
            const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
          } catch {
            // Audio policy fallback
          }
        }
        onTimerComplete?.();
        onUpdateTimer(undefined, durationSeconds);
      }
    };

    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [endTimestamp, durationSeconds, onTimerComplete, onUpdateTimer, soundEnabled]);

  if (!endTimestamp && secondsRemaining === 0) {
    return null;
  }

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const formattedTime = `${mins}:${secs.toString().padStart(2, '0')}`;
  const progressPercent = Math.min(100, Math.max(0, ((durationSeconds - secondsRemaining) / durationSeconds) * 100));

  const handlePauseResume = () => {
    if (isPaused) {
      // Resume
      const newEnd = Date.now() + secondsRemaining * 1000;
      setIsPaused(false);
      onUpdateTimer(newEnd, durationSeconds);
    } else {
      // Pause
      setIsPaused(true);
      onUpdateTimer(undefined, durationSeconds, secondsRemaining);
    }
  };

  const handleAdd30 = () => {
    const currentRemain = isPaused ? secondsRemaining : Math.max(0, Math.ceil(((endTimestamp || 0) - Date.now()) / 1000));
    const newRemain = currentRemain + 30;
    setSecondsRemaining(newRemain);
    if (!isPaused) {
      onUpdateTimer(Date.now() + newRemain * 1000, durationSeconds + 30);
    }
  };

  const handleSkip = () => {
    setSecondsRemaining(0);
    onUpdateTimer(undefined, durationSeconds);
  };

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--accent-lime)]/50 rounded-2xl p-4 shadow-xl mb-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold tracking-wider uppercase text-[var(--accent-lime)] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-lime)] animate-ping" />
          Rest Timer
        </span>
        <button
          onClick={handleSkip}
          className="text-xs text-[var(--muted-text)] hover:text-[var(--foreground)] font-semibold p-1"
        >
          Skip Rest
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="font-mono text-3xl font-black tracking-tight text-[var(--foreground)]">
          {formattedTime}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAdd30}
            className="flex items-center gap-1 bg-[var(--background)] border border-[var(--card-border)] px-3 py-2 rounded-xl text-xs font-bold font-mono text-[var(--foreground)] hover:border-[var(--accent-lime)] min-h-[44px]"
            aria-label="Add 30 seconds"
          >
            <Plus className="w-3.5 h-3.5" />
            30s
          </button>

          <button
            onClick={handlePauseResume}
            className="flex items-center justify-center bg-[var(--card-hover)] border border-[var(--card-border)] w-11 h-11 rounded-xl text-[var(--foreground)]"
            aria-label={isPaused ? 'Resume timer' : 'Pause timer'}
          >
            {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[var(--background)] h-1.5 rounded-full mt-3 overflow-hidden">
        <div
          className="bg-[var(--accent-lime)] h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
