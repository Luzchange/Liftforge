import { z } from 'zod';

export const WeightUnitSchema = z.enum(['kg', 'lb']);
export const ExerciseIdSchema = z.string().min(1);
export const SessionTypeSchema = z.string().min(1);
export const SetTypeSchema = z.enum(['warmup', 'working']);
export const SetStatusSchema = z.enum(['completed', 'missed', 'skipped']);

export const ExerciseDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultIncrement: z.number().positive(),
  workingSets: z.number().int().positive(),
  repsPerSet: z.number().int().positive(),
  isPlateLoadable: z.boolean(),
  defaultRestSec: z.number().optional(),
  isCustom: z.boolean().optional(),
});

export const WorkoutDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  exerciseIds: z.array(z.string()),
  isBuiltIn: z.boolean().optional(),
});

export const UserSettingsSchema = z.object({
  id: z.string(),
  units: WeightUnitSchema,
  barWeight: z.number().positive(),
  availablePlates: z.array(z.number().positive()),
  increments: z.record(z.string(), z.number().positive()),
  startingWeights: z.record(z.string(), z.number().positive()),
  deloadPercentage: z.number().min(5).max(50),
  breakDaysThreshold: z.number().min(3).max(60),
  restTimerDurationSec: z.number().min(10).max(600),
  theme: z.enum(['dark', 'light', 'system']),
  soundEnabled: z.boolean(),
  onboardingCompleted: z.boolean(),
  updatedAt: z.number(),
  activeWorkoutId: z.string().optional(),
});

export const WorkoutSessionSchema = z.object({
  id: z.string(),
  programVersion: z.string(),
  sessionType: SessionTypeSchema,
  sessionName: z.string().optional(),
  status: z.enum(['completed', 'in_progress', 'abandoned']),
  startedAt: z.number(),
  completedAt: z.number().optional(),
  notes: z.string().optional(),
  isDemoData: z.boolean().optional(),
});

export const ExerciseInstanceSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  exerciseId: ExerciseIdSchema,
  exerciseName: z.string(),
  targetSets: z.number().int().positive(),
  targetReps: z.number().int().positive(),
  prescribedWeight: z.number().positive(),
  actualWeight: z.number().positive().optional(),
  painFlag: z.boolean(),
  userOverrideReason: z.string().optional(),
  notes: z.string().optional(),
});

export const LoggedSetSchema = z.object({
  id: z.string(),
  exerciseInstanceId: z.string(),
  sessionId: z.string(),
  exerciseId: ExerciseIdSchema,
  setIndex: z.number().int().min(1),
  setType: SetTypeSchema,
  prescribedWeight: z.number().positive(),
  prescribedReps: z.number().int().positive(),
  actualWeight: z.number().positive(),
  actualReps: z.number().int().min(0),
  status: SetStatusSchema,
  isDeload: z.boolean().optional(),
  completedAt: z.number().optional(),
});

export const ExportDataSchema = z.object({
  version: z.enum(['liftforge-v1', 'liftforge-v2']),
  exportedAt: z.number(),
  settings: UserSettingsSchema,
  sessions: z.array(WorkoutSessionSchema),
  exerciseInstances: z.array(ExerciseInstanceSchema),
  loggedSets: z.array(LoggedSetSchema),
  workouts: z.array(WorkoutDefinitionSchema).optional(),
  customExercises: z.array(ExerciseDefinitionSchema).optional(),
});

export type ExportData = z.infer<typeof ExportDataSchema>;

/**
 * Validates imported JSON string and parses into structured data with backward compatibility.
 */
export function validateImportJson(jsonStr: string): { success: true; data: ExportData } | { success: false; error: string } {
  try {
    const raw = JSON.parse(jsonStr);
    const parsed = ExportDataSchema.safeParse(raw);
    if (!parsed.success) {
      const issueSummary = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      return { success: false, error: `Invalid backup format: ${issueSummary}` };
    }
    return { success: true, data: parsed.data };
  } catch (err) {
    return { success: false, error: `JSON Parse error: ${(err as Error).message}` };
  }
}
