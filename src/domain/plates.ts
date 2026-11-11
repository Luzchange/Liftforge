import { WeightUnit, ExerciseId, UserSettings } from './types';

export const KG_TO_LB = 2.20462262185;
export const LB_TO_KG = 1 / KG_TO_LB;

/**
 * Converts weight between kg and lb with fixed precision.
 */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit, precision = 2): number {
  if (from === to) return roundToPrecision(value, precision);
  if (from === 'kg' && to === 'lb') {
    return roundToPrecision(value * KG_TO_LB, precision);
  }
  return roundToPrecision(value * LB_TO_KG, precision);
}

export function roundToPrecision(num: number, precision = 2): number {
  const factor = Math.pow(10, precision);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
export const DEFAULT_PLATES_LB = [45, 35, 25, 10, 5, 2.5];

export const DEFAULT_SETTINGS_KG: UserSettings = {
  id: 'default',
  units: 'kg',
  barWeight: 20,
  availablePlates: DEFAULT_PLATES_KG,
  increments: {
    squat: 2.5,
    bench: 2.5,
    row: 2.5,
    ohp: 2.5,
    deadlift: 5,
  },
  startingWeights: {
    squat: 20,
    bench: 20,
    row: 30,
    ohp: 20,
    deadlift: 40,
  },
  deloadPercentage: 10,
  breakDaysThreshold: 14,
  restTimerDurationSec: 90,
  theme: 'dark',
  soundEnabled: false,
  onboardingCompleted: true,
  updatedAt: Date.now(),
};

export const DEFAULT_SETTINGS_LB: UserSettings = {
  id: 'default',
  units: 'lb',
  barWeight: 45,
  availablePlates: DEFAULT_PLATES_LB,
  increments: {
    squat: 5,
    bench: 5,
    row: 5,
    ohp: 5,
    deadlift: 10,
  },
  startingWeights: {
    squat: 45,
    bench: 45,
    row: 65,
    ohp: 45,
    deadlift: 95,
  },
  deloadPercentage: 10,
  breakDaysThreshold: 14,
  restTimerDurationSec: 90,
  theme: 'dark',
  soundEnabled: false,
  onboardingCompleted: true,
  updatedAt: Date.now(),
};

/**
 * Calculates the smallest plate pair achievable increment.
 */
export function getMinimumPlatePair(availablePlates: number[]): number {
  if (!availablePlates || availablePlates.length === 0) return 2.5;
  const smallestPlate = Math.min(...availablePlates);
  return smallestPlate * 2; // Plates are added in pairs on barbell sleeves
}

/**
 * Rounds a target weight to the closest achievable weight given bar weight and plate pairs.
 */
export function roundToAchievableWeight(
  targetWeight: number,
  barWeight: number,
  availablePlates: number[]
): number {
  if (targetWeight <= barWeight) {
    return barWeight;
  }

  const plates = [...availablePlates].sort((a, b) => a - b);
  const smallestPlate = plates[0] || 1.25;
  const smallestStep = smallestPlate * 2;

  const excess = targetWeight - barWeight;
  const steps = Math.round(excess / smallestStep);
  const result = barWeight + steps * smallestStep;

  return roundToPrecision(result, 2);
}

/**
 * Calculates plate breakdown per barbell sleeve.
 */
export interface PlateCalculation {
  targetWeight: number;
  barWeight: number;
  achievableWeight: number;
  platesPerSide: { plate: number; count: number }[];
  difference: number;
}

export function calculatePlates(
  targetWeight: number,
  barWeight: number,
  availablePlates: number[]
): PlateCalculation {
  const plates = [...availablePlates].sort((a, b) => b - a);
  if (targetWeight <= barWeight) {
    return {
      targetWeight,
      barWeight,
      achievableWeight: barWeight,
      platesPerSide: [],
      difference: barWeight - targetWeight,
    };
  }

  const perSideTarget = (targetWeight - barWeight) / 2;
  const platesPerSide: { plate: number; count: number }[] = [];
  let remaining = perSideTarget;
  let sideWeight = 0;

  for (const plate of plates) {
    const count = Math.floor((remaining + 0.0001) / plate);
    if (count > 0) {
      platesPerSide.push({ plate, count });
      sideWeight += count * plate;
      remaining -= count * plate;
    }
  }

  const achievable = barWeight + sideWeight * 2;
  return {
    targetWeight,
    barWeight,
    achievableWeight: roundToPrecision(achievable, 2),
    platesPerSide,
    difference: roundToPrecision(achievable - targetWeight, 2),
  };
}
