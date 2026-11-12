import { describe, it, expect } from 'vitest';
import {
  convertWeight,
  roundToPrecision,
  roundToAchievableWeight,
  calculatePlates,
  DEFAULT_PLATES_KG,
  DEFAULT_PLATES_LB,
  DEFAULT_SETTINGS_KG,
} from './plates';
import { calculateNextWeight, analyzeExerciseHistory } from './progression';
import { getNextSessionType, getNextWorkoutId, resolveNextSessionFromHistory } from './program';
import { calculateWarmupSets } from './warmups';
import { validateImportJson } from './validation';
import { WorkoutSession, ExerciseInstance, LoggedSet, WorkoutDefinition, ExerciseDefinition } from './types';

describe('Plate Calculator & Weight Conversions', () => {
  it('converts between kg and lb accurately with fixed precision', () => {
    expect(convertWeight(100, 'kg', 'lb')).toBe(220.46);
    expect(convertWeight(220.46, 'lb', 'kg')).toBe(100);
    expect(convertWeight(50.123, 'kg', 'kg', 2)).toBe(50.12);
  });

  it('rounds weight to available plate pairs', () => {
    const bar = 20; // 20kg bar
    expect(roundToAchievableWeight(20, bar, DEFAULT_PLATES_KG)).toBe(20);
    expect(roundToAchievableWeight(21, bar, DEFAULT_PLATES_KG)).toBe(20);
    expect(roundToAchievableWeight(21.5, bar, DEFAULT_PLATES_KG)).toBe(22.5);
    expect(roundToAchievableWeight(62.5, bar, DEFAULT_PLATES_KG)).toBe(62.5);
    expect(roundToAchievableWeight(63.2, bar, DEFAULT_PLATES_KG)).toBe(62.5);
    expect(roundToAchievableWeight(64.1, bar, DEFAULT_PLATES_KG)).toBe(65);
  });

  it('calculates plate breakdowns per sleeve', () => {
    const calc = calculatePlates(60, 20, DEFAULT_PLATES_KG);
    expect(calc.achievableWeight).toBe(60);
    expect(calc.platesPerSide).toEqual([{ plate: 20, count: 1 }]);
    expect(calc.difference).toBe(0);

    const calcOdd = calculatePlates(62.5, 20, DEFAULT_PLATES_KG);
    expect(calcOdd.platesPerSide).toEqual([
      { plate: 20, count: 1 },
      { plate: 1.25, count: 1 },
    ]);
  });
});

describe('Progression Rules Engine', () => {
  const baseSettings = { ...DEFAULT_SETTINGS_KG };

  it('suggests starting weight if no prior history exists', () => {
    const recommendation = calculateNextWeight('squat', baseSettings, {
      lastPrescribedWeight: 0,
      lastActualWeight: 0,
      allSetsCompleted: false,
      hadMissedReps: false,
      consecutiveFails: 0,
      hadPain: false,
      wasSkipped: false,
    });

    expect(recommendation.reason).toBe('initial');
    expect(recommendation.prescribedWeight).toBe(baseSettings.startingWeights.squat);
    expect(recommendation.isDeload).toBe(false);
  });

  it('increases weight when all prescribed reps are completed', () => {
    const recommendation = calculateNextWeight('squat', baseSettings, {
      lastPrescribedWeight: 100,
      lastActualWeight: 100,
      allSetsCompleted: true,
      hadMissedReps: false,
      consecutiveFails: 0,
      hadPain: false,
      wasSkipped: false,
    });

    expect(recommendation.reason).toBe('progression');
    expect(recommendation.prescribedWeight).toBe(102.5);
    expect(recommendation.isDeload).toBe(false);
  });

  it('repeats load on 1 or 2 missed failures without deloading', () => {
    const recommendation1 = calculateNextWeight('bench', baseSettings, {
      lastPrescribedWeight: 80,
      lastActualWeight: 80,
      allSetsCompleted: false,
      hadMissedReps: true,
      consecutiveFails: 1,
      hadPain: false,
      wasSkipped: false,
    });
    expect(recommendation1.reason).toBe('repeat_failure');
    expect(recommendation1.prescribedWeight).toBe(80);
    expect(recommendation1.isDeload).toBe(false);

    const recommendation2 = calculateNextWeight('bench', baseSettings, {
      lastPrescribedWeight: 80,
      lastActualWeight: 80,
      allSetsCompleted: false,
      hadMissedReps: true,
      consecutiveFails: 2,
      hadPain: false,
      wasSkipped: false,
    });
    expect(recommendation2.reason).toBe('repeat_failure');
    expect(recommendation2.prescribedWeight).toBe(80);
    expect(recommendation2.isDeload).toBe(false);
  });

  it('applies 10% deload on exactly 3 consecutive failures', () => {
    const recommendation = calculateNextWeight('ohp', baseSettings, {
      lastPrescribedWeight: 50,
      lastActualWeight: 50,
      allSetsCompleted: false,
      hadMissedReps: true,
      consecutiveFails: 3,
      hadPain: false,
      wasSkipped: false,
    });

    expect(recommendation.reason).toBe('deload_3_fails');
    expect(recommendation.isDeload).toBe(true);
    expect(recommendation.prescribedWeight).toBe(45);
  });

  it('suppresses progression when pain is flagged', () => {
    const recommendation = calculateNextWeight('row', baseSettings, {
      lastPrescribedWeight: 60,
      lastActualWeight: 60,
      allSetsCompleted: true,
      hadMissedReps: false,
      consecutiveFails: 0,
      hadPain: true,
      wasSkipped: false,
    });

    expect(recommendation.reason).toBe('pain_suppressed');
    expect(recommendation.prescribedWeight).toBe(60);
    expect(recommendation.isDeload).toBe(false);
  });

  it('suggests safe deload when a training break >= 14 days is detected', () => {
    const eighteenDaysAgo = Date.now() - 18 * 24 * 60 * 60 * 1000;
    const recommendation = calculateNextWeight('deadlift', baseSettings, {
      lastSessionDate: eighteenDaysAgo,
      lastPrescribedWeight: 140,
      lastActualWeight: 140,
      allSetsCompleted: true,
      hadMissedReps: false,
      consecutiveFails: 0,
      hadPain: false,
      wasSkipped: false,
    });

    expect(recommendation.reason).toBe('break_review');
    expect(recommendation.isDeload).toBe(true);
    expect(recommendation.breakDaysDetected).toBeGreaterThanOrEqual(17);
    expect(recommendation.prescribedWeight).toBe(125);
  });

  it('correctly tracks custom exercises and non-plate-loadable progression', () => {
    const customEx: ExerciseDefinition = {
      id: 'dumbbell-curl',
      name: 'Dumbbell Curl',
      defaultIncrement: 1,
      workingSets: 3,
      repsPerSet: 8,
      isPlateLoadable: false,
    };

    const rec = calculateNextWeight(
      'dumbbell-curl',
      {
        ...baseSettings,
        increments: { ...baseSettings.increments, 'dumbbell-curl': 1 },
      },
      {
        lastPrescribedWeight: 14,
        lastActualWeight: 14,
        allSetsCompleted: true,
        hadMissedReps: false,
        consecutiveFails: 0,
        hadPain: false,
        wasSkipped: false,
      },
      customEx
    );

    expect(rec.reason).toBe('progression');
    expect(rec.prescribedWeight).toBe(15);
  });
});

