import { WorkoutSession, WorkoutDefinition, BUILT_IN_WORKOUTS } from './types';

/**
 * Determines the next workout session based on the user's active workout list (n-way rotation).
 * Defaults to BUILT_IN_WORKOUTS (A -> B -> A...) when no custom list is passed.
 */
export function getNextWorkoutId(
  workouts: WorkoutDefinition[] = BUILT_IN_WORKOUTS,
  lastCompletedWorkoutId?: string | null
): string {
  if (!workouts || workouts.length === 0) {
    return 'A';
  }

  if (!lastCompletedWorkoutId) {
    return workouts[0].id;
  }

  const currentIndex = workouts.findIndex((w) => w.id === lastCompletedWorkoutId);
  if (currentIndex === -1) {
    // If the last workout was deleted or not found, start at index 0
    return workouts[0].id;
  }

  const nextIndex = (currentIndex + 1) % workouts.length;
  return workouts[nextIndex].id;
}

/**
 * Resolves the next session type given an array of workout sessions and the available workout definitions.
 */
export function resolveNextSessionFromHistory(
  sessions: WorkoutSession[],
  workouts: WorkoutDefinition[] = BUILT_IN_WORKOUTS
): string {
  const completed = sessions
    .filter((s) => s.status === 'completed' && s.completedAt)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  if (completed.length === 0) {
    return workouts[0]?.id || 'A';
  }

  return getNextWorkoutId(workouts, completed[0].sessionType);
}

// Backward-compatible alias for existing tests
export const getNextSessionType = (lastType?: string | null) => getNextWorkoutId(BUILT_IN_WORKOUTS, lastType);
