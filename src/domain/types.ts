export type WeightUnit = 'kg' | 'lb';

// Exercises can be built-in or custom string IDs
export type ExerciseId = 'squat' | 'bench' | 'row' | 'ohp' | 'deadlift' | (string & {});

// Session type: built-in 'A' | 'B' or custom workout ID
export type SessionType = 'A' | 'B' | (string & {});

export type SetType = 'warmup' | 'working';

export type SetStatus = 'completed' | 'missed' | 'skipped';

export interface ExerciseDefinition {
  id: string; // unique ID e.g. 'squat', 'custom-curls'
  name: string;
  defaultIncrement: number; // in current unit (2.5kg or 5lb)
  workingSets: number; // default working sets, e.g. 5
  repsPerSet: number; // default reps, e.g. 5
  isPlateLoadable: boolean; // true for barbells, false for dumbbells/machines
  defaultRestSec?: number; // per-exercise default rest seconds (e.g. 90 or 180)
  isCustom?: boolean;
}

export interface WorkoutDefinition {
  id: string; // e.g. 'A', 'B', 'workout-c'
  name: string; // e.g. 'Workout A', 'Workout B', 'Accessory Pull'
  exerciseIds: string[]; // sequence of exercises
  isBuiltIn?: boolean;
}

export const BUILT_IN_EXERCISES: Record<string, ExerciseDefinition> = {
  squat: { id: 'squat', name: 'Squat', defaultIncrement: 2.5, workingSets: 5, repsPerSet: 5, isPlateLoadable: true, defaultRestSec: 180 },
  bench: { id: 'bench', name: 'Bench Press', defaultIncrement: 2.5, workingSets: 5, repsPerSet: 5, isPlateLoadable: true, defaultRestSec: 90 },
  row: { id: 'row', name: 'Barbell Row', defaultIncrement: 2.5, workingSets: 5, repsPerSet: 5, isPlateLoadable: true, defaultRestSec: 90 },
  ohp: { id: 'ohp', name: 'Overhead Press', defaultIncrement: 2.5, workingSets: 5, repsPerSet: 5, isPlateLoadable: true, defaultRestSec: 120 },
  deadlift: { id: 'deadlift', name: 'Deadlift', defaultIncrement: 5, workingSets: 1, repsPerSet: 5, isPlateLoadable: true, defaultRestSec: 180 },
};

// Legacy backward-compatibility alias
export const EXERCISE_DEFINITIONS = BUILT_IN_EXERCISES;

export const BUILT_IN_WORKOUTS: WorkoutDefinition[] = [
  { id: 'A', name: 'Workout A', exerciseIds: ['squat', 'bench', 'row'], isBuiltIn: true },
  { id: 'B', name: 'Workout B', exerciseIds: ['squat', 'ohp', 'deadlift'], isBuiltIn: true },
];

export const WORKOUT_TEMPLATES: { name: string; description: string; workouts: WorkoutDefinition[]; exercises?: ExerciseDefinition[] }[] = [
  {
    name: 'StrongLifts 5x5 (Standard)',
    description: 'The classic 3-day full body A/B barbell program focusing on linear progression.',
    workouts: BUILT_IN_WORKOUTS,
  },
  {
    name: '5x5 + Accessories',
    description: 'Adds Chins and Dips as arm & core accessory work to the standard 5x5 rotation.',
    exercises: [
      { id: 'chins', name: 'Chin-Ups', defaultIncrement: 1.25, workingSets: 3, repsPerSet: 8, isPlateLoadable: false, defaultRestSec: 90, isCustom: true },
      { id: 'dips', name: 'Dips', defaultIncrement: 1.25, workingSets: 3, repsPerSet: 8, isPlateLoadable: false, defaultRestSec: 90, isCustom: true },
    ],
    workouts: [
      { id: 'A', name: 'Workout A (Squat/Bench/Row + Dips)', exerciseIds: ['squat', 'bench', 'row', 'dips'], isBuiltIn: false },
      { id: 'B', name: 'Workout B (Squat/OHP/Deadlift + Chins)', exerciseIds: ['squat', 'ohp', 'deadlift', 'chins'], isBuiltIn: false },
    ],
  },
  {
    name: '3x5 Strength Split (A/B/C)',
    description: 'Lower volume 3-set variation with an added C session for higher recovery and variety.',
    exercises: [
      { id: 'pullup', name: 'Pull-Ups', defaultIncrement: 1.25, workingSets: 3, repsPerSet: 5, isPlateLoadable: false, defaultRestSec: 90, isCustom: true },
      { id: 'barbell-curl', name: 'Barbell Curls', defaultIncrement: 2.5, workingSets: 3, repsPerSet: 8, isPlateLoadable: true, defaultRestSec: 90, isCustom: true },
    ],
    workouts: [
      { id: 'A', name: 'Workout A (Squat / Bench / Row)', exerciseIds: ['squat', 'bench', 'row'], isBuiltIn: false },
      { id: 'B', name: 'Workout B (Squat / OHP / Deadlift)', exerciseIds: ['squat', 'ohp', 'deadlift'], isBuiltIn: false },
      { id: 'C', name: 'Workout C (Squat / Bench / Pull-Ups)', exerciseIds: ['squat', 'bench', 'pullup'], isBuiltIn: false },
    ],
  },
];

export const PROGRAM_WORKOUTS: Record<string, string[]> = {
  A: ['squat', 'bench', 'row'],
  B: ['squat', 'ohp', 'deadlift'],
};

export interface UserSettings {
  id: string; // 'default'
  units: WeightUnit;
  barWeight: number; // 20 (kg) or 45 (lb)
  availablePlates: number[]; // sorted descending, e.g. [25, 20, 15, 10, 5, 2.5, 1.25]
  increments: Record<string, number>; // { squat: 2.5, bench: 2.5, ... }
  startingWeights: Record<string, number>;
  deloadPercentage: number; // 10 (%)
  breakDaysThreshold: number; // e.g. 14 days
  restTimerDurationSec: number; // default 90s
  theme: 'dark' | 'light' | 'system';
  soundEnabled: boolean;
  onboardingCompleted: boolean;
  updatedAt: number;
  activeWorkoutId?: string; // current manual override or last tracked workout ID
}

export interface WorkoutSession {
  id: string; // UUID
  programVersion: string; // e.g. "v1.0" or "v2.0"
  sessionType: string; // 'A', 'B', or custom workout ID
  sessionName?: string; // optional user-friendly name e.g. "Workout A"
  status: 'completed' | 'in_progress' | 'abandoned';
  startedAt: number;
  completedAt?: number;
  notes?: string;
  isDemoData?: boolean;
}

export interface ExerciseInstance {
  id: string; // UUID
  sessionId: string;
  exerciseId: string;
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
  exerciseId: string;
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
  sessionType: string; // workout ID
  sessionName?: string;
  startedAt: number;
  exercises: {
    instanceId: string;
    exerciseId: string;
    exerciseName: string;
    prescribedWeight: number;
    painFlag: boolean;
    userOverrideReason?: string;
    isPlateLoadable?: boolean;
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
  exerciseId: string;
  prescribedWeight: number;
  previousWeight: number;
  reason: 'initial' | 'progression' | 'repeat_failure' | 'deload_3_fails' | 'pain_suppressed' | 'break_review' | 'manual_override';
  explanation: string;
  consecutiveFails: number;
  isDeload: boolean;
  breakDaysDetected?: number;
}