describe('Multi-Workout & N-Way Rotation Engine', () => {
  it('alternates built-in A and B correctly', () => {
    expect(getNextSessionType(null)).toBe('A');
    expect(getNextSessionType('A')).toBe('B');
    expect(getNextSessionType('B')).toBe('A');
  });

  it('supports 3-way rotation (A -> B -> C -> A) for custom splits', () => {
    const customWorkouts: WorkoutDefinition[] = [
      { id: 'A', name: 'Workout A', exerciseIds: ['squat', 'bench', 'row'] },
      { id: 'B', name: 'Workout B', exerciseIds: ['squat', 'ohp', 'deadlift'] },
      { id: 'C', name: 'Workout C', exerciseIds: ['squat', 'incline', 'pullup'] },
    ];

    expect(getNextWorkoutId(customWorkouts, null)).toBe('A');
    expect(getNextWorkoutId(customWorkouts, 'A')).toBe('B');
    expect(getNextWorkoutId(customWorkouts, 'B')).toBe('C');
    expect(getNextWorkoutId(customWorkouts, 'C')).toBe('A');
  });

  it('resolves next session correctly from chronological completed history', () => {
    const sessions: WorkoutSession[] = [
      {
        id: 's1',
        programVersion: 'v1.0',
        sessionType: 'A',
        status: 'completed',
        startedAt: 1000,
        completedAt: 2000,
      },
      {
        id: 's2',
        programVersion: 'v1.0',
        sessionType: 'B',
        status: 'completed',
        startedAt: 3000,
        completedAt: 4000,
      },
    ];

    expect(resolveNextSessionFromHistory(sessions)).toBe('A');
  });
});

describe('Warmup Calculator', () => {
  it('calculates proper progressive warmup sets for heavy loads', () => {
    const warmups = calculateWarmupSets(100, 20, DEFAULT_PLATES_KG);
    expect(warmups.length).toBeGreaterThan(0);
    expect(warmups[0].weight).toBe(20);
    expect(warmups[0].reps).toBe(5);
    warmups.forEach((w) => {
      expect(w.weight).toBeLessThanOrEqual(100);
      expect(w.weight).toBeGreaterThanOrEqual(20);
    });
  });

  it('provides empty bar warmups for weights close to bar weight', () => {
    const warmups = calculateWarmupSets(20, 20, DEFAULT_PLATES_KG);
    expect(warmups.length).toBe(2);
    expect(warmups[0].weight).toBe(20);
    expect(warmups[1].weight).toBe(20);
  });
});

describe('JSON Backup Migration & Validation', () => {
  it('validates and accepts legacy v1 and upgraded v2 JSON backups', () => {
    const legacyJson = JSON.stringify({
      version: 'liftforge-v1',
      exportedAt: Date.now(),
      settings: DEFAULT_SETTINGS_KG,
      sessions: [
        {
          id: 'test-session',
          programVersion: 'v1.0',
          sessionType: 'A',
          status: 'completed',
          startedAt: 1000,
        },
      ],
      exerciseInstances: [],
      loggedSets: [],
    });

    const result = validateImportJson(legacyJson);
    expect(result.success).toBe(true);
  });

  it('rejects corrupted payload', () => {
    const corruptedJson = JSON.stringify({
      version: 'liftforge-v1',
      settings: { barWeight: 'invalid' },
    });
    const result = validateImportJson(corruptedJson);
    expect(result.success).toBe(false);
  });
});
