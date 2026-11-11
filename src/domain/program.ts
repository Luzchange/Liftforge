import { SessionType, WorkoutSession } from './types';

/**
 * Determines the next workout session (A or B) based strictly on
 * the sequence of completed sessions, ignoring calendar dates.
 */
export function getNextSessionType(lastCompletedSessionType?: SessionType | null): SessionType {
  if (!lastCompletedSessionType) {
    return 'A'; // Default start with workout A
  }
  return lastCompletedSessionType === 'A' ? 'B' : 'A';
}

/**
 * Resolves the next session type given an array of workout sessions.
 */
export function resolveNextSessionFromHistory(sessions: WorkoutSession[]): SessionType {
  const completed = sessions
    .filter((s) => s.status === 'completed' && s.completedAt)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  if (completed.length === 0) {
    return 'A';
  }

  return getNextSessionType(completed[0].sessionType);
}
