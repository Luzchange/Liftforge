import {
  ExerciseId,
  UserSettings,
  WorkoutSession,
  ExerciseInstance,
  LoggedSet,
  ProgressionRecommendation,
  EXERCISE_DEFINITIONS,
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
  exerciseId: ExerciseId,
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
      // Note: Skipped sets do NOT count as failures per spec
      continue;
    }

    // Evaluate failure on completed/attempted sets
    // Warmups and skips do not count as failures
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
      // Successful session breaks the fail streak
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
 * Calculates the next recommended weight for an exercise based on pure rules.
 */
export function calculateNextWeight(
  exerciseId: ExerciseId,
  settings: UserSettings,
  history: ExerciseHistorySummary,
  currentTimestamp: number = Date.now()
): ProgressionRecommendation {
  const defaultIncrement = settings.increments[exerciseId] ?? EXERCISE_DEFINITIONS[exerciseId].defaultIncrement;
  const startingWeight = settings.startingWeights[exerciseId] ?? settings.barWeight;

  // 1. Initial / First time
  if (!history.lastPrescribedWeight) {
    const rounded = roundToAchievableWeight(startingWeight, settings.barWeight, settings.availablePlates);
    return {
      exerciseId,
      prescribedWeight: rounded,
      previousWeight: startingWeight,
      reason: 'initial',
      explanation: `Starting load based on your setup (${rounded} ${settings.units}).`,
      consecutiveFails: 0,
      isDeload: false,
    };
  }

  const prevWeight = history.lastPrescribedWeight;

  // 2. Training Break Check (e.g. 14+ days)
  if (history.lastSessionDate) {
    const daysElapsed = Math.floor((currentTimestamp - history.lastSessionDate) / (1000 * 60 * 60 * 24));
    if (daysElapsed >= settings.breakDaysThreshold) {
      // Suggest review / safety deload
      const deloadWeight = roundToAchievableWeight(
        prevWeight * (1 - settings.deloadPercentage / 100),
        settings.barWeight,
        settings.availablePlates
      );
      return {
        exerciseId,
        prescribedWeight: deloadWeight,
        previousWeight: prevWeight,
        reason: 'break_review',
        explanation: `${daysElapsed} days since your last ${EXERCISE_DEFINITIONS[exerciseId].name} session. A ${settings.deloadPercentage}% reset to ${deloadWeight} ${settings.units} is recommended for safe resumption.`,
        consecutiveFails: 0,
        isDeload: true,
        breakDaysDetected: daysElapsed,
      };
    }
  }

  // 3. Pain Flag Check: Suppress automatic progression
  if (history.hadPain) {
    return {
      exerciseId,
      prescribedWeight: prevWeight,
      previousWeight: prevWeight,
      reason: 'pain_suppressed',
      explanation: `Discomfort or pain was noted in your previous session. Weight held at ${prevWeight} ${settings.units}. Adjust as needed or seek professional guidance.`,
      consecutiveFails: history.consecutiveFails,
      isDeload: false,
    };
  }

  // 4. Skipped session: repeat load
  if (history.wasSkipped) {
    return {
      exerciseId,
      prescribedWeight: prevWeight,
      previousWeight: prevWeight,
      reason: 'repeat_failure',
      explanation: `Previous session was skipped. Repeating ${prevWeight} ${settings.units}.`,
      consecutiveFails: 0,
      isDeload: false,
    };
  }

  // 5. Check 3 Consecutive Failures -> 10% Deload
  if (history.consecutiveFails >= 3) {
    const rawDeload = prevWeight * (1 - settings.deloadPercentage / 100);
    const deloadWeight = roundToAchievableWeight(
      rawDeload,
      settings.barWeight,
      settings.availablePlates
    );
    return {
      exerciseId,
      prescribedWeight: deloadWeight,
      previousWeight: prevWeight,
      reason: 'deload_3_fails',
      explanation: `3 consecutive sessions missed at ${prevWeight} ${settings.units}. Configured ${settings.deloadPercentage}% deload to ${deloadWeight} ${settings.units} to rebuild velocity and technique.`,
      consecutiveFails: 0, // Reset fail counter after deload suggestion
      isDeload: true,
    };
  }

  // 6. Missed reps on last session (1 or 2 fails) -> Repeat load
  if (history.hadMissedReps) {
    return {
      exerciseId,
      prescribedWeight: prevWeight,
      previousWeight: prevWeight,
      reason: 'repeat_failure',
      explanation: `Missed reps in the previous attempt (attempt ${history.consecutiveFails} of 3). Repeating ${prevWeight} ${settings.units}.`,
      consecutiveFails: history.consecutiveFails,
      isDeload: false,
    };
  }

  // 7. Success! Increment weight
  const nextTarget = prevWeight + defaultIncrement;
  const achievableTarget = roundToAchievableWeight(
    nextTarget,
    settings.barWeight,
    settings.availablePlates
  );

  return {
    exerciseId,
    prescribedWeight: achievableTarget,
    previousWeight: prevWeight,
    reason: 'progression',
    explanation: `Completed all target reps! Increasing load by +${roundToPrecision(achievableTarget - prevWeight, 2)} ${settings.units} to ${achievableTarget} ${settings.units}.`,
    consecutiveFails: 0,
    isDeload: false,
  };
}
