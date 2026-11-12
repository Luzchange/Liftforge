import {
  UserSettings,
  WorkoutSession,
  ExerciseInstance,
  LoggedSet,
  ProgressionRecommendation,
  BUILT_IN_EXERCISES,
  ExerciseDefinition,
} from './types';
import { roundToAchievableWeight, roundToPrecision } from './plates';

export interface ExerciseHistorySummary {
  lastSessionDate?: number;
  lastPrescribedWeight: number;
  lastActualWeight: number;
  allSetsCompleted: boolean;
  hadMissedReps: boolean;
  consecutiveFails: number;
  hadPain: boolean;
  wasSkipped: boolean;
}

/**
 * Evaluates the recent history for a given exercise to determine fail streak and previous stats.
 */
export function analyzeExerciseHistory(
  exerciseId: string,
  sessions: WorkoutSession[],
  exerciseInstances: ExerciseInstance[],
  loggedSets: LoggedSet[]
): ExerciseHistorySummary {
  // Sort sessions completed descending
  const completedSessions = sessions
    .filter((s) => s.status === 'completed' && s.completedAt)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  let consecutiveFails = 0;
  let lastPrescribedWeight = 0;
  let lastActualWeight = 0;
  let lastSessionDate: number | undefined;
  let allSetsCompleted = false;
  let hadMissedReps = false;
  let hadPain = false;
  let wasSkipped = false;
  let foundMostRecent = false;

  for (const session of completedSessions) {
    const instance = exerciseInstances.find(
      (inst) => inst.sessionId === session.id && inst.exerciseId === exerciseId
    );
    if (!instance) continue;

    const workingSets = loggedSets.filter(
      (s) => s.exerciseInstanceId === instance.id && s.setType === 'working'
    );

    if (workingSets.length === 0) continue;

    // Check if entire exercise was skipped
    const isAllSkipped = workingSets.every((s) => s.status === 'skipped');
    if (isAllSkipped) {
      if (!foundMostRecent) {
        wasSkipped = true;
        lastSessionDate = session.completedAt;
        lastPrescribedWeight = instance.prescribedWeight;
      }
      continue;
    }

    const attemptedWorkingSets = workingSets.filter((s) => s.status !== 'skipped');
    const hasMissed = attemptedWorkingSets.some(
      (s) => s.status === 'missed' || s.actualReps < s.prescribedReps
    );

    if (!foundMostRecent) {
      foundMostRecent = true;
      lastSessionDate = session.completedAt;
      lastPrescribedWeight = instance.prescribedWeight;
      lastActualWeight = instance.actualWeight ?? instance.prescribedWeight;
      hadPain = instance.painFlag;
      hadMissedReps = hasMissed;
      allSetsCompleted = !hasMissed && attemptedWorkingSets.length === instance.targetSets;
    }

    // Count consecutive fails at the SAME or higher load
    if (hasMissed) {
      consecutiveFails += 1;
    } else {
      break;
    }
  }

  return {
    lastSessionDate,
    lastPrescribedWeight,
    lastActualWeight,
    allSetsCompleted,
    hadMissedReps,
    consecutiveFails,
    hadPain,
    wasSkipped,
  };
}

/**
 * Calculates next load recommendation based on user rules and exercise history.
 * Supports built-in exercises and custom user-defined exercises.
 */
