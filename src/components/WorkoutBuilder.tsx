'use client';

import React, { useState, useEffect } from 'react';
import {
  WorkoutDefinition,
  ExerciseDefinition,
  BUILT_IN_WORKOUTS,
  BUILT_IN_EXERCISES,
  WORKOUT_TEMPLATES,
} from '@/domain/types';
import { db, getAllWorkouts, getAllExercises, resetWorkoutsToDefault } from '@/domain/db';
import {
  Plus,
  Trash2,
  Copy,
  Edit2,
  Check,
  X,
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Sparkles,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface WorkoutBuilderProps {
  onWorkoutsUpdated: () => void;
  units: string;
}

export function WorkoutBuilder({ onWorkoutsUpdated, units }: WorkoutBuilderProps) {
  const [workouts, setWorkouts] = useState<WorkoutDefinition[]>([]);
  const [exercises, setExercises] = useState<Record<string, ExerciseDefinition>>(BUILT_IN_EXERCISES);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutDefinition | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newExerciseModal, setNewExerciseModal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New exercise form state
  const [newExName, setNewExName] = useState('');
  const [newExIncrement, setNewExIncrement] = useState(units === 'kg' ? 2.5 : 5);
  const [newExSets, setNewExSets] = useState(5);
  const [newExReps, setNewExReps] = useState(5);
  const [newExPlateLoadable, setNewExPlateLoadable] = useState(true);
  const [newExRestSec, setNewExRestSec] = useState(90);

  const loadData = async () => {
    const wList = await getAllWorkouts();
    const eMap = await getAllExercises();
    setWorkouts(wList);
    setExercises(eMap);
  };

  useEffect(() => {
    loadData();
  }, []);

  const showMsg = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleApplyTemplate = async (templateName: string) => {
    const tmpl = WORKOUT_TEMPLATES.find((t) => t.name === templateName);
    if (!tmpl) return;

    if (confirm(`Replace active workouts with template: "${tmpl.name}"?`)) {
      await db.transaction('rw', db.workouts, db.customExercises, async () => {
        await db.workouts.clear();
        await db.workouts.bulkPut(tmpl.workouts);
        if (tmpl.exercises && tmpl.exercises.length > 0) {
          await db.customExercises.bulkPut(tmpl.exercises);
        }
      });
      await loadData();
      onWorkoutsUpdated();
      showMsg(`Loaded template "${tmpl.name}"`);
    }
  };

  const handleResetDefaults = async () => {
    if (confirm('Reset workouts back to original StrongLifts 5x5 Workout A & B?')) {
      await resetWorkoutsToDefault();
      await loadData();
      onWorkoutsUpdated();
      showMsg('Workouts reset to StrongLifts 5x5');
    }
  };

  const handleSaveWorkout = async () => {
    if (!editingWorkout) return;
    if (!editingWorkout.name.trim()) {
      alert('Workout name is required.');
      return;
    }
    if (editingWorkout.exerciseIds.length === 0) {
      alert('Select at least one exercise for this workout.');
      return;
    }

    await db.workouts.put(editingWorkout);
    setEditingWorkout(null);
    setIsCreatingNew(false);
    await loadData();
    onWorkoutsUpdated();
    showMsg(`Saved "${editingWorkout.name}"`);
  };

  const handleDeleteWorkout = async (id: string, name: string) => {
    if (workouts.length <= 1) {
      alert('You must have at least one active workout in rotation.');
      return;
    }
    if (confirm(`Delete "${name}"?`)) {
      await db.workouts.delete(id);
      await loadData();
      onWorkoutsUpdated();
      showMsg(`Deleted "${name}"`);
    }
  };

  const handleDuplicateWorkout = async (w: WorkoutDefinition) => {
    const newId = `workout-${Date.now().toString(36)}`;
    const duplicate: WorkoutDefinition = {
      ...w,
      id: newId,
      name: `${w.name} (Copy)`,
      isBuiltIn: false,
    };
    await db.workouts.put(duplicate);
    await loadData();
    onWorkoutsUpdated();
    showMsg(`Duplicated "${w.name}"`);
  };

  const handleMoveWorkout = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= workouts.length) return;

    const copy = [...workouts];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;

    await db.transaction('rw', db.workouts, async () => {
      await db.workouts.clear();
      await db.workouts.bulkPut(copy);
    });
    setWorkouts(copy);
    onWorkoutsUpdated();
  };

  const handleCreateExercise = async () => {
    if (!newExName.trim()) {
      alert('Exercise name is required.');
      return;
    }

    const exId = `ex-${newExName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36).slice(-4)}`;
    const newDef: ExerciseDefinition = {
      id: exId,
      name: newExName.trim(),
      defaultIncrement: newExIncrement,
      workingSets: newExSets,
      repsPerSet: newExReps,
      isPlateLoadable: newExPlateLoadable,
      defaultRestSec: newExRestSec,
      isCustom: true,
    };

    await db.customExercises.put(newDef);
    setExercises((prev) => ({ ...prev, [exId]: newDef }));

    // If currently editing a workout, optionally add it directly
    if (editingWorkout) {
      setEditingWorkout({
        ...editingWorkout,
        exerciseIds: [...editingWorkout.exerciseIds, exId],
      });
    }

    setNewExerciseModal(false);
    setNewExName('');
    showMsg(`Created exercise "${newDef.name}"`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-[var(--foreground)] uppercase tracking-wider text-[var(--muted-text)]">
            Workout Builder & Rotation
          </h3>
          <p className="text-xs text-[var(--muted-text)]">
            Train StrongLifts A/B or create custom splits (A/B/C) with tailored sets and reps.
          </p>
        </div>
        <button
          onClick={handleResetDefaults}
          className="text-xs text-[var(--muted-text)] hover:text-[var(--accent-lime)] flex items-center gap-1 font-semibold p-1"
          title="Reset to original 5x5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl text-xs font-bold bg-[var(--accent-lime)]/15 border border-[var(--accent-lime)]/40 text-[var(--accent-lime)] animate-in fade-in">
          {feedback}
        </div>
      )}

      {/* Starter Templates Picker */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-[var(--accent-lime)]" />
          Starter Program Templates
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {WORKOUT_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.name}
              type="button"
              onClick={() => handleApplyTemplate(tmpl.name)}
              className="p-3 text-left rounded-xl bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--accent-lime)] transition-colors min-h-[56px] flex flex-col justify-between"
            >
              <div>
                <div className="font-bold text-xs text-[var(--foreground)]">{tmpl.name}</div>
                <div className="text-[10px] text-[var(--muted-text)] line-clamp-2 mt-0.5">
                  {tmpl.description}
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-[var(--accent-lime)] mt-1 inline-block">
                {tmpl.workouts.length} Workouts
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Workouts List */}
      <div className="space-y-2.5">
        {workouts.map((w, idx) => (
          <div
            key={w.id}
            className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl flex items-center justify-between shadow-xs transition-all"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-[var(--accent-lime)] text-black font-mono font-bold text-xs flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="font-bold text-sm text-[var(--foreground)]">{w.name}</span>
                {w.isBuiltIn && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--background)] text-[var(--muted-text)] border border-[var(--card-border)]">
                    Default
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--muted-text)] flex flex-wrap gap-1.5 pl-8">
                {w.exerciseIds.map((exId) => {
                  const def = exercises[exId];
                  return (
                    <span
                      key={exId}
                      className="px-2 py-0.5 rounded-md bg-[var(--background)] border border-[var(--card-border)] text-[11px] font-medium text-[var(--foreground)]"
                    >
                      {def?.name || exId} ({def ? `${def.workingSets}x${def.repsPerSet}` : '5x5'})
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => handleMoveWorkout(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1 text-[var(--muted-text)] hover:text-[var(--foreground)] disabled:opacity-20"
                  aria-label="Move workout up in rotation"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveWorkout(idx, 'down')}
                  disabled={idx === workouts.length - 1}
                  className="p-1 text-[var(--muted-text)] hover:text-[var(--foreground)] disabled:opacity-20"
                  aria-label="Move workout down in rotation"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setEditingWorkout({ ...w })}
                className="p-2 text-[var(--muted-text)] hover:text-[var(--foreground)] rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center"
                aria-label={`Edit ${w.name}`}
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleDuplicateWorkout(w)}
                className="p-2 text-[var(--muted-text)] hover:text-[var(--foreground)] rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center"
                aria-label={`Duplicate ${w.name}`}
              >
                <Copy className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleDeleteWorkout(w.id, w.name)}
                className="p-2 text-rose-400 hover:text-rose-300 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center"
                aria-label={`Delete ${w.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Workout Button */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            const newId = `workout-${Date.now().toString(36)}`;
            setEditingWorkout({
              id: newId,
              name: `Workout ${String.fromCharCode(65 + workouts.length)}`,
              exerciseIds: ['squat', 'bench', 'row'],
              isBuiltIn: false,
            });
            setIsCreatingNew(true);
          }}
          className="flex-1 p-3.5 rounded-xl border border-dashed border-[var(--accent-lime)]/60 bg-[var(--accent-lime)]/5 hover:bg-[var(--accent-lime)]/10 text-[var(--accent-lime)] font-bold text-xs flex items-center justify-center gap-2 min-h-[48px]"
        >
          <Plus className="w-4 h-4" />
          Create New Workout
        </button>

        <button
          type="button"
          onClick={() => setNewExerciseModal(true)}
          className="p-3.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--accent-lime)] text-[var(--foreground)] font-semibold text-xs flex items-center justify-center gap-2 min-h-[48px]"
        >
          <Dumbbell className="w-4 h-4 text-[var(--accent-lime)]" />
          Add Custom Exercise
        </button>
      </div>

      {/* Edit / Create Workout Modal */}
      {editingWorkout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-3">
              <h3 className="font-bold text-base text-[var(--foreground)]">
                {isCreatingNew ? 'Create Workout' : 'Edit Workout'}
              </h3>
              <button
                onClick={() => setEditingWorkout(null)}
                className="p-2 text-[var(--muted-text)] hover:text-[var(--foreground)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-[var(--muted-text)]">Workout Name</label>
              <input
                type="text"
                value={editingWorkout.name}
                onChange={(e) => setEditingWorkout({ ...editingWorkout, name: e.target.value })}
                className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-3 text-sm font-bold text-[var(--foreground)] focus:border-[var(--accent-lime)] focus:outline-none"
                placeholder="e.g. Workout C (Hypertrophy)"
              />
            </div>

            {/* Exercise Checkboxes / Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-[var(--muted-text)]">
                  Exercises in this Workout ({editingWorkout.exerciseIds.length})
                </label>
                <button
                  type="button"
                  onClick={() => setNewExerciseModal(true)}
                  className="text-[11px] text-[var(--accent-lime)] font-bold hover:underline"
                >
                  + New Exercise
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {Object.values(exercises).map((ex) => {
                  const isChecked = editingWorkout.exerciseIds.includes(ex.id);
                  return (
                    <div
                      key={ex.id}
                      onClick={() => {
                        const nextIds = isChecked
                          ? editingWorkout.exerciseIds.filter((id) => id !== ex.id)
                          : [...editingWorkout.exerciseIds, ex.id];
                        setEditingWorkout({ ...editingWorkout, exerciseIds: nextIds });
                      }}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                        isChecked
                          ? 'bg-[var(--accent-lime)]/10 border-[var(--accent-lime)]/50'
                          : 'bg-[var(--background)] border-[var(--card-border)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center ${
                            isChecked ? 'bg-[var(--accent-lime)] text-black' : 'border border-[var(--card-border)]'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[var(--foreground)]">{ex.name}</div>
                          <div className="text-[10px] text-[var(--muted-text)] font-mono">
                            {ex.workingSets} sets × {ex.repsPerSet} reps · +{ex.defaultIncrement} {units}
                            {!ex.isPlateLoadable && ' · Fixed/Dumbbell'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingWorkout(null)}
                className="w-1/3 bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] font-semibold py-3 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWorkout}
                className="w-2/3 bg-[var(--accent-lime)] text-black font-extrabold py-3 rounded-xl text-xs shadow-md"
              >
                Save Workout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Exercise Modal */}
      {newExerciseModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[var(--card-bg)] border border-[var(--card-border)] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-3">
              <h3 className="font-bold text-base text-[var(--foreground)]">Create Custom Exercise</h3>
              <button
                onClick={() => setNewExerciseModal(false)}
                className="p-2 text-[var(--muted-text)] hover:text-[var(--foreground)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-[var(--muted-text)]">Exercise Name</label>
              <input
                type="text"
                value={newExName}
                onChange={(e) => setNewExName(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-3 text-sm font-bold text-[var(--foreground)] focus:border-[var(--accent-lime)] focus:outline-none"
                placeholder="e.g. Incline Dumbbell Press"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[var(--muted-text)]">Target Sets</label>
                <input
                  type="number"
                  value={newExSets}
                  onChange={(e) => setNewExSets(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-2.5 text-center font-mono font-bold text-sm text-[var(--foreground)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[var(--muted-text)]">Target Reps</label>
                <input
                  type="number"
                  value={newExReps}
                  onChange={(e) => setNewExReps(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-2.5 text-center font-mono font-bold text-sm text-[var(--foreground)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[var(--muted-text)]">
                  Progression Step ({units})
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={newExIncrement}
                  onChange={(e) => setNewExIncrement(parseFloat(e.target.value) || 1)}
                  className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-2.5 text-center font-mono font-bold text-sm text-[var(--foreground)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[var(--muted-text)]">Rest Default (s)</label>
                <input
                  type="number"
                  step="15"
                  value={newExRestSec}
                  onChange={(e) => setNewExRestSec(parseInt(e.target.value, 10) || 90)}
                  className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-2.5 text-center font-mono font-bold text-sm text-[var(--foreground)]"
                />
              </div>
            </div>

            {/* Plate Loadable Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--background)] border border-[var(--card-border)]">
              <div>
                <div className="text-xs font-bold text-[var(--foreground)]">Plate-Loadable Barbell?</div>
                <div className="text-[10px] text-[var(--muted-text)]">
                  Enables visual barbell plate calculator
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewExPlateLoadable(!newExPlateLoadable)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  newExPlateLoadable
                    ? 'bg-[var(--accent-lime)] text-black'
                    : 'bg-[var(--card-bg)] text-[var(--muted-text)] border border-[var(--card-border)]'
                }`}
              >
                {newExPlateLoadable ? 'Yes (Barbell)' : 'No (Dumbbell/Body)'}
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewExerciseModal(false)}
                className="w-1/3 bg-[var(--background)] border border-[var(--card-border)] text-[var(--foreground)] font-semibold py-3 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateExercise}
                className="w-2/3 bg-[var(--accent-lime)] text-black font-extrabold py-3 rounded-xl text-xs shadow-md"
              >
                Add Exercise
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
