import Dexie, { Table } from 'dexie';
import {
  UserSettings,
  WorkoutSession,
  ExerciseInstance,
  LoggedSet,
  ActiveDraftWorkout,
  WorkoutDefinition,
  ExerciseDefinition,
  BUILT_IN_WORKOUTS,
  BUILT_IN_EXERCISES,
} from './types';
import { DEFAULT_SETTINGS_KG } from './plates';

export class LiftForgeDatabase extends Dexie {
  settings!: Table<UserSettings, string>;
  sessions!: Table<WorkoutSession, string>;
  exerciseInstances!: Table<ExerciseInstance, string>;
  loggedSets!: Table<LoggedSet, string>;
  activeDraft!: Table<ActiveDraftWorkout, string>;
  workouts!: Table<WorkoutDefinition, string>;
  customExercises!: Table<ExerciseDefinition, string>;

  constructor() {
    super('LiftForgeDB');

    // Schema version 1 (original A/B)
    this.version(1).stores({
      settings: 'id, updatedAt',
      sessions: 'id, sessionType, status, startedAt, completedAt, isDemoData',
      exerciseInstances: 'id, sessionId, exerciseId',
      loggedSets: 'id, exerciseInstanceId, sessionId, exerciseId, status, setType',
      activeDraft: 'id',
    });

    // Schema version 2: Custom Workouts and Custom Exercises
    this.version(2)
      .stores({
        settings: 'id, updatedAt',
        sessions: 'id, sessionType, status, startedAt, completedAt, isDemoData',
        exerciseInstances: 'id, sessionId, exerciseId',
        loggedSets: 'id, exerciseInstanceId, sessionId, exerciseId, status, setType',
        activeDraft: 'id',
        workouts: 'id, name, isBuiltIn',
        customExercises: 'id, name, isPlateLoadable, isCustom',
      })
      .upgrade(async (tx) => {
        // Seed workouts table with built-in A and B
        const workoutsTable = tx.table<WorkoutDefinition, string>('workouts');
        for (const w of BUILT_IN_WORKOUTS) {
          await workoutsTable.put(w);
        }
        // Seed built-in exercises table
        const exTable = tx.table<ExerciseDefinition, string>('customExercises');
        for (const exKey of Object.keys(BUILT_IN_EXERCISES)) {
          await exTable.put(BUILT_IN_EXERCISES[exKey]);
        }
      });
  }
}

export const db = new LiftForgeDatabase();

/**
 * Ensure default settings and workouts exist in DB.
 */
export async function getOrCreateSettings(): Promise<UserSettings> {
  const existing = await db.settings.get('default');
  if (existing) {
    await ensureDefaultWorkouts();
    return existing;
  }
  const defaultSettings: UserSettings = {
    ...DEFAULT_SETTINGS_KG,
    id: 'default',
    updatedAt: Date.now(),
  };
  await db.settings.put(defaultSettings);
  await ensureDefaultWorkouts();
  return defaultSettings;
}

/**
 * Ensure built-in workouts & exercises exist
 */
export async function ensureDefaultWorkouts(): Promise<void> {
  const count = await db.workouts.count();
  if (count === 0) {
    await db.workouts.bulkPut(BUILT_IN_WORKOUTS);
  }
  const exCount = await db.customExercises.count();
  if (exCount === 0) {
    await db.customExercises.bulkPut(Object.values(BUILT_IN_EXERCISES));
  }
}

/**
 * Get all active workouts (user-defined or built-in)
 */
export async function getAllWorkouts(): Promise<WorkoutDefinition[]> {
  await ensureDefaultWorkouts();
  return await db.workouts.toArray();
}

/**
 * Get all available exercises (built-in + custom)
 */
export async function getAllExercises(): Promise<Record<string, ExerciseDefinition>> {
  await ensureDefaultWorkouts();
  const list = await db.customExercises.toArray();
  const map: Record<string, ExerciseDefinition> = { ...BUILT_IN_EXERCISES };
  for (const ex of list) {
    map[ex.id] = ex;
  }
  return map;
}

/**
 * Reset workouts to StrongLifts 5x5 defaults
 */
export async function resetWorkoutsToDefault(): Promise<void> {
  await db.transaction('rw', db.workouts, db.customExercises, async () => {
    await db.workouts.clear();
    await db.customExercises.clear();
    await db.workouts.bulkPut(BUILT_IN_WORKOUTS);
    await db.customExercises.bulkPut(Object.values(BUILT_IN_EXERCISES));
  });
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
