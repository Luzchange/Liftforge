'use client';

import React, { useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { WeightUnit, ExerciseId } from '@/domain/types';
import { DEFAULT_SETTINGS_KG, DEFAULT_SETTINGS_LB } from '@/domain/plates';
import { Dumbbell, ShieldCheck, ArrowRight } from 'lucide-react';

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { updateSettings } = useSettings();
  const [step, setStep] = useState(1);
  const [unit, setUnit] = useState<WeightUnit>('kg');
  const [barWeight, setBarWeight] = useState(20);
  const [startingLoads, setStartingLoads] = useState<Record<ExerciseId, number>>({
    squat: 20,
    bench: 20,
    row: 30,
    ohp: 20,
    deadlift: 40,
  });

  const handleUnitChange = (newUnit: WeightUnit) => {
    setUnit(newUnit);
    if (newUnit === 'kg') {
      setBarWeight(20);
      setStartingLoads(DEFAULT_SETTINGS_KG.startingWeights);
    } else {
      setBarWeight(45);
      setStartingLoads(DEFAULT_SETTINGS_LB.startingWeights);
    }
  };

  const handleFinish = async () => {
    const base = unit === 'kg' ? DEFAULT_SETTINGS_KG : DEFAULT_SETTINGS_LB;
    await updateSettings({
      units: unit,
      barWeight,
      startingWeights: startingLoads,
      availablePlates: base.availablePlates,
      increments: base.increments,
      onboardingCompleted: true,
    });
    // Trigger immediate reload callback
    await onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col justify-between p-6 max-w-md mx-auto">
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-lime)] text-black flex items-center justify-center font-black text-xl shadow-[0_0_15px_var(--accent-lime-glow)]">
            LF
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">LiftForge</h1>
            <p className="text-xs text-[var(--muted-text)] font-medium">Strength Progression Engine</p>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2 text-[var(--foreground)]">Select Units & Bar</h2>
              <p className="text-sm text-[var(--muted-text)]">
                Choose your gym equipment measurement standards. You can calibrate plates anytime in Settings.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleUnitChange('kg')}
                className={`p-4 rounded-xl border text-center transition-all min-h-[56px] ${
                  unit === 'kg'
                    ? 'border-[var(--accent-lime)] bg-[var(--card-hover)] font-bold text-[var(--foreground)]'
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--muted-text)]'
                }`}
              >
                <div className="text-lg">Kilograms (kg)</div>
                <div className="text-xs mt-1 opacity-80">20 kg bar default</div>
              </button>

              <button
                type="button"
                onClick={() => handleUnitChange('lb')}
                className={`p-4 rounded-xl border text-center transition-all min-h-[56px] ${
                  unit === 'lb'
                    ? 'border-[var(--accent-lime)] bg-[var(--card-hover)] font-bold text-[var(--foreground)]'
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--muted-text)]'
                }`}
              >
                <div className="text-lg">Pounds (lb)</div>
                <div className="text-xs mt-1 opacity-80">45 lb bar default</div>
              </button>
            </div>

            {/* Quick preset for starting loads */}
            <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--card-border)] space-y-2">
              <span className="text-xs font-bold text-[var(--muted-text)] uppercase tracking-wider">
                Experience Level Preset
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const bar = unit === 'kg' ? 20 : 45;
                    setStartingLoads({
                      squat: bar,
                      bench: bar,
                      row: bar,
                      ohp: bar,
                      deadlift: unit === 'kg' ? 40 : 95,
                    });
                  }}
                  className="p-2.5 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-xs font-bold hover:border-[var(--accent-lime)] text-[var(--foreground)]"
                >
                  Start With Just The Bar (Beginner)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (unit === 'kg') {
                      setStartingLoads(DEFAULT_SETTINGS_KG.startingWeights);
                    } else {
                      setStartingLoads(DEFAULT_SETTINGS_LB.startingWeights);
                    }
                  }}
                  className="p-2.5 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-xs font-bold hover:border-[var(--accent-lime)] text-[var(--foreground)]"
                >
                  Standard Recommended
                </button>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--card-border)] space-y-3">
              <label className="block text-sm font-semibold text-[var(--foreground)]">
                Olympic Barbell Weight ({unit})
              </label>
              <input
                type="number"
                value={barWeight}
                onChange={(e) => setBarWeight(parseFloat(e.target.value) || 0)}
                className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded-lg p-3 text-lg font-mono text-[var(--foreground)] focus:border-[var(--accent-lime)] focus:outline-none"
              />
              <p className="text-xs text-[var(--muted-text)]">
                Standard men&apos;s Olympic barbell is {unit === 'kg' ? '20 kg' : '45 lb'}; women&apos;s bar is {unit === 'kg' ? '15 kg' : '35 lb'}.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold mb-1 text-[var(--foreground)]">Starting Weights</h2>
              <p className="text-xs text-[var(--muted-text)]">
                If you are a beginner, start with the empty barbell. If experienced, set current comfortable working weights.
              </p>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {(['squat', 'bench', 'row', 'ohp', 'deadlift'] as ExerciseId[]).map((ex) => {
                const names: Record<ExerciseId, string> = {
                  squat: 'Squat (5x5)',
                  bench: 'Bench Press (5x5)',
                  row: 'Barbell Row (5x5)',
                  ohp: 'Overhead Press (5x5)',
                  deadlift: 'Deadlift (1x5)',
                };
                return (
                  <div
                    key={ex}
                    className="flex items-center justify-between p-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl"
                  >
                    <div>
                      <div className="font-semibold text-sm text-[var(--foreground)]">{names[ex]}</div>
                      <div className="text-xs text-[var(--muted-text)]">Working load</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step={unit === 'kg' ? '2.5' : '5'}
                        value={startingLoads[ex]}
                        onChange={(e) =>
                          setStartingLoads({ ...startingLoads, [ex]: parseFloat(e.target.value) || 0 })
                        }
                        className="w-20 bg-[var(--background)] border border-[var(--card-border)] rounded-lg p-2 text-right font-mono font-bold text-base text-[var(--foreground)]"
                      />
                      <span className="text-xs text-[var(--muted-text)] font-mono">{unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="pt-6">
        {step === 1 ? (
          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full bg-[var(--accent-lime)] text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-95 transition-all text-base min-h-[56px] shadow-[0_0_20px_var(--accent-lime-glow)]"
          >
            Configure Starting Loads
            <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-1/3 bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] font-semibold py-4 rounded-xl min-h-[56px]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleFinish}
              className="w-2/3 bg-[var(--accent-lime)] text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-95 transition-all text-base min-h-[56px] shadow-[0_0_20px_var(--accent-lime-glow)]"
            >
              <ShieldCheck className="w-5 h-5" />
              Start Training
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