export function calculateNextWeight(
  exerciseId: string,
  settings: UserSettings,
  history: ExerciseHistorySummary,
  customDef?: ExerciseDefinition
): ProgressionRecommendation {
  const def = customDef || BUILT_IN_EXERCISES[exerciseId] || {
    id: exerciseId,
    name: exerciseId,
    defaultIncrement: settings.increments[exerciseId] ?? (settings.units === 'kg' ? 2.5 : 5),
    workingSets: 5,
    repsPerSet: 5,
    isPlateLoadable: true,
  };

  const increment = settings.increments[exerciseId] ?? def.defaultIncrement;
  const startingWeight = settings.startingWeights[exerciseId] ?? settings.barWeight;

  // Case 1: First time performing exercise
  if (history.lastPrescribedWeight === 0) {
    return {
      exerciseId,
      prescribedWeight: startingWeight,
      previousWeight: 0,
      reason: 'initial',
      explanation: `Starting load initialized to ${startingWeight} ${settings.units}.`,
      consecutiveFails: 0,
      isDeload: false,
    };
  }

  const previousWeight = history.lastActualWeight || history.lastPrescribedWeight;

  // Case 2: Break Detection (> threshold days)
  if (history.lastSessionDate) {
    const daysSinceLast = (Date.now() - history.lastSessionDate) / (1000 * 60 * 60 * 24);
    if (daysSinceLast >= settings.breakDaysThreshold) {
      const conservativeWeight = def.isPlateLoadable
        ? roundToAchievableWeight(previousWeight * 0.9, settings.barWeight, settings.availablePlates)
        : roundToPrecision(previousWeight * 0.9, 1);

      return {
        exerciseId,
        prescribedWeight: conservativeWeight,
        previousWeight,
        reason: 'break_review',
        explanation: `${Math.floor(daysSinceLast)} days since last logged session. Safe 10% load reduction recommended.`,
        consecutiveFails: 0,
        isDeload: true,
        breakDaysDetected: Math.floor(daysSinceLast),
      };
    }
  }

  // Case 3: Pain flag set on previous session
  if (history.hadPain) {
    return {
      exerciseId,
      prescribedWeight: previousWeight,
      previousWeight,
      reason: 'pain_suppressed',
      explanation: 'Load held steady due to pain/discomfort flagged in previous session.',
      consecutiveFails: history.consecutiveFails,
      isDeload: false,
    };
  }

  // Case 4: 3 Consecutive Failures -> Automatic Deload
  if (history.consecutiveFails >= 3) {
    const deloadFactor = 1 - settings.deloadPercentage / 100;
    const targetDeload = previousWeight * deloadFactor;
    const deloadWeight = def.isPlateLoadable
      ? roundToAchievableWeight(targetDeload, settings.barWeight, settings.availablePlates)
      : roundToPrecision(targetDeload, 1);

    return {
      exerciseId,
      prescribedWeight: Math.max(def.isPlateLoadable ? settings.barWeight : 1, deloadWeight),
      previousWeight,
      reason: 'deload_3_fails',
      explanation: `3 consecutive failed sessions. ${settings.deloadPercentage}% deload applied to break plateau.`,
      consecutiveFails: 3,
      isDeload: true,
    };
  }

  // Case 5: 1 or 2 Failures -> Repeat previous weight
  if (history.hadMissedReps) {
    return {
      exerciseId,
      prescribedWeight: previousWeight,
      previousWeight,
      reason: 'repeat_failure',
      explanation: `Failed to hit target reps (${history.consecutiveFails}/3 strikes). Repeating ${previousWeight} ${settings.units}.`,
      consecutiveFails: history.consecutiveFails,
      isDeload: false,
    };
  }

  // Case 6: Successful 5x5 completed -> Progressive Overload Increment
  if (history.allSetsCompleted) {
    const rawTarget = previousWeight + increment;
    const nextWeight = def.isPlateLoadable
      ? roundToAchievableWeight(rawTarget, settings.barWeight, settings.availablePlates)
      : roundToPrecision(rawTarget, 1);

    return {
      exerciseId,
      prescribedWeight: nextWeight,
      previousWeight,
      reason: 'progression',
      explanation: `All target sets completed! Increasing load by +${increment} ${settings.units}.`,
      consecutiveFails: 0,
      isDeload: false,
    };
  }

  // Fallback / default
  return {
    exerciseId,
    prescribedWeight: previousWeight,
    previousWeight,
    reason: 'repeat_failure',
    explanation: `Maintaining working load at ${previousWeight} ${settings.units}.`,
    consecutiveFails: history.consecutiveFails,
    isDeload: false,
  };
}
