import { roundToAchievableWeight } from './plates';

export interface WarmupSetPrescription {
  setIndex: number;
  percentage: number;
  weight: number;
  reps: number;
}

/**
 * Calculates standard warm-up sets based on working weight and bar weight.
 * For light weights (close to bar weight), warm-ups are kept minimal or empty bar.
 * Warmups are completely distinct from working sets.
 */
export function calculateWarmupSets(
  workingWeight: number,
  barWeight: number,
  availablePlates: number[]
): WarmupSetPrescription[] {
  // If working weight is less than or equal to bar weight + 10, just 1 or 2 empty bar sets
  if (workingWeight <= barWeight + 10) {
    return [
      {
        setIndex: 1,
        percentage: 0,
        weight: barWeight,
        reps: 5,
      },
      {
        setIndex: 2,
        percentage: 0,
        weight: barWeight,
        reps: 5,
      },
    ];
  }

  const warmups: WarmupSetPrescription[] = [];

  // Set 1: Empty bar x 5
  warmups.push({
    setIndex: 1,
    percentage: 0,
    weight: barWeight,
    reps: 5,
  });

  // Set 2: Empty bar x 5
  warmups.push({
    setIndex: 2,
    percentage: 0,
    weight: barWeight,
    reps: 5,
  });

  // Intermediate percentages based on working weight
  const increments = [
    { pct: 0.4, reps: 5 },
    { pct: 0.6, reps: 3 },
    { pct: 0.8, reps: 2 },
  ];

  let currentIndex = 3;
  for (const { pct, reps } of increments) {
    const rawWeight = barWeight + (workingWeight - barWeight) * pct;
    const rounded = roundToAchievableWeight(rawWeight, barWeight, availablePlates);

    // Only add if it's strictly greater than the previous set and strictly less than working weight
    const lastWeight = warmups[warmups.length - 1].weight;
    if (rounded > lastWeight && rounded < workingWeight) {
      warmups.push({
        setIndex: currentIndex++,
        percentage: Math.round(pct * 100),
        weight: rounded,
        reps,
      });
    }
  }

  return warmups;
}
