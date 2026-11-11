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
import { getNextSessionType, resolveNextSessionFromHistory } from './program';
import { calculateWarmupSets } from './warmups';
import { validateImportJson } from './validation';
import { WorkoutSession, ExerciseInstance, LoggedSet } from './types';

describe('Plate Calculator & Weight Conversions', () => {
  it('converts between kg and lb accurately with fixed precision', () => {
    // 100 kg is ~220.46 lb
    expect(convertWeight(100, 'kg', 'lb')).toBe(220.46);
    // 220.46 lb back to kg
    expect(convertWeight(220.46, 'lb', 'kg')).toBe(100);
    // Same unit returns roundToPrecision
    expect(convertWeight(50.123, 'kg', 'kg', 2)).toBe(50.12);
  });

  it('rounds weight to available plate pairs', () => {
    const bar = 20; // 20kg bar
    // With plates [25, 20, 15, 10, 5, 2.5, 1.25], smallest step is 2.5kg (1.25 on each side)
    expect(roundToAchievableWeight(20, bar, DEFAULT_PLATES_KG)).toBe(20);
    // target 21kg: excess is 1kg. Smallest pair step is 2.5kg. 1kg is closer to 0 than 2.5kg -> 20kg.
    expect(roundToAchievableWeight(21, bar, DEFAULT_PLATES_KG)).toBe(20);
    // target 21.5kg: excess is 1.5kg, closer to 2.5kg -> 22.5kg
    expect(roundToAchievableWeight(21.5, bar, DEFAULT_PLATES_KG)).toBe(22.5);
    expect(roundToAchievableWeight(62.5, bar, DEFAULT_PLATES_KG)).toBe(62.5);
    expect(roundToAchievableWeight(63.2, bar, DEFAULT_PLATES_KG)).toBe(62.5);
    expect(roundToAchievableWeight(64.1, bar, DEFAULT_PLATES_KG)).toBe(65);
  });

  it('calculates plate breakdowns per sleeve', () => {
    const calc = calculatePlates(60, 20, DEFAULT_PLATES_KG);
    // 60 - 20 = 40kg / 2 = 20kg per sleeve -> one 20kg plate
    expect(calc.achievableWeight).toBe(60);
    expect(calc.platesPerSide).toEqual([{ plate: 20, count: 1 }]);
    expect(calc.difference).toBe(0);

    const calcOdd = calculatePlates(62.5, 20, DEFAULT_PLATES_KG);
    // 42.5kg -> 21.25kg per side -> 20kg + 1.25kg
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
    expect(recommendation.prescribedWeight).toBe(102.5); // 100 + 2.5
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
    expect(recommendation2.prescribedWeight).toBe(80);
    expect(recommendation2.isDeload).toBe(false);
  });

  it('triggers a 10% deload on 3 consecutive failed attempts at prescribed load', () => {
    const recommendation = calculateNextWeight('deadlift', baseSettings, {
      lastPrescribedWeight: 140,
      lastActualWeight: 140,
      allSetsCompleted: false,
      hadMissedReps: true,
      consecutiveFails: 3,
      hadPain: false,
      wasSkipped: false,
    });

    expect(recommendation.reason).toBe('deload_3_fails');
    // 140 * 0.9 = 126 -> rounded to achievable plates with 20kg bar and pairs: 125kg
    expect(recommendation.prescribedWeight).toBe(125);
    expect(recommendation.isDeload).toBe(true);
    expect(recommendation.explanation).toContain('3 consecutive sessions missed');
  });

  it('suppresses automatic progression if pain flag is set', () => {
    const recommendation = calculateNextWeight('squat', baseSettings, {
      lastPrescribedWeight: 120,
      lastActualWeight: 120,
      allSetsCompleted: true, // completed all reps but had pain
      hadMissedReps: false,
      consecutiveFails: 0,
      hadPain: true,
      wasSkipped: false,
    });

    expect(recommendation.reason).toBe('pain_suppressed');
    expect(recommendation.prescribedWeight).toBe(120); // Held at current weight
    expect(recommendation.explanation).toContain('Discomfort or pain');
  });

  it('prompts load review after a prolonged training break', () => {
    const now = Date.now();
    const twentyDaysAgo = now - 20 * 24 * 60 * 60 * 1000;

    const recommendation = calculateNextWeight(
      'squat',
      baseSettings,
      {
        lastSessionDate: twentyDaysAgo,
        lastPrescribedWeight: 100,
        lastActualWeight: 100,
        allSetsCompleted: true,
        hadMissedReps: false,
        consecutiveFails: 0,
        hadPain: false,
        wasSkipped: false,
      },
      now
    );

    expect(recommendation.reason).toBe('break_review');
    expect(recommendation.isDeload).toBe(true);
    expect(recommendation.breakDaysDetected).toBe(20);
    expect(recommendation.prescribedWeight).toBe(90); // 100 * 0.9 = 90
  });

  it('does NOT count skipped sets as failures', () => {
    const sessions: WorkoutSession[] = [
      {
        id: 's1',
        programVersion: 'v1.0',
        sessionType: 'A',
        status: 'completed',
        startedAt: 1000,
        completedAt: 2000,
      },
    ];
    const exerciseInstances: ExerciseInstance[] = [
      {
        id: 'ei1',
        sessionId: 's1',
        exerciseId: 'squat',
        exerciseName: 'Squat',
        targetSets: 5,
        targetReps: 5,
        prescribedWeight: 100,
        painFlag: false,
      },
    ];
    const loggedSets: LoggedSet[] = [
      {
        id: 'ls1',
        sessionId: 's1',
        exerciseInstanceId: 'ei1',
        exerciseId: 'squat',
        setIndex: 1,
        setType: 'working',
        prescribedWeight: 100,
        prescribedReps: 5,
        actualWeight: 100,
        actualReps: 0,
        status: 'skipped',
      },
    ];

    const history = analyzeExerciseHistory('squat', sessions, exerciseInstances, loggedSets);
    expect(history.consecutiveFails).toBe(0);
    expect(history.wasSkipped).toBe(true);
  });
});

