export type WeightUnit = 'kg' | 'lb';

export type ExerciseId = 'squat' | 'bench' | 'row' | 'ohp' | 'deadlift';

export type SessionType = 'A' | 'B';

export type SetType = 'warmup' | 'working';

export type SetStatus = 'completed' | 'missed' | 'skipped';

export interface ExerciseDefinition {
  id: ExerciseId;
  name: string;
  defaultIncrement: number; // in current unit (2.5kg or 5lb)
  workingSets: number; // 5 for squat/bench/row/ohp, 1 for deadlift
  repsPerSet: number; // 5
}

export const EXERCISE_DEFINITIONS: Record<ExerciseId, ExerciseDefinition> = {
  squat: { id: 'squat', name: 'Squat', defaultIncrement: 2.5, workingSets: 5, repsPerSet: 5 },
  bench: { id: 'bench', name: 'Bench Press', defaultIncrement: 2.5, workingSets: 5, repsPerSet: 5 },
  row: { id: 'row', name: 'Barbell Row', defaultIncrement: 2.5, workingSets: 5, repsPerSet: 5 },
  ohp: { id: 'ohp', name: 'Overhead Press', defaultIncrement: 2.5, workingSets: 5, repsPerSet: 5 },
  deadlift: { id: 'deadlift', name: 'Deadlift', defaultIncrement: 5, workingSets: 1, repsPerSet: 5 },
};

export const PROGRAM_WORKOUTS: Record<SessionType, ExerciseId[]> = {
  A: ['squat', 'bench', 'row'],
  B: ['squat', 'ohp', 'deadlift'],
};

export interface UserSettings {
  id: string; // 'default'
  units: WeightUnit;
  barWeight: number; // 20 (kg) or 45 (lb)
  availablePlates: number[]; // sorted descending, e.g. [25, 20, 15, 10, 5, 2.5, 1.25]
  increments: Record<ExerciseId, number>; // { squat: 2.5, bench: 2.5, ... }
  startingWeights: Record<ExerciseId, number>;
  deloadPercentage: number; // 10 (%)
  breakDaysThreshold: number; // e.g. 14 days
  restTimerDurationSec: number; // default 90s
  theme: 'dark' | 'light' | 'system';
  soundEnabled: boolean;
  onboardingCompleted: boolean;
  updatedAt: number;
}

export interface WorkoutSession {
  id: string; // UUID
  programVersion: string; // e.g. "v1.0"
  sessionType: SessionType;
  status: 'completed' | 'in_progress' | 'abandoned';
  startedAt: number;
  completedAt?: number;
  notes?: string;
  isDemoData?: boolean;
}

export interface ExerciseInstance {
  id: string; // UUID
  sessionId: string;
  exerciseId: ExerciseId;
  exerciseName: string;
  targetSets: number;
  targetReps: number;
  prescribedWeight: number;
  actualWeight?: number;
  painFlag: boolean;
  userOverrideReason?: string;
  notes?: string;
}

export interface LoggedSet {
  id: string; // UUID
  exerciseInstanceId: string;
  sessionId: string;
  exerciseId: ExerciseId;
  setIndex: number;
  setType: SetType;
  prescribedWeight: number;
  prescribedReps: number;
  actualWeight: number;
  actualReps: number;
  status: SetStatus;
  isDeload?: boolean;
  completedAt?: number;
}

export interface ActiveDraftWorkout {
  id: string; // "active_draft"
  sessionType: SessionType;
  startedAt: number;
  exercises: {
    instanceId: string;
    exerciseId: ExerciseId;
    prescribedWeight: number;
    painFlag: boolean;
    userOverrideReason?: string;
    warmupSets: {
      id: string;
      setIndex: number;
      prescribedWeight: number;
      actualWeight: number;
      prescribedReps: number;
      actualReps: number;
      status: SetStatus;
    }[];
    workingSets: {
      id: string;
      setIndex: number;
      prescribedWeight: number;
      actualWeight: number;
      prescribedReps: number;
      actualReps: number;
      status: SetStatus;
    }[];
  }[];
  restTimer?: {
    endTimestamp: number;
    durationSeconds: number;
    pausedRemainingSeconds?: number;
  };
  notes?: string;
}

export interface ProgressionRecommendation {
  exerciseId: ExerciseId;
  prescribedWeight: number;
  previousWeight: number;
  reason: 'initial' | 'progression' | 'repeat_failure' | 'deload_3_fails' | 'pain_suppressed' | 'break_review' | 'manual_override';
  explanation: string;
  consecutiveFails: number;
  isDeload: boolean;
  breakDaysDetected?: number;
}
