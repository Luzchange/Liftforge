'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/domain/db';
import { WorkoutSession, ExerciseInstance, LoggedSet } from '@/domain/types';
import { useSettings } from '@/context/SettingsContext';
import { Calendar, ChevronRight, CheckCircle2, AlertCircle, Dumbbell } from 'lucide-react';

export default function HistoryPage() {
  const { settings, loading } = useSettings();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [instances, setInstances] = useState<ExerciseInstance[]>([]);
  const [sets, setSets] = useState<LoggedSet[]>([]);
  const [filterDemo, setFilterDemo] = useState<boolean>(false);

  useEffect(() => {
    const loadHistory = async () => {
      const allSessions = await db.sessions.toArray();
      const allInstances = await db.exerciseInstances.toArray();
      const allSets = await db.loggedSets.toArray();

      allSessions.sort((a, b) => (b.completedAt || b.startedAt) - (a.completedAt || a.startedAt));

      setSessions(allSessions);
      setInstances(allInstances);
      setSets(allSets);
    };

    loadHistory();
  }, []);

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-pulse text-[var(--accent-lime)] font-mono text-sm">
          Loading History...
        </div>
      </div>
    );
  }

  const displayedSessions = filterDemo
    ? sessions.filter((s) => !s.isDemoData)
    : sessions;

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-5">
      <div className="flex items-center justify-between pt-2">
        <div>
          <span className="text-xs font-bold text-[var(--accent-lime)] uppercase tracking-wider">
            Training Log
          </span>
          <h1 className="text-2xl font-black text-[var(--foreground)]">Session History</h1>
        </div>

        <button
          onClick={() => setFilterDemo(!filterDemo)}
          className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors ${
            filterDemo
              ? 'bg-[var(--accent-lime)] text-black border-[var(--accent-lime)]'
              : 'bg-[var(--card-bg)] text-[var(--muted-text)] border-[var(--card-border)]'
          }`}
        >
          {filterDemo ? 'Real Data Only' : 'Showing All (incl. Demo)'}
        </button>
      </div>

      {displayedSessions.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-8 text-center space-y-3">
          <Dumbbell className="w-10 h-10 text-[var(--muted-text)] mx-auto opacity-40" />
          <h3 className="font-bold text-base text-[var(--foreground)]">No Completed Workouts Yet</h3>
          <p className="text-xs text-[var(--muted-text)] max-w-xs mx-auto">
            Complete your first session from the Today screen or import sample data from Settings.
          </p>
          <Link
            href="/"
            className="inline-block bg-[var(--accent-lime)] text-black font-bold px-4 py-2 rounded-xl text-xs"
          >
            Go to Today
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedSessions.map((session) => {
            const sessionInstances = instances.filter((i) => i.sessionId === session.id);
            const sessionSets = sets.filter((s) => s.sessionId === session.id && s.setType === 'working');

            const totalSets = sessionSets.length;
            const completedSets = sessionSets.filter((s) => s.status === 'completed').length;
            const missedSets = sessionSets.filter((s) => s.status === 'missed').length;

            const dateStr = session.completedAt
              ? new Date(session.completedAt).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Incomplete';

            return (
              <Link
                key={session.id}
                href={`/history/detail/?id=${session.id}`}
                className="block bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-[var(--accent-lime)]/40 rounded-2xl p-4 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-[var(--accent-lime)] text-black px-2 py-0.5 rounded-md">
                      Workout {session.sessionType}
                    </span>
                    {session.isDemoData && (
                      <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md">
                        Demo
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-[var(--muted-text)]">{dateStr}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-xs text-[var(--muted-text)] flex flex-wrap gap-2">
                      {sessionInstances.map((inst) => (
                        <span key={inst.id} className="text-[var(--foreground)] font-medium">
                          {inst.exerciseName} ({inst.prescribedWeight}{settings.units})
                        </span>
                      ))}
                    </div>
                    <div className="text-[11px] text-[var(--muted-text)] font-mono">
                      Sets: {completedSets}/{totalSets} completed {missedSets > 0 && `· ${missedSets} missed`}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-[var(--muted-text)] shrink-0 ml-2" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
