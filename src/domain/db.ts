import Dexie, { Table } from 'dexie';
import {
  UserSettings,
  WorkoutSession,
  ExerciseInstance,
  LoggedSet,
  ActiveDraftWorkout,
} from './types';
import { DEFAULT_SETTINGS_KG } from './plates';

export class LiftForgeDatabase extends Dexie {
  settings!: Table<UserSettings, string>;
  sessions!: Table<WorkoutSession, string>;
  exerciseInstances!: Table<ExerciseInstance, string>;
  loggedSets!: Table<LoggedSet, string>;
  activeDraft!: Table<ActiveDraftWorkout, string>;

  constructor() {
    super('LiftForgeDB');

    // Schema version 1
    this.version(1).stores({
      settings: 'id, updatedAt',
      sessions: 'id, sessionType, status, startedAt, completedAt, isDemoData',
      exerciseInstances: 'id, sessionId, exerciseId',
      loggedSets: 'id, exerciseInstanceId, sessionId, exerciseId, status, setType',
      activeDraft: 'id',
    });
  }
}

export const db = new LiftForgeDatabase();

/**
 * Ensure default settings exist in DB.
 */
export async function getOrCreateSettings(): Promise<UserSettings> {
  const existing = await db.settings.get('default');
  if (existing) {
    return existing;
  }
  const defaultSettings: UserSettings = {
    ...DEFAULT_SETTINGS_KG,
    id: 'default',
    updatedAt: Date.now(),
  };
  await db.settings.put(defaultSettings);
  return defaultSettings;
}

/**
 * Clears demo data or resets entire database
 */
export async function clearDemoData(): Promise<void> {
  const demoSessions = await db.sessions.where('isDemoData').equals(1).toArray();
  const sessionIds = demoSessions.map((s) => s.id);

  await db.transaction('rw', db.sessions, db.exerciseInstances, db.loggedSets, async () => {
    for (const sid of sessionIds) {
      await db.loggedSets.where('sessionId').equals(sid).delete();
      await db.exerciseInstances.where('sessionId').equals(sid).delete();
      await db.sessions.delete(sid);
    }
  });
}

/**
 * Reset all user workout data while retaining default settings.
 */
export async function resetAllWorkoutData(): Promise<void> {
  await db.transaction('rw', db.sessions, db.exerciseInstances, db.loggedSets, db.activeDraft, async () => {
    await db.sessions.clear();
    await db.exerciseInstances.clear();
    await db.loggedSets.clear();
    await db.activeDraft.clear();
  });
}
