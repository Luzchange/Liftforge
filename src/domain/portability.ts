import { db } from './db';
import { ExportData, validateImportJson } from './validation';
import { BUILT_IN_WORKOUTS, BUILT_IN_EXERCISES } from './types';

/**
 * Serializes all tables into a single backup JSON object string.
 */
export async function exportDatabaseToJson(): Promise<string> {
  const settings = await db.settings.get('default');
  if (!settings) {
    throw new Error('No user settings found in database.');
  }

  const sessions = await db.sessions.toArray();
  const exerciseInstances = await db.exerciseInstances.toArray();
  const loggedSets = await db.loggedSets.toArray();
  const workouts = await db.workouts.toArray();
  const customExercises = await db.customExercises.toArray();

  const exportPayload: ExportData = {
    version: 'liftforge-v2',
    exportedAt: Date.now(),
    settings,
    sessions,
    exerciseInstances,
    loggedSets,
    workouts: workouts.length > 0 ? workouts : BUILT_IN_WORKOUTS,
    customExercises: customExercises.length > 0 ? customExercises : Object.values(BUILT_IN_EXERCISES),
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Restores tables from a valid JSON backup.
 */
export async function importDatabaseFromJson(
  jsonString: string,
  mode: 'replace' | 'merge' = 'merge'
): Promise<{ success: boolean; message: string }> {
  const validation = validateImportJson(jsonString);

  if (!validation.success) {
    return { success: false, message: validation.error };
  }

  const { settings, sessions, exerciseInstances, loggedSets, workouts, customExercises } = validation.data;

  try {
    await db.transaction(
      'rw',
      [
        db.settings,
        db.sessions,
        db.exerciseInstances,
        db.loggedSets,
        db.activeDraft,
        db.workouts,
        db.customExercises,
      ],
      async () => {
        if (mode === 'replace') {
          await db.sessions.clear();
          await db.exerciseInstances.clear();
          await db.loggedSets.clear();
          await db.activeDraft.clear();
          await db.workouts.clear();
          await db.customExercises.clear();
        }

        await db.settings.put(settings);
        await db.sessions.bulkPut(sessions);
        await db.exerciseInstances.bulkPut(exerciseInstances);
        await db.loggedSets.bulkPut(loggedSets);

        if (workouts && workouts.length > 0) {
          await db.workouts.bulkPut(workouts);
        } else {
          await db.workouts.bulkPut(BUILT_IN_WORKOUTS);
        }

        if (customExercises && customExercises.length > 0) {
          await db.customExercises.bulkPut(customExercises);
        }
      }
    );

    return {
      success: true,
      message: `Successfully imported ${sessions.length} sessions and ${loggedSets.length} sets.`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Database transaction error: ${(err as Error).message}`,
    };
  }
}

export async function convertAllHistoricalUnits(targetUnit: 'kg' | 'lb'): Promise<void> {
  const isTargetKg = targetUnit === 'kg';
  const factor = isTargetKg ? 1 / 2.20462262185 : 2.20462262185;

  await db.transaction('rw', db.sessions, db.exerciseInstances, db.loggedSets, async () => {
    const instances = await db.exerciseInstances.toArray();
    for (const inst of instances) {
      inst.prescribedWeight = Math.round(inst.prescribedWeight * factor * 10) / 10;
      if (inst.actualWeight !== undefined) {
        inst.actualWeight = Math.round(inst.actualWeight * factor * 10) / 10;
      }
      await db.exerciseInstances.put(inst);
    }

    const sets = await db.loggedSets.toArray();
    for (const s of sets) {
      s.prescribedWeight = Math.round(s.prescribedWeight * factor * 10) / 10;
      s.actualWeight = Math.round(s.actualWeight * factor * 10) / 10;
      await db.loggedSets.put(s);
    }
  });
}

/**
 * Exports completed workout set history as formatted CSV.
 */
export async function exportSetsToCsv(): Promise<string> {
  const sessions = await db.sessions.toArray();
  const instances = await db.exerciseInstances.toArray();
  const sets = await db.loggedSets.toArray();

  const rows: string[] = [];
  rows.push('session_id,session_type,date,exercise,set_index,set_type,prescribed_weight,actual_weight,prescribed_reps,actual_reps,status');

  for (const set of sets) {
    const inst = instances.find((i) => i.id === set.exerciseInstanceId);
    const sess = sessions.find((s) => s.id === set.sessionId);

    const dateStr = sess?.completedAt ? new Date(sess.completedAt).toISOString() : '';
    const exName = inst?.exerciseName || set.exerciseId;
    const sType = sess?.sessionType || '';

    rows.push(
      [
        set.sessionId,
        sType,
        dateStr,
        `"${exName}"`,
        set.setIndex,
        set.setType,
        set.prescribedWeight,
        set.actualWeight,
        set.prescribedReps,
        set.actualReps,
        set.status,
      ].join(',')
    );
  }

  return rows.join('\n');
}
