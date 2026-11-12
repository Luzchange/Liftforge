'use client';

import React, { useEffect, useState } from 'react';
import { db, getAllExercises } from '@/domain/db';
import { ExerciseInstance, LoggedSet, WorkoutSession, BUILT_IN_EXERCISES, ExerciseDefinition } from '@/domain/types';
import { useSettings } from '@/context/SettingsContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function ProgressPage() {
  const { settings, loading } = useSettings();
  const [selectedExercise, setSelectedExercise] = useState<string>('squat');
  const [availableExercises, setAvailableExercises] = useState<ExerciseDefinition[]>(Object.values(BUILT_IN_EXERCISES));
  const [chartData, setChartData] = useState<
    { date: string; weight: number; volume: number; est1rm: number }[]
  >([]);

  useEffect(() => {
    const loadExercises = async () => {
      const eMap = await getAllExercises();
      setAvailableExercises(Object.values(eMap));
    };
    loadExercises();
  }, []);

  useEffect(() => {
    const loadProgress = async () => {
      const allSessions = await db.sessions.toArray();
      const allInstances = await db.exerciseInstances.toArray();
      const allSets = await db.loggedSets.toArray();

      const completedSessions = allSessions
        .filter((s) => s.status === 'completed' && s.completedAt)
        .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

      const points: { date: string; weight: number; volume: number; est1rm: number }[] = [];

      for (const session of completedSessions) {
        const instance = allInstances.find(
          (i) => i.sessionId === session.id && i.exerciseId === selectedExercise
        );
        if (!instance) continue;

        const workingSets = allSets.filter(
          (s) => s.exerciseInstanceId === instance.id && s.setType === 'working'
        );
        if (workingSets.length === 0) continue;

        // Calculate maximum 1RM for this session using Epley formula: w * (1 + r / 30)
        let maxEst1RM = 0;
        let sessionVolume = 0;
        let topWeight = 0;

        for (const s of workingSets) {
          if (s.actualReps > 0) {
            const epley = s.actualWeight * (1 + s.actualReps / 30);
            if (epley > maxEst1RM) maxEst1RM = epley;
            if (s.actualWeight > topWeight) topWeight = s.actualWeight;
            sessionVolume += s.actualWeight * s.actualReps;
          }
        }

        if (topWeight > 0) {
          const dateStr = session.completedAt
            ? new Date(session.completedAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
            : '';

          points.push({
            date: dateStr,
            weight: Math.round(topWeight * 10) / 10,
            volume: Math.round(sessionVolume),
            est1rm: Math.round(maxEst1RM * 10) / 10,
          });
        }
      }

      setChartData(points);
    };

    loadProgress();
  }, [selectedExercise]);

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-pulse text-[var(--accent-lime)] font-mono text-sm">
          Loading Progress Analytics...
        </div>
      </div>
    );
  }

  const currentDef = availableExercises.find((e) => e.id === selectedExercise) || {
    id: selectedExercise,
    name: selectedExercise,
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-6">
      <div className="pt-2">
        <span className="text-xs font-bold text-[var(--accent-lime)] uppercase tracking-wider">
          Analytics & Metrics
        </span>
        <h1 className="text-2xl font-black text-[var(--foreground)]">Strength Trajectory</h1>
      </div>

      {/* Exercise Selector Buttons (built-ins + customs) */}
      <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-none">
        {availableExercises.map((ex) => (
          <button
            key={ex.id}
            onClick={() => setSelectedExercise(ex.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all min-h-[44px] ${
              selectedExercise === ex.id
                ? 'bg-[var(--accent-lime)] text-black shadow-[0_0_12px_var(--accent-lime-glow)] font-black'
                : 'bg-[var(--card-bg)] text-[var(--muted-text)] border border-[var(--card-border)] hover:text-[var(--foreground)]'
            }`}
          >
            {ex.name}
          </button>
        ))}
      </div>

      {/* Chart Card */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-[var(--foreground)]">
              {currentDef.name} Progression
            </h3>
            <p className="text-xs text-[var(--muted-text)]">Working weight & Estimated 1RM</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="flex items-center gap-1 text-[var(--accent-lime)] font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-lime)]" /> Load
            </span>
            <span className="flex items-center gap-1 text-sky-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Est 1RM
            </span>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-center p-4">
            <TrendingUp className="w-8 h-8 text-[var(--muted-text)] opacity-40 mb-2" />
            <p className="text-xs text-[var(--muted-text)]">No workout logs recorded for this exercise yet.</p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="date" stroke="var(--muted-text)" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="var(--muted-text)"
                  fontSize={11}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  unit={` ${settings.units}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--card-border)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: 'var(--foreground)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  name={`Working Weight (${settings.units})`}
                  stroke="var(--accent-lime)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: 'var(--accent-lime)' }}
                />
                <Line
                  type="monotone"
                  dataKey="est1rm"
                  name={`Est 1RM (${settings.units})`}
                  stroke="#38bdf8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#38bdf8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Summary Insights */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4">
            <div className="text-[10px] text-[var(--muted-text)] uppercase font-bold tracking-wider">
              Current Working Load
            </div>
            <div className="text-2xl font-black font-mono text-[var(--accent-lime)] mt-1">
              {chartData[chartData.length - 1].weight} {settings.units}
            </div>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4">
            <div className="text-[10px] text-[var(--muted-text)] uppercase font-bold tracking-wider">
              Peak Est. 1RM
            </div>
            <div className="text-2xl font-black font-mono text-sky-400 mt-1">
              {Math.max(...chartData.map((d) => d.est1rm))} {settings.units}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
