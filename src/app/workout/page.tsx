'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSettings } from '@/context/SettingsContext';
import { db, getAllWorkouts, getAllExercises } from '@/domain/db';
import {
  ActiveDraftWorkout,
  SetStatus,
  BUILT_IN_EXERCISES,
  WorkoutSession,
  ExerciseInstance,
  LoggedSet,
  WorkoutDefinition,
  ExerciseDefinition,
} from '@/domain/types';
import { resolveNextSessionFromHistory } from '@/domain/program';
import { analyzeExerciseHistory, calculateNextWeight } from '@/domain/progression';
import { calculateWarmupSets } from '@/domain/warmups';
import { RestTimer } from '@/components/RestTimer';
import { PlateCalculatorModal } from '@/components/PlateCalculatorModal';
import { WorkoutReviewModal } from '@/components/WorkoutReviewModal';
import {
  Check,
  Layers,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Undo2,
} from 'lucide-react';

function WorkoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings, loading } = useSettings();

  const [draft, setDraft] = useState<ActiveDraftWorkout | null>(null);
  const [selectedPlateCalc, setSelectedPlateCalc] = useState<{ exercise: string; weight: number } | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [historyNotes, setHistoryNotes] = useState<string>('');

  // Initialize or load active draft
  useEffect(() => {
    if (!settings || !settings.onboardingCompleted) return;

    const initWorkout = async () => {
      // 1. Check for existing draft
      const existingDraft = await db.activeDraft.get('active_draft');
      if (existingDraft) {
        setDraft(existingDraft);
        setExpandedExercise(existingDraft.exercises[0]?.exerciseId || null);
        return;
      }

      // 2. Otherwise generate new draft based on target workout definition
      const wList = await getAllWorkouts();
      const eMap = await getAllExercises();

      const allSessions = await db.sessions.toArray();
      const allInstances = await db.exerciseInstances.toArray();
      const allSets = await db.loggedSets.toArray();

      const typeParam = searchParams.get('type');
      const targetSessionId = typeParam || resolveNextSessionFromHistory(allSessions, wList);
      const targetWorkout = wList.find((w) => w.id === targetSessionId) || wList[0];

      const draftExercises = targetWorkout.exerciseIds.map((exId) => {
        const def = eMap[exId] || {
          id: exId,
          name: exId,
          workingSets: 5,
          repsPerSet: 5,
          defaultIncrement: 2.5,
          isPlateLoadable: true,
        };
        const history = analyzeExerciseHistory(exId, allSessions, allInstances, allSets);
        const rec = calculateNextWeight(exId, settings, history, def);

        // Only plate-loadable exercises calculate barbell warmups
        const warmups = def.isPlateLoadable
          ? calculateWarmupSets(rec.prescribedWeight, settings.barWeight, settings.availablePlates)
          : [];

        const instanceId = `inst-${Date.now()}-${exId}`;

        return {
          instanceId,
          exerciseId: exId,
          exerciseName: def.name,
          prescribedWeight: rec.prescribedWeight,
          painFlag: false,
          userOverrideReason: '',
          isPlateLoadable: def.isPlateLoadable,
          warmupSets: warmups.map((w, idx) => ({
            id: `warmup-${instanceId}-${idx + 1}`,
            setIndex: idx + 1,
            prescribedWeight: w.weight,
            actualWeight: w.weight,
            prescribedReps: w.reps,
            actualReps: w.reps,
            status: 'completed' as SetStatus,
          })),
          workingSets: Array.from({ length: def.workingSets }).map((_, idx) => ({
            id: `work-${instanceId}-${idx + 1}`,
            setIndex: idx + 1,
            prescribedWeight: rec.prescribedWeight,
            actualWeight: rec.prescribedWeight,
            prescribedReps: def.repsPerSet,
            actualReps: def.repsPerSet,
            status: 'skipped' as SetStatus,
          })),
        };
      });

      const newDraft: ActiveDraftWorkout = {
        id: 'active_draft',
        sessionType: targetWorkout.id,
        sessionName: targetWorkout.name,
        startedAt: Date.now(),
        exercises: draftExercises,
      };

      await db.activeDraft.put(newDraft);
      setDraft(newDraft);
      setExpandedExercise(draftExercises[0]?.exerciseId || null);
    };

    initWorkout();
  }, [settings, searchParams]);

  // Persist mutations locally to IndexedDB immediately
  const persistDraft = async (updated: ActiveDraftWorkout) => {
    setDraft(updated);
    await db.activeDraft.put(updated);
  };

  if (loading || !draft || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-pulse text-[var(--accent-lime)] font-mono text-sm">
          Preparing workout session...
        </div>
      </div>
    );
  }

  // Set action handlers: success, missed, skip, edit
  const handleSetSuccess = async (exIndex: number, setIndex: number) => {
    const nextDraft = structuredClone(draft);
    const set = nextDraft.exercises[exIndex].workingSets[setIndex];
    set.status = 'completed';
    set.actualReps = set.prescribedReps;

    // Trigger Rest Timer
    const restEnd = Date.now() + settings.restTimerDurationSec * 1000;
    nextDraft.restTimer = {
      endTimestamp: restEnd,
      durationSeconds: settings.restTimerDurationSec,
    };

    // Auto-advance to next exercise if this was the last set of current exercise
    if (setIndex === nextDraft.exercises[exIndex].workingSets.length - 1) {
      const nextExIndex = exIndex + 1;
      if (nextExIndex < nextDraft.exercises.length) {
        setExpandedExercise(nextDraft.exercises[nextExIndex].exerciseId);
      }
    }

    await persistDraft(nextDraft);
  };

  const handleSetMissed = async (exIndex: number, setIndex: number, reps: number) => {
    const nextDraft = structuredClone(draft);
    const set = nextDraft.exercises[exIndex].workingSets[setIndex];
    set.status = 'missed';
    set.actualReps = reps;

    // Trigger Rest Timer
    const restEnd = Date.now() + settings.restTimerDurationSec * 1000;
    nextDraft.restTimer = {
      endTimestamp: restEnd,
      durationSeconds: settings.restTimerDurationSec,
    };

    await persistDraft(nextDraft);
  };

  const handleSetReset = async (exIndex: number, setIndex: number) => {
    const nextDraft = structuredClone(draft);
    const set = nextDraft.exercises[exIndex].workingSets[setIndex];
    set.status = 'skipped';
    set.actualReps = set.prescribedReps;
    await persistDraft(nextDraft);
  };

  const handleWeightOverride = async (exIndex: number, newWeight: number) => {
    const nextDraft = structuredClone(draft);
    const ex = nextDraft.exercises[exIndex];
    ex.prescribedWeight = newWeight;
    ex.workingSets.forEach((s) => {
      s.prescribedWeight = newWeight;
      s.actualWeight = newWeight;
    });

    if (ex.isPlateLoadable) {
      const newWarmups = calculateWarmupSets(newWeight, settings.barWeight, settings.availablePlates);
      ex.warmupSets = newWarmups.map((w, idx) => ({
        id: `warmup-${ex.instanceId}-${idx + 1}`,
        setIndex: idx + 1,
        prescribedWeight: w.weight,
        actualWeight: w.weight,
        prescribedReps: w.reps,
        actualReps: w.reps,
        status: 'completed',
      }));
    }
    await persistDraft(nextDraft);
  };

  const handleTogglePain = async (exIndex: number) => {
    const nextDraft = structuredClone(draft);
    nextDraft.exercises[exIndex].painFlag = !nextDraft.exercises[exIndex].painFlag;
    await persistDraft(nextDraft);
  };

  const handleUpdateTimer = async (
    endTimestamp: number | undefined,
    duration: number,
    pausedSeconds?: number
  ) => {
    const nextDraft = structuredClone(draft);
    if (!endTimestamp && !pausedSeconds) {
      delete nextDraft.restTimer;
    } else {
      nextDraft.restTimer = {
        endTimestamp: endTimestamp || 0,
        durationSeconds: duration,
        pausedRemainingSeconds: pausedSeconds,
      };
    }
    await persistDraft(nextDraft);
  };

  // Finalize workout to historical tables and clear active draft
  const handleConfirmFinish = async (notes?: string) => {
    const sessionId = `session-${Date.now()}`;
    const completedAt = Date.now();

    const sessionRecord: WorkoutSession = {
      id: sessionId,
      programVersion: 'v2.0',
      sessionType: draft.sessionType,
      sessionName: draft.sessionName || `Workout ${draft.sessionType}`,
      status: 'completed',
      startedAt: draft.startedAt,
      completedAt,
      notes: notes || historyNotes || undefined,
    };

    const instanceRecords: ExerciseInstance[] = [];
    const setRecords: LoggedSet[] = [];

    draft.exercises.forEach((ex) => {
      const instId = `inst-${sessionId}-${ex.exerciseId}`;

      instanceRecords.push({
        id: instId,
        sessionId,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        targetSets: ex.workingSets.length,
        targetReps: ex.workingSets[0]?.prescribedReps || 5,
        prescribedWeight: ex.prescribedWeight,
        actualWeight: ex.prescribedWeight,
        painFlag: ex.painFlag,
        userOverrideReason: ex.userOverrideReason,
      });

      // Warmups
      ex.warmupSets.forEach((ws) => {
        setRecords.push({
          id: `set-warm-${instId}-${ws.setIndex}`,
          exerciseInstanceId: instId,
          sessionId,
          exerciseId: ex.exerciseId,
          setIndex: ws.setIndex,
          setType: 'warmup',
          prescribedWeight: ws.prescribedWeight,
          prescribedReps: ws.prescribedReps,
          actualWeight: ws.actualWeight,
          actualReps: ws.actualReps,
          status: ws.status,
          completedAt,
        });
      });

      // Working sets
      ex.workingSets.forEach((ws) => {
        setRecords.push({
          id: `set-work-${instId}-${ws.setIndex}`,
          exerciseInstanceId: instId,
          sessionId,
          exerciseId: ex.exerciseId,
          setIndex: ws.setIndex,
          setType: 'working',
          prescribedWeight: ws.prescribedWeight,
          prescribedReps: ws.prescribedReps,
          actualWeight: ws.actualWeight,
          actualReps: ws.actualReps,
          status: ws.status,
          completedAt,
        });
      });
    });

    await db.transaction('rw', db.sessions, db.exerciseInstances, db.loggedSets, db.activeDraft, async () => {
      await db.sessions.put(sessionRecord);
      await db.exerciseInstances.bulkPut(instanceRecords);
      await db.loggedSets.bulkPut(setRecords);
      await db.activeDraft.delete('active_draft');
    });

    router.push(`/history/detail/?id=${sessionId}`);
  };

  const handleAbandon = async () => {
    if (confirm('Discard this workout draft? All unrecorded sets will be lost.')) {
      await db.activeDraft.delete('active_draft');
      router.push('/');
    }
  };

  const workoutHeading = draft.sessionName || `Workout ${draft.sessionType}`;

  return (
    <div className="max-w-md mx-auto p-4 pb-28 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-[var(--accent-lime)] uppercase tracking-wider">
            Active Workout
          </span>
          <h1 className="text-2xl font-black text-[var(--foreground)]">{workoutHeading}</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAbandon}
            className="text-xs text-[var(--danger)] font-semibold p-2 rounded-lg hover:bg-rose-500/10 min-w-[44px] min-h-[44px]"
          >
            Discard
          </button>
          <button
            onClick={() => setIsReviewOpen(true)}
            className="bg-[var(--accent-lime)] text-black font-extrabold px-4 py-2 rounded-xl text-xs shadow-md min-h-[44px] flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Finish
          </button>
        </div>
      </div>

      {/* Rest Timer Widget */}
      <RestTimer
        endTimestamp={draft.restTimer?.endTimestamp}
        durationSeconds={draft.restTimer?.durationSeconds || settings.restTimerDurationSec}
        onUpdateTimer={handleUpdateTimer}
        soundEnabled={settings.soundEnabled}
      />

      {/* Exercise Accordions */}
      <div className="space-y-4">
        {draft.exercises.map((ex, exIndex) => {
          const isExpanded = expandedExercise === ex.exerciseId;
          const completedCount = ex.workingSets.filter((s) => s.status === 'completed').length;
          const targetSetsCount = ex.workingSets.length;
          const targetRepsCount = ex.workingSets[0]?.prescribedReps || 5;

          return (
            <div
              key={ex.exerciseId}
              className={`bg-[var(--card-bg)] border rounded-2xl transition-all shadow-md overflow-hidden ${
                isExpanded ? 'border-[var(--accent-lime)]/40 ring-1 ring-[var(--accent-lime)]/20' : 'border-[var(--card-border)]'
              }`}
            >
              {/* Exercise Header */}
              <div
                onClick={() => setExpandedExercise(isExpanded ? null : ex.exerciseId)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--card-hover)] transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-[var(--foreground)]">{ex.exerciseName}</h3>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[var(--background)] border border-[var(--card-border)] text-[var(--muted-text)]">
                      {targetSetsCount}x{targetRepsCount}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="font-black text-[var(--accent-lime)] text-sm">
                      {ex.prescribedWeight} {settings.units}
                    </span>
                    <span className="text-[var(--muted-text)]">·</span>
                    <span className="text-[var(--muted-text)]">
                      {completedCount}/{targetSetsCount} done
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {ex.isPlateLoadable && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlateCalc({ exercise: ex.exerciseId, weight: ex.prescribedWeight });
                      }}
                      className="p-2 text-[var(--muted-text)] hover:text-[var(--foreground)] rounded-lg bg-[var(--background)] border border-[var(--card-border)] min-w-[40px] min-h-[40px] flex items-center justify-center"
                      aria-label={`Show plates for ${ex.exerciseName}`}
                    >
                      <Layers className="w-4 h-4" />
                    </button>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-[var(--muted-text)]" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[var(--muted-text)]" />
                  )}
                </div>
              </div>

              {/* Collapsed content */}
              {isExpanded && (
                <div className="p-4 pt-0 border-t border-[var(--card-border)] space-y-4">
                  {/* Controls: Weight adjustment & Pain Flag */}
                  <div className="flex items-center justify-between pt-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--muted-text)] font-semibold">Weight:</span>
                      <input
                        type="number"
                        step={settings.units === 'kg' ? '2.5' : '5'}
                        value={ex.prescribedWeight}
                        onChange={(e) => handleWeightOverride(exIndex, parseFloat(e.target.value) || 0)}
                        className="w-20 bg-[var(--background)] border border-[var(--card-border)] rounded-lg p-1.5 text-center font-mono font-bold text-[var(--foreground)]"
                      />
                      <span className="font-mono text-[var(--muted-text)]">{settings.units}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTogglePain(exIndex)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold min-h-[36px] transition-colors ${
                        ex.painFlag
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-[var(--background)] text-[var(--muted-text)] border-[var(--card-border)]'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Pain Flag
                    </button>
                  </div>

                  {/* Warmup Toggle / List (if plate-loadable) */}
                  {ex.warmupSets.length > 0 && (
                    <div className="bg-[var(--background)] p-3 rounded-xl border border-[var(--card-border)]">
                      <div className="text-[11px] font-bold text-[var(--muted-text)] uppercase tracking-wider mb-2">
                        Warm-up Sets (Non-working)
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ex.warmupSets.map((ws) => (
                          <div
                            key={ws.id}
                            className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg px-2.5 py-1 text-xs font-mono text-[var(--muted-text)]"
                          >
                            Set {ws.setIndex}: <strong className="text-[var(--foreground)]">{ws.prescribedWeight}{settings.units}</strong> × {ws.prescribedReps}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Working Sets Interactive Row (Thumb Friendly Mobile Optimization) */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-[var(--muted-text)] uppercase tracking-wider">
                      Working Sets (Target: {targetRepsCount} reps)
                    </div>

                    {ex.workingSets.map((ws, setIndex) => {
                      const isComplete = ws.status === 'completed';
                      const isMissed = ws.status === 'missed';

                      return (
                        <div
                          key={ws.id}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                            isComplete
                              ? 'bg-[var(--accent-lime)]/10 border-[var(--accent-lime)]/50'
                              : isMissed
                              ? 'bg-rose-500/10 border-rose-500/40'
                              : 'bg-[var(--background)] border-[var(--card-border)]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] flex items-center justify-center font-mono font-bold text-xs text-[var(--foreground)]">
                              {ws.setIndex}
                            </span>
                            <div>
                              <div className="font-mono font-bold text-sm text-[var(--foreground)]">
                                {ws.prescribedWeight} {settings.units}
                              </div>
                              <div className="text-[11px] text-[var(--muted-text)]">
                                {isComplete
                                  ? `Completed ${ws.actualReps} reps`
                                  : isMissed
                                  ? `Missed: ${ws.actualReps}/${ws.prescribedReps} reps`
                                  : `Prescribed: ${ws.prescribedReps} reps`}
                              </div>
                            </div>
                          </div>

                          {/* Quick Ergonomic Set Buttons (Min 48px Touch Targets) */}
                          <div className="flex items-center gap-1.5">
                            {/* Reset / Undo */}
                            {(isComplete || isMissed) && (
                              <button
                                type="button"
                                onClick={() => handleSetReset(exIndex, setIndex)}
                                className="w-11 h-11 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--muted-text)] hover:text-[var(--foreground)] flex items-center justify-center"
                                aria-label="Undo set result"
                              >
                                <Undo2 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Missed Reps Picker */}
                            {!isComplete && (
                              <select
                                aria-label={`Record partial reps for set ${ws.setIndex}`}
                                value={isMissed ? ws.actualReps : ''}
                                onChange={(e) => {
                                  const reps = parseInt(e.target.value, 10);
                                  if (!isNaN(reps)) {
                                    handleSetMissed(exIndex, setIndex, reps);
                                  }
                                }}
                                className="h-11 px-2 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-xs font-bold font-mono text-[var(--foreground)]"
                              >
                                <option value="" disabled>
                                  Missed?
                                </option>
                                {[0, 1, 2, 3, 4].map((r) => (
                                  <option key={r} value={r}>
                                    {r} reps
                                  </option>
                                ))}
                              </select>
                            )}

                            {/* Success Button */}
                            <button
                              type="button"
                              onClick={() => handleSetSuccess(exIndex, setIndex)}
                              className={`h-11 px-4 rounded-xl font-mono font-black text-sm flex items-center justify-center gap-1.5 transition-all min-w-[56px] ${
                                isComplete
                                  ? 'bg-[var(--accent-lime)] text-black shadow-[0_0_15px_var(--accent-lime-glow)]'
                                  : 'bg-[var(--card-hover)] border border-[var(--card-border)] text-[var(--foreground)] hover:border-[var(--accent-lime)]'
                              }`}
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              {ws.prescribedReps}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {selectedPlateCalc && (
        <PlateCalculatorModal
          isOpen={!!selectedPlateCalc}
          onClose={() => setSelectedPlateCalc(null)}
          weight={selectedPlateCalc.weight}
          barWeight={settings.barWeight}
          availablePlates={settings.availablePlates}
          unit={settings.units}
          exerciseName={draft.exercises.find((e) => e.exerciseId === selectedPlateCalc.exercise)?.exerciseName || selectedPlateCalc.exercise}
        />
      )}

      {isReviewOpen && (
        <WorkoutReviewModal
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          onConfirmFinish={handleConfirmFinish}
          draft={draft}
          unit={settings.units}
        />
      )}
    </div>
  );
}

export default function WorkoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="animate-pulse text-[var(--accent-lime)] font-mono text-sm">
            Loading LiftForge Workout...
          </div>
        </div>
      }
    >
      <WorkoutContent />
    </Suspense>
  );
}