describe('Workout Alternation Rules', () => {
  it('alternates A and B strictly from completed session history', () => {
    expect(getNextSessionType(null)).toBe('A');
    expect(getNextSessionType('A')).toBe('B');
    expect(getNextSessionType('B')).toBe('A');

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
        status: 'in_progress', // ignored because not completed
        startedAt: 3000,
      },
    ];

    expect(resolveNextSessionFromHistory(sessions)).toBe('B');
  });
});

describe('Warmup Set Generation', () => {
  it('keeps warmups distinct from working sets with progressive ramps', () => {
    const warmups = calculateWarmupSets(100, 20, DEFAULT_PLATES_KG);
    expect(warmups.length).toBeGreaterThan(1);
    // First two sets are empty bar
    expect(warmups[0].weight).toBe(20);
    expect(warmups[1].weight).toBe(20);
    // Weight increases monotonically and stays under 100
    for (let i = 1; i < warmups.length; i++) {
      expect(warmups[i].weight).toBeGreaterThanOrEqual(warmups[i - 1].weight);
      expect(warmups[i].weight).toBeLessThan(100);
    }
  });

  it('handles low working weight safely', () => {
    const warmups = calculateWarmupSets(25, 20, DEFAULT_PLATES_KG);
    // Close to bar weight -> just 2 empty bar sets
    expect(warmups.length).toBe(2);
    expect(warmups[0].weight).toBe(20);
    expect(warmups[1].weight).toBe(20);
  });
});

describe('Backup & Validation Engine', () => {
  it('validates and rejects corrupted backup JSON', () => {
    const invalidJson = '{"version": "invalid-v2"}';
    const result = validateImportJson(invalidJson);
    expect(result.success).toBe(false);
  });

  it('validates well-formed backup payload', () => {
    const payload = {
      version: 'liftforge-v1',
      exportedAt: Date.now(),
      settings: DEFAULT_SETTINGS_KG,
      sessions: [],
      exerciseInstances: [],
      loggedSets: [],
    };
    const result = validateImportJson(JSON.stringify(payload));
    expect(result.success).toBe(true);
  });
});
