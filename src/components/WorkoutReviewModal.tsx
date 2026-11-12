'use client';

import React, { useState } from 'react';
import { ActiveDraftWorkout } from '@/domain/types';
import { EXERCISE_DEFINITIONS } from '@/domain/types';
import { AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';

interface WorkoutReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmFinish: (notes?: string) => void;
  draft: ActiveDraftWorkout;
  unit: string;
}

export function WorkoutReviewModal({
  isOpen,
  onClose,
  onConfirmFinish,
  draft,
  unit,
}: WorkoutReviewModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [sessionNotes, setSessionNotes] = useState(draft.notes || '');

  if (!isOpen) return null;

  // Calculate session summary stats
  let totalWorkingSets = 0;
  let completedSets = 0;
  let missedSets = 0;
  let skippedSets = 0;
  let totalVolume = 0;

  draft.exercises.forEach((ex) => {
    ex.workingSets.forEach((set) => {
      totalWorkingSets += 1;
      if (set.status === 'completed') {
        completedSets += 1;
        totalVolume += set.actualWeight * set.actualReps;
      } else if (set.status === 'missed') {
        missedSets += 1;
        totalVolume += set.actualWeight * set.actualReps;
      } else if (set.status === 'skipped') {
        skippedSets += 1;
      }
    });
  });

  const hasIncompleteSets = draft.exercises.some((ex) =>
    ex.workingSets.some((s) => s.status === 'skipped' || (s.actualReps === 0 && s.status !== 'completed'))
  );

  const handleFinish = async () => {
    setSubmitting(true);
    await onConfirmFinish(sessionNotes);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-3">
          <div>
            <span className="text-xs font-bold text-[var(--accent-lime)] uppercase tracking-wider">
              Verification Required
            </span>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Review Workout {draft.sessionType}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--muted-text)] hover:text-[var(--foreground)] min-w-[40px] min-h-[40px]"
            aria-label="Back to workout"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {hasIncompleteSets && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--foreground)] leading-relaxed">
              <strong className="font-semibold block text-amber-400">Unrecorded / Skipped Sets</strong>
              Some sets were left skipped or incomplete. Progression recommendations will take unrecorded sets into account without penalizing unattempted work.
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-[var(--background)] p-3 rounded-xl border border-[var(--card-border)]">
            <div className="text-[10px] text-[var(--muted-text)] uppercase font-bold">Completed</div>
            <div className="text-xl font-mono font-black text-[var(--accent-lime)] mt-1">
              {completedSets}/{totalWorkingSets}
            </div>
          </div>
          <div className="bg-[var(--background)] p-3 rounded-xl border border-[var(--card-border)]">
            <div className="text-[10px] text-[var(--muted-text)] uppercase font-bold">Missed / Under</div>
            <div className="text-xl font-mono font-black text-rose-400 mt-1">{missedSets}</div>
          </div>
          <div className="bg-[var(--background)] p-3 rounded-xl border border-[var(--card-border)]">
            <div className="text-[10px] text-[var(--muted-text)] uppercase font-bold">Total Volume</div>
            <div className="text-xl font-mono font-black text-[var(--foreground)] mt-1">
              {Math.round(totalVolume)} <span className="text-xs font-normal">{unit}</span>
            </div>
          </div>
        </div>

        {/* Per exercise breakdown */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase text-[var(--muted-text)]">Exercise Breakdown</div>
          {draft.exercises.map((ex) => {
            const def = EXERCISE_DEFINITIONS[ex.exerciseId];
            const repSummary = ex.workingSets
              .map((s) => {
                if (s.status === 'completed') return `${s.actualReps}`;
                if (s.status === 'missed') return `${s.actualReps}*`;
                return '-';
              })
              .join(' · ');

            return (
              <div
                key={ex.exerciseId}
                className="bg-[var(--background)] p-3 rounded-xl border border-[var(--card-border)] flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-sm text-[var(--foreground)]">{def.name}</div>
                  <div className="text-xs text-[var(--muted-text)] font-mono mt-0.5">
                    {ex.prescribedWeight} {unit} | Reps: {repSummary}
                  </div>
                </div>
                {ex.painFlag && (
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 font-semibold px-2 py-0.5 rounded-full border border-rose-500/30">
                    Pain flagged
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Session Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-[var(--muted-text)]">Session Notes (Optional)</label>
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="E.g., Felt strong on squats, paused at bottom. Form was tight."
            rows={2}
            className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-3 text-xs text-[var(--foreground)] focus:border-[var(--accent-lime)] focus:outline-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="w-1/3 bg-[var(--card-hover)] border border-[var(--card-border)] text-[var(--foreground)] font-semibold py-3.5 rounded-xl text-sm min-h-[50px]"
          >
            Edit Sets
          </button>
          <button
            onClick={handleFinish}
            disabled={submitting}
            className="w-2/3 bg-[var(--accent-lime)] text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm min-h-[50px] shadow-[0_0_20px_var(--accent-lime-glow)]"
          >
            <CheckCircle className="w-4 h-4 stroke-[2.5]" />
            {submitting ? 'Finalizing...' : 'Save & Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}
