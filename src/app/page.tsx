'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSettings } from '@/context/SettingsContext';
import { db, getAllWorkouts, getAllExercises } from '@/domain/db';
import {
  WorkoutSession,
  ProgressionRecommendation,
  WorkoutDefinition,
  ExerciseDefinition,
  BUILT_IN_EXERCISES,
} from '@/domain/types';
import { resolveNextSessionFromHistory } from '@/domain/program';
import { analyzeExerciseHistory, calculateNextWeight } from '@/domain/progression';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { PlateCalculatorModal } from '@/components/PlateCalculatorModal';
import { LiftForgeIcon } from '@/components/LiftForgeIcon';
import {
  Play,
  ArrowUpRight,
  Flame,
  Layers,
  Clock,
  ChevronDown,
} from 'lucide-react';

export default function TodayPage() {
  const { settings, loading, reloadSettings } = useSettings();
  const [activeDraft, setActiveDraft] = useState<boolean>(false);
  const [workouts, setWorkouts] = useState<WorkoutDefinition[]>([]);
  const [allExercises, setAllExercises] = useState<Record<string, ExerciseDefinition>>(BUILT_IN_EXERCISES);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>('A');
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);
  const [recommendations, setRecommendations] = useState<ProgressionRecommendation[]>([]);
  const [selectedCalc, setSelectedCalc] = useState<{ exercise: string; weight: number } | null>(null);

  useEffect(() => {
    if (!settings || !settings.onboardingCompleted) return;

    const loadData = async () => {
      const draft = await db.activeDraft.get('active_draft');
      setActiveDraft(!!draft);

      const wList = await getAllWorkouts();
      const eMap = await getAllExercises();
      setWorkouts(wList);
      setAllExercises(eMap);

      const allSessions = await db.sessions.toArray();
      const allInstances = await db.exerciseInstances.toArray();
      const allSets = await db.loggedSets.toArray();

      const nextId = resolveNextSessionFromHistory(allSessions, wList);
      setSelectedWorkoutId(nextId);

      const completed = allSessions
        .filter((s) => s.status === 'completed' && s.completedAt)
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

      if (completed.length > 0) {
        setLastSession(completed[0]);
      }

      // Compute progression recommendations for the chosen workout
      const currentWorkout = wList.find((w) => w.id === nextId) || wList[0];
      if (currentWorkout) {
        const recs: ProgressionRecommendation[] = [];
        for (const exId of currentWorkout.exerciseIds) {
          const exDef = eMap[exId];
          const history = analyzeExerciseHistory(exId, allSessions, allInstances, allSets);
          const rec = calculateNextWeight(exId, settings, history, exDef);
          recs.push(rec);
        }
        setRecommendations(recs);
      }
    };

    loadData();
  }, [settings]);

  // When user switches workout manually on Today screen
  const handleSelectWorkout = async (wId: string) => {
    setSelectedWorkoutId(wId);
    if (!settings) return;

    const allSessions = await db.sessions.toArray();
    const allInstances = await db.exerciseInstances.toArray();
    const allSets = await db.loggedSets.toArray();

    const targetW = workouts.find((w) => w.id === wId);
    if (targetW) {
      const recs: ProgressionRecommendation[] = [];
      for (const exId of targetW.exerciseIds) {
        const exDef = allExercises[exId];
        const history = analyzeExerciseHistory(exId, allSessions, allInstances, allSets);
        const rec = calculateNextWeight(exId, settings, history, exDef);
        recs.push(rec);
      }
      setRecommendations(recs);
    }
  };

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

  const currentWorkout = workouts.find((w) => w.id === selectedWorkoutId) || workouts[0];
  const workoutDisplayName = currentWorkout?.name || `Workout ${selectedWorkoutId}`;

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-6 animate-in fade-in duration-150">
      {/* Header with Custom Logo */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] flex items-center justify-center p-1.5 shadow-sm">
              <LiftForgeIcon className="w-full h-full" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">LiftForge</h1>
              <p className="text-[11px] text-[var(--muted-text)] font-medium -mt-0.5">Strength Progression System</p>
            </div>
          </div>
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

        {/* Workout Selector Title & Switcher */}
        <div className="flex flex-col gap-1 mb-5">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black tracking-tight text-[var(--foreground)]">
              {workoutDisplayName}
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--card-hover)] text-[var(--muted-text)] border border-[var(--card-border)]">
              Rotation ({workouts.length})
            </span>
          </div>

          {/* Quick manual workout picker */}
          {workouts.length > 1 && (
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] text-[var(--muted-text)] uppercase font-bold shrink-0">Switch:</span>
              {workouts.map((w) => {
                const isSelected = w.id === selectedWorkoutId;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => handleSelectWorkout(w.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors min-h-[32px] ${
                      isSelected
                        ? 'bg-[var(--accent-lime)] text-black'
                        : 'bg-[var(--background)] text-[var(--muted-text)] border border-[var(--card-border)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {w.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Coach Plateau / Deload / Long Break Notice */}
        {recommendations.some(
          (r) => r.isDeload || (r.breakDaysDetected && r.breakDaysDetected >= (settings.breakDaysThreshold || 14))
        ) && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Flame className="w-4 h-4 text-amber-400" />
              Coach Adaptation Notice
            </div>
            {recommendations
              .filter(
                (r) => r.isDeload || (r.breakDaysDetected && r.breakDaysDetected >= (settings.breakDaysThreshold || 14))
              )
              .map((r) => {
                const exDef = allExercises[r.exerciseId];
                return (
                  <p key={r.exerciseId} className="text-xs text-[var(--foreground)] leading-relaxed">
                    <strong className="text-amber-400 font-semibold">{exDef?.name || r.exerciseId}:</strong>{' '}
                    {r.explanation}
                  </p>
                );
              })}
          </div>
        )}

        {/* Exercises list with recommendations */}
        <div className="space-y-3 mb-6">
          {recommendations.map((rec) => {
            const def = allExercises[rec.exerciseId] || {
              id: rec.exerciseId,
              name: rec.exerciseId,
              workingSets: 5,
              repsPerSet: 5,
              isPlateLoadable: true,
            };
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
                  {def.isPlateLoadable && (
                    <button
                      onClick={() => setSelectedCalc({ exercise: rec.exerciseId, weight: rec.prescribedWeight })}
                      className="p-2 text-[var(--muted-text)] hover:text-[var(--accent-lime)] rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center bg-[var(--card-bg)] border border-[var(--card-border)]"
                      aria-label={`View plates for ${def.name}`}
                    >
                      <Layers className="w-4 h-4" />
                    </button>
                  )}
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
          href={`/workout?type=${selectedWorkoutId}`}
          className="w-full bg-[var(--accent-lime)] text-black font-extrabold py-4 rounded-2xl flex items-center justify-center gap-2 text-base shadow-[0_0_20px_var(--accent-lime-glow)] hover:opacity-95 transition-all min-h-[56px]"
        >
          <Play className="w-5 h-5 fill-current" />
          {activeDraft ? 'Continue Workout' : `Start ${workoutDisplayName}`}
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
              {lastSession.sessionName || `Workout ${lastSession.sessionType}`} Completed
            </div>
            <Link
              href={`/history/detail/?id=${lastSession.id}`}
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
          exerciseName={allExercises[selectedCalc.exercise]?.name || selectedCalc.exercise}
        />
      )}
    </div>
  );
}
