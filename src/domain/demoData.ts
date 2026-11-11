import { db } from './db';
import { WorkoutSession, ExerciseInstance, LoggedSet } from './types';

export async function seedDemoData(): Promise<void> {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Session 1: Workout A (6 days ago)
  const session1Id = 'demo-session-1';
  const session1: WorkoutSession = {
    id: session1Id,
    programVersion: 'v1.0',
    sessionType: 'A',
    status: 'completed',
    startedAt: now - 6 * dayMs,
    completedAt: now - 6 * dayMs + 45 * 60 * 1000,
    isDemoData: true,
    notes: 'Felt solid on squats. Good form.',
  };

  const instances1: ExerciseInstance[] = [
    {
      id: 'demo-inst-1-1',
      sessionId: session1Id,
      exerciseId: 'squat',
      exerciseName: 'Squat',
      targetSets: 5,
      targetReps: 5,
      prescribedWeight: 60,
      actualWeight: 60,
      painFlag: false,
    },
    {
      id: 'demo-inst-1-2',
      sessionId: session1Id,
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      targetSets: 5,
      targetReps: 5,
      prescribedWeight: 45,
      actualWeight: 45,
      painFlag: false,
    },
    {
      id: 'demo-inst-1-3',
      sessionId: session1Id,
      exerciseId: 'row',
      exerciseName: 'Barbell Row',
      targetSets: 5,
      targetReps: 5,
      prescribedWeight: 40,
      actualWeight: 40,
      painFlag: false,
    },
  ];

  const sets1: LoggedSet[] = [];
  instances1.forEach((inst) => {
    for (let i = 1; i <= inst.targetSets; i++) {
      sets1.push({
        id: `demo-set-1-${inst.exerciseId}-${i}`,
        exerciseInstanceId: inst.id,
        sessionId: session1Id,
        exerciseId: inst.exerciseId,
        setIndex: i,
        setType: 'working',
        prescribedWeight: inst.prescribedWeight,
        prescribedReps: 5,
        actualWeight: inst.prescribedWeight,
        actualReps: 5,
        status: 'completed',
      });
    }
  });

  // Session 2: Workout B (4 days ago)
  const session2Id = 'demo-session-2';
  const session2: WorkoutSession = {
    id: session2Id,
    programVersion: 'v1.0',
    sessionType: 'B',
    status: 'completed',
    startedAt: now - 4 * dayMs,
    completedAt: now - 4 * dayMs + 40 * 60 * 1000,
    isDemoData: true,
  };

  const instances2: ExerciseInstance[] = [
    {
      id: 'demo-inst-2-1',
      sessionId: session2Id,
      exerciseId: 'squat',
      exerciseName: 'Squat',
      targetSets: 5,
      targetReps: 5,
      prescribedWeight: 62.5,
      actualWeight: 62.5,
      painFlag: false,
    },
    {
      id: 'demo-inst-2-2',
      sessionId: session2Id,
      exerciseId: 'ohp',
      exerciseName: 'Overhead Press',
      targetSets: 5,
      targetReps: 5,
      prescribedWeight: 30,
      actualWeight: 30,
      painFlag: false,
    },
    {
      id: 'demo-inst-2-3',
      sessionId: session2Id,
      exerciseId: 'deadlift',
      exerciseName: 'Deadlift',
      targetSets: 1,
      targetReps: 5,
      prescribedWeight: 70,
      actualWeight: 70,
      painFlag: false,
    },
  ];

  const sets2: LoggedSet[] = [];
  instances2.forEach((inst) => {
    for (let i = 1; i <= inst.targetSets; i++) {
      sets2.push({
        id: `demo-set-2-${inst.exerciseId}-${i}`,
        exerciseInstanceId: inst.id,
        sessionId: session2Id,
        exerciseId: inst.exerciseId,
        setIndex: i,
        setType: 'working',
        prescribedWeight: inst.prescribedWeight,
        prescribedReps: 5,
        actualWeight: inst.prescribedWeight,
        actualReps: 5,
        status: 'completed',
      });
    }
  });

  // Session 3: Workout A (2 days ago)
  const session3Id = 'demo-session-3';
  const session3: WorkoutSession = {
    id: session3Id,
    programVersion: 'v1.0',
    sessionType: 'A',
    status: 'completed',
    startedAt: now - 2 * dayMs,
    completedAt: now - 2 * dayMs + 50 * 60 * 1000,
    isDemoData: true,
  };

  const instances3: ExerciseInstance[] = [
    {
      id: 'demo-inst-3-1',
      sessionId: session3Id,
      exerciseId: 'squat',
      exerciseName: 'Squat',
      targetSets: 5,
      targetReps: 5,
      prescribedWeight: 65,
      actualWeight: 65,
      painFlag: false,
    },
    {
      id: 'demo-inst-3-2',
      sessionId: session3Id,
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      targetSets: 5,
      targetReps: 5,
      prescribedWeight: 47.5,
      actualWeight: 47.5,
      painFlag: false,
    },
    {
      id: 'demo-inst-3-3',
      sessionId: session3Id,
      exerciseId: 'row',
      exerciseName: 'Barbell Row',
      targetSets: 5,
      targetReps: 5,
      prescribedWeight: 42.5,
      actualWeight: 42.5,
      painFlag: false,
    },
  ];

  const sets3: LoggedSet[] = [];
  instances3.forEach((inst) => {
    for (let i = 1; i <= inst.targetSets; i++) {
      sets3.push({
        id: `demo-set-3-${inst.exerciseId}-${i}`,
        exerciseInstanceId: inst.id,
        sessionId: session3Id,
        exerciseId: inst.exerciseId,
        setIndex: i,
        setType: 'working',
        prescribedWeight: inst.prescribedWeight,
        prescribedReps: 5,
        actualWeight: inst.prescribedWeight,
        actualReps: 5,
        status: 'completed',
      });
    }
  });

  await db.transaction('rw', db.sessions, db.exerciseInstances, db.loggedSets, async () => {
    await db.sessions.bulkPut([session1, session2, session3]);
    await db.exerciseInstances.bulkPut([...instances1, ...instances2, ...instances3]);
    await db.loggedSets.bulkPut([...sets1, ...sets2, ...sets3]);
  });
}
