import { db, getOrCreateSettings } from './db';
import { ExportData, validateImportJson } from './validation';
import { LoggedSet } from './types';

/**
 * Generates versioned JSON export string of all user data.
 */
export async function exportDatabaseToJson(): Promise<string> {
  const settings = await getOrCreateSettings();
  const sessions = await db.sessions.toArray();
  const exerciseInstances = await db.exerciseInstances.toArray();
  const loggedSets = await db.loggedSets.toArray();

  const exportPayload: ExportData = {
    version: 'liftforge-v1',
    exportedAt: Date.now(),
    settings,
    sessions,
    exerciseInstances,
    loggedSets,
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Imports JSON data into IndexedDB with duplicate resolution.
 */
export async function importDatabaseFromJson(
  jsonStr: string,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ success: boolean; message: string; count?: number }> {
  const validation = validateImportJson(jsonStr);
  if (!validation.success) {
    return { success: false, message: validation.error };
  }

  const { data } = validation;

  await db.transaction('rw', db.settings, db.sessions, db.exerciseInstances, db.loggedSets, async () => {
    if (mode === 'replace') {
      await db.sessions.clear();
      await db.exerciseInstances.clear();
      await db.loggedSets.clear();
    }

    await db.settings.put(data.settings);
    await db.sessions.bulkPut(data.sessions);
    await db.exerciseInstances.bulkPut(data.exerciseInstances);
    await db.loggedSets.bulkPut(data.loggedSets);
  });

  return {
    success: true,
    message: `Successfully imported ${data.sessions.length} sessions and ${data.loggedSets.length} sets.`,
    count: data.sessions.length,
  };
}

/**
 * Exports completed workout set history as formatted CSV.
 */
export async function exportSetsToCsv(): Promise<string> {
  const sessions = await db.sessions.toArray();
  const instances = await db.exerciseInstances.toArray();
  const sets = await db.loggedSets.toArray();

  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const instanceMap = new Map(instances.map((i) => [i.id, i]));

  const headers = [
    'SessionID',
    'Date',
    'Workout',
    'Exercise',
    'SetIndex',
    'SetType',
    'PrescribedWeight',
    'PrescribedReps',
    'ActualWeight',
    'ActualReps',
    'Status',
    'IsDeload',
    'PainFlag',
  ];

  const rows: string[] = [headers.join(',')];

  for (const set of sets) {
    const session = sessionMap.get(set.sessionId);
    const instance = instanceMap.get(set.exerciseInstanceId);

    const dateStr = session?.completedAt
      ? new Date(session.completedAt).toISOString()
      : session?.startedAt
      ? new Date(session.startedAt).toISOString()
      : '';

    const row = [
      set.sessionId,
      dateStr,
      session?.sessionType || '',
      instance?.exerciseName || set.exerciseId,
      set.setIndex,
      set.setType,
      set.prescribedWeight,
      set.prescribedReps,
      set.actualWeight,
      set.actualReps,
      set.status,
      set.isDeload ? 'true' : 'false',
      instance?.painFlag ? 'true' : 'false',
    ];

    rows.push(row.map((val) => `"${val}"`).join(','));
  }

  return rows.join('\n');
}
