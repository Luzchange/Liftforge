'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSettings } from '@/context/SettingsContext';
import { db } from '@/domain/db';
import { WorkoutSession, ExerciseInstance, LoggedSet, SessionType, ExerciseId, ProgressionRecommendation, EXERCISE_DEFINITIONS } from '@/domain/types';
import { resolveNextSessionFromHistory } from '@/domain/program';
import { analyzeExerciseHistory, calculateNextWeight } from '@/domain/progression';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { PlateCalculatorModal } from '@/components/PlateCalculatorModal';
import { Play, Dumbbell, Calendar, AlertCircle, ArrowUpRight, Flame, Layers, Clock } from 'lucide-react';

export default function TodayPage() {
  const { settings, loading, reloadSettings } = useSettings();
  const [activeDraft, setActiveDraft] = useState<boolean>(false);
  const [nextSessionType, setNextSessionType] = useState<SessionType>('A');
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);
  const [recommendations, setRecommendations] = useState<ProgressionRecommendation[]>([]);
  const [selectedCalc, setSelectedCalc] = useState<{ exercise: ExerciseId; weight: number } | null>(null);

  useEffect(() => {
    if (!settings || !settings.onboardingCompleted) return;

    const loadData = async () => {
      const draft = await db.activeDraft.get('active_draft');
      setActiveDraft(!!draft);

      const allSessions = await db.sessions.toArray();
      const allInstances = await db.exerciseInstances.toArray();
      const allSets = await db.loggedSets.toArray();

      const nextType = resolveNextSessionFromHistory(allSessions);
      setNextSessionType(nextType);

      const completed = allSessions
        .filter((s) => s.status === 'completed' && s.completedAt)
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

      if (completed.length > 0) {
        setLastSession(completed[0]);
      }

      // Calculate recommendations for the upcoming workout
      const upcomingExercises: ExerciseId[] = nextType === 'A' ? ['squat', 'bench', 'row'] : ['squat', 'ohp', 'deadlift'];
      const recs: ProgressionRecommendation[] = [];

      for (const ex of upcomingExercises) {
        const history = analyzeExerciseHistory(ex, allSessions, allInstances, allSets);
        const rec = calculateNextWeight(ex, settings, history);
        recs.push(rec);
      }

      setRecommendations(recs);
    };

    loadData();
  }, [settings]);

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-pulse text-[var(--accent-lime)] font-mono text-sm">
          Loading LiftForge...
        </div>
      </div>
    );
  }

  if (!settings.onboardingCompleted) {
    return <OnboardingWizard onComplete={() => reloadSettings()} />;
  }

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-lime)] shadow-[0_0_8px_var(--accent-lime-glow)]" />
            <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">LiftForge</h1>
          </div>
          <p className="text-xs text-[var(--muted-text)] font-medium mt-0.5">Strength Progression System</p>
        </div>

        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] px-3 py-1.5 rounded-full text-xs font-mono font-semibold text-[var(--foreground)]">
          {settings.units.toUpperCase()} · {settings.barWeight}{settings.units} bar
        </div>
      </div>

      {/* Active Workout Banner if Draft Exists */}
      {activeDraft && (
        <div className="p-4 bg-[var(--accent-lime)]/10 border border-[var(--accent-lime)]/40 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-[var(--accent-lime)] uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-lime)] animate-ping" />
              Workout in Progress
            </span>
            <div className="text-sm font-bold text-[var(--foreground)]">Unsaved session in progress</div>
          </div>
          <Link
            href="/workout"
            className="bg-[var(--accent-lime)] text-black font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1 shadow-md hover:opacity-95"
          >
            Resume
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
          </Link>
        </div>
      )}

      {/* Next Scheduled Session Card */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-lime-glow)] rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-lime)]">
            Next Session
          </span>
          <span className="text-xs font-mono text-[var(--muted-text)] flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            ~45 mins
          </span>
        </div>

        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-3xl font-black tracking-tight text-[var(--foreground)]">
            Workout {nextSessionType}
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--card-hover)] text-[var(--muted-text)] border border-[var(--card-border)]">
            Target 3x / week
          </span>
        </div>

        {/* Coach Plateau / Deload / Long Break Notice */}
        {recommendations.some((r) => r.isDeload || (r.breakDaysDetected && r.breakDaysDetected >= (settings.breakDaysThreshold || 14))) && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Flame className="w-4 h-4 text-amber-400" />
              Coach Adaptation Notice
            </div>
            {recommendations
              .filter((r) => r.isDeload || (r.breakDaysDetected && r.breakDaysDetected >= (settings.breakDaysThreshold || 14)))
              .map((r) => (
                <p key={r.exerciseId} className="text-xs text-[var(--foreground)] leading-relaxed">
                  <strong className="text-amber-400 font-semibold">{EXERCISE_DEFINITIONS[r.exerciseId].name}:</strong>{' '}
                  {r.explanation}
                </p>
              ))}
          </div>
        )}

        {/* Exercises list with recommendations */}
        <div className="space-y-3 mb-6">
          {recommendations.map((rec) => {
            const def = EXERCISE_DEFINITIONS[rec.exerciseId];
            return (
              <div
                key={rec.exerciseId}
                className="bg-[var(--background)] p-3.5 rounded-2xl border border-[var(--card-border)] flex items-center justify-between transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--foreground)]">{def.name}</span>
                    <span className="text-[11px] font-mono text-[var(--muted-text)] bg-[var(--card-bg)] px-2 py-0.5 rounded-md border border-[var(--card-border)]">
                      {def.workingSets}x{def.repsPerSet}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted-text)] line-clamp-1">{rec.explanation}</p>
                </div>

                <div className="flex items-center gap-2 pl-2">
                  <button
                    onClick={() => setSelectedCalc({ exercise: rec.exerciseId, weight: rec.prescribedWeight })}
                    className="p-2 text-[var(--muted-text)] hover:text-[var(--accent-lime)] rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center bg-[var(--card-bg)] border border-[var(--card-border)]"
                    aria-label={`View plates for ${def.name}`}
                  >
                    <Layers className="w-4 h-4" />
                  </button>
                  <div className="text-right whitespace-nowrap">
                    <span className="font-mono font-black text-xl text-[var(--foreground)]">
                      {rec.prescribedWeight}
                    </span>
                    <span className="text-xs text-[var(--muted-text)] uppercase font-mono ml-1 font-semibold">
                      {settings.units}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Start Button */}
        <Link
          href={`/workout?type=${nextSessionType}`}
          className="w-full bg-[var(--accent-lime)] text-black font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 text-base shadow-[0_0_20px_var(--accent-lime-glow)] hover:opacity-95 transition-all min-h-[56px]"
        >
          <Play className="w-5 h-5 fill-current" />
          {activeDraft ? 'Continue Workout' : `Start Workout ${nextSessionType}`}
        </Link>
      </div>

      {/* Last Completed Session Card */}
      {lastSession && (
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--muted-text)] uppercase tracking-wider">
              Last Completed
            </span>
            <span className="text-xs font-mono text-[var(--muted-text)]">
              {lastSession.completedAt ? new Date(lastSession.completedAt).toLocaleDateString() : ''}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="font-bold text-base text-[var(--foreground)]">
              Workout {lastSession.sessionType} Completed
            </div>
            <Link
              href={`/history/${lastSession.id}`}
              className="text-xs font-bold text-[var(--accent-lime)] flex items-center gap-1 hover:underline"
            >
              View Log
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Plate Calculator Modal */}
      {selectedCalc && (
        <PlateCalculatorModal
          isOpen={!!selectedCalc}
          onClose={() => setSelectedCalc(null)}
          weight={selectedCalc.weight}
          barWeight={settings.barWeight}
          availablePlates={settings.availablePlates}
          unit={settings.units}
          exerciseName={EXERCISE_DEFINITIONS[selectedCalc.exercise].name}
        />
      )}
    </div>
  );
}
