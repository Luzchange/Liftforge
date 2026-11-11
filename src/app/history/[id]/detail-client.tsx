'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/domain/db';
import { WorkoutSession, ExerciseInstance, LoggedSet } from '@/domain/types';
import { useSettings } from '@/context/SettingsContext';
import { ArrowLeft, Calendar, Clock, Check, X, Layers, AlertTriangle } from 'lucide-react';

export default function SessionDetailPageClient({ id }: { id: string }) {
  const router = useRouter();
  const { settings, loading } = useSettings();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [instances, setInstances] = useState<ExerciseInstance[]>([]);
  const [sets, setSets] = useState<LoggedSet[]>([]);

  useEffect(() => {
    const loadSession = async () => {
      // In static export or direct navigation, if id matches a record, load it, otherwise check latest
      let s = await db.sessions.get(id);
      if (!s) {
        const all = await db.sessions.toArray();
        if (all.length > 0) {
          s = all[all.length - 1];
        }
      }
      if (!s) {
        router.push('/history');
        return;
      }
      const insts = await db.exerciseInstances.where('sessionId').equals(s.id).toArray();
      const st = await db.loggedSets.where('sessionId').equals(s.id).toArray();

      setSession(s);
      setInstances(insts);
      setSets(st);
    };

    loadSession();
  }, [id, router]);

  if (loading || !session || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-pulse text-[var(--accent-lime)] font-mono text-sm">
          Loading Workout Log...
        </div>
      </div>
    );
  }

  // Calculate session stats
  const workingSets = sets.filter((s) => s.setType === 'working');
  const totalVolume = workingSets.reduce(
    (acc, cur) => (cur.status === 'completed' || cur.status === 'missed' ? acc + cur.actualWeight * cur.actualReps : acc),
    0
  );

  const durationMin = session.completedAt
    ? Math.round((session.completedAt - session.startedAt) / (1000 * 60))
    : 0;

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-6">
      <div className="flex items-center gap-3 pt-2">
        <Link
          href="/history"
          className="p-2 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] min-w-[40px] min-h-[40px] flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <span className="text-xs font-bold text-[var(--accent-lime)] uppercase tracking-wider">
            Workout Details
          </span>
          <h1 className="text-xl font-black text-[var(--foreground)]">Workout {session.sessionType}</h1>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[var(--card-bg)] p-3 rounded-2xl border border-[var(--card-border)] text-center">
          <div className="text-[10px] text-[var(--muted-text)] uppercase font-semibold">Date</div>
          <div className="text-xs font-mono font-bold text-[var(--foreground)] mt-1">
            {session.completedAt ? new Date(session.completedAt).toLocaleDateString() : 'N/A'}
          </div>
        </div>
        <div className="bg-[var(--card-bg)] p-3 rounded-2xl border border-[var(--card-border)] text-center">
          <div className="text-[10px] text-[var(--muted-text)] uppercase font-semibold">Duration</div>
          <div className="text-xs font-mono font-bold text-[var(--foreground)] mt-1">{durationMin} mins</div>
        </div>
        <div className="bg-[var(--card-bg)] p-3 rounded-2xl border border-[var(--card-border)] text-center">
          <div className="text-[10px] text-[var(--muted-text)] uppercase font-semibold">Volume</div>
          <div className="text-xs font-mono font-bold text-[var(--accent-lime)] mt-1">
            {Math.round(totalVolume)} {settings.units}
          </div>
        </div>
      </div>

      {/* Exercises Log Breakdown */}
      <div className="space-y-4">
        {instances.map((inst) => {
          const instSets = sets.filter((s) => s.exerciseInstanceId === inst.id && s.setType === 'working');

          return (
            <div
              key={inst.id}
              className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-[var(--foreground)]">{inst.exerciseName}</h3>
                  <div className="text-xs font-mono text-[var(--accent-lime)]">
                    {inst.prescribedWeight} {settings.units} × {inst.targetSets} sets
                  </div>
                </div>

                {inst.painFlag && (
                  <span className="text-[11px] bg-rose-500/20 text-rose-300 font-semibold px-2 py-0.5 rounded-full border border-rose-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Pain flagged
                  </span>
                )}
              </div>

              {/* Set Pills */}
              <div className="grid grid-cols-5 gap-2 pt-1">
                {instSets.map((s) => {
                  const isDone = s.status === 'completed';
                  const isMiss = s.status === 'missed';
                  return (
                    <div
                      key={s.id}
                      className={`p-2 rounded-xl border text-center font-mono ${
                        isDone
                          ? 'bg-[var(--accent-lime)] text-black border-[var(--accent-lime)] font-bold'
                          : isMiss
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                          : 'bg-[var(--background)] text-[var(--muted-text)] border-[var(--card-border)]'
                      }`}
                    >
                      <div className="text-[10px] uppercase opacity-75">Set {s.setIndex}</div>
                      <div className="text-base">{s.actualReps}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {session.notes && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4">
          <div className="text-xs font-semibold text-[var(--muted-text)] uppercase tracking-wider mb-1">
            Session Notes
          </div>
          <p className="text-sm text-[var(--foreground)]">{session.notes}</p>
        </div>
      )}
    </div>
  );
}
