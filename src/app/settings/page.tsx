'use client';

import React, { useRef, useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { WeightUnit, ExerciseId } from '@/domain/types';
import { exportDatabaseToJson, importDatabaseFromJson, exportSetsToCsv, convertAllHistoricalUnits } from '@/domain/portability';
import { seedDemoData } from '@/domain/demoData';
import { clearDemoData, resetAllWorkoutData } from '@/domain/db';
import { DEFAULT_PLATES_KG, DEFAULT_PLATES_LB } from '@/domain/plates';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  Database,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  AlertTriangle,
  Check,
  RefreshCw,
} from 'lucide-react';

export default function SettingsPage() {
  const { settings, updateSettings, reloadSettings, loading } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="animate-pulse text-[var(--accent-lime)] font-mono text-sm">
          Loading Settings...
        </div>
      </div>
    );
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleUnitToggle = async (newUnit: WeightUnit) => {
    if (newUnit === settings.units) return;
    const isKg = newUnit === 'kg';
    setIsProcessing(true);
    await convertAllHistoricalUnits(newUnit);
    await updateSettings({
      units: newUnit,
      barWeight: isKg ? 20 : 45,
      availablePlates: isKg ? DEFAULT_PLATES_KG : DEFAULT_PLATES_LB,
      increments: {
        squat: isKg ? 2.5 : 5,
        bench: isKg ? 2.5 : 5,
        row: isKg ? 2.5 : 5,
        ohp: isKg ? 2.5 : 5,
        deadlift: isKg ? 5 : 10,
      },
      startingWeights: {
        squat: isKg ? Math.round(settings.startingWeights.squat / 2.2) : Math.round(settings.startingWeights.squat * 2.2),
        bench: isKg ? Math.round(settings.startingWeights.bench / 2.2) : Math.round(settings.startingWeights.bench * 2.2),
        row: isKg ? Math.round(settings.startingWeights.row / 2.2) : Math.round(settings.startingWeights.row * 2.2),
        ohp: isKg ? Math.round(settings.startingWeights.ohp / 2.2) : Math.round(settings.startingWeights.ohp * 2.2),
        deadlift: isKg ? Math.round(settings.startingWeights.deadlift / 2.2) : Math.round(settings.startingWeights.deadlift * 2.2),
      },
    });
    setIsProcessing(false);
    showNotification('success', `Units converted to ${newUnit.toUpperCase()}. Historical logs accurately recalculated.`);
  };

  const handleExportJson = async () => {
    try {
      const jsonStr = await exportDatabaseToJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liftforge-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification('success', 'Backup JSON exported successfully.');
    } catch (e) {
      showNotification('error', `Export failed: ${(e as Error).message}`);
    }
  };

  const handleExportCsv = async () => {
    try {
      const csvStr = await exportSetsToCsv();
      const blob = new Blob([csvStr], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liftforge-sets-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification('success', 'Workout sets CSV exported.');
    } catch (e) {
      showNotification('error', `CSV Export failed: ${(e as Error).message}`);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const text = await file.text();
      const res = await importDatabaseFromJson(text, 'merge');
      if (res.success) {
        await reloadSettings();
        showNotification('success', res.message);
      } else {
        showNotification('error', res.message);
      }
    } catch (err) {
      showNotification('error', `Import error: ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSeedDemo = async () => {
    setIsProcessing(true);
    await seedDemoData();
    setIsProcessing(false);
    showNotification('success', 'Sample 3-session demo data loaded into history.');
  };

  const handleClearDemo = async () => {
    setIsProcessing(true);
    await clearDemoData();
    setIsProcessing(false);
    showNotification('success', 'Demo data removed.');
  };

  const handleWipeAll = async () => {
    if (confirm('Are you sure you want to delete all workout sessions and drafts? This cannot be undone.')) {
      setIsProcessing(true);
      await resetAllWorkoutData();
      setIsProcessing(false);
      showNotification('success', 'All local workout data erased.');
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-28 space-y-6">
      <div className="pt-2">
        <span className="text-xs font-bold text-[var(--accent-lime)] uppercase tracking-wider">
          Preferences & Data
        </span>
        <h1 className="text-2xl font-black text-[var(--foreground)]">Settings</h1>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
          }`}
        >
          {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {feedback.message}
        </div>
      )}

      {/* Cloud backup notice warning */}
      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-[var(--foreground)] leading-relaxed">
          <strong className="font-semibold block text-amber-400">Local-First Storage Notice</strong>
          LiftForge stores your workouts directly in your device&apos;s browser database. Browser-local storage is not a cloud backup. Always export a JSON backup periodically to preserve your training history.
        </div>
      </div>

      {/* Theme & Audio Preferences */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 space-y-4">
        <h3 className="font-bold text-sm text-[var(--foreground)] uppercase tracking-wider text-[var(--muted-text)]">
          Interface & Audio
        </h3>

        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-[var(--foreground)]">Visual Theme</div>
          <div className="flex gap-1 bg-[var(--background)] p-1 rounded-xl border border-[var(--card-border)]">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => updateSettings({ theme: t })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  settings.theme === t
                    ? 'bg-[var(--card-bg)] text-[var(--accent-lime)] font-bold shadow-xs'
                    : 'text-[var(--muted-text)] hover:text-[var(--foreground)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[var(--card-border)]">
          <div className="text-sm font-semibold text-[var(--foreground)]">Rest Timer Sound Beep</div>
          <button
            onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold min-w-[40px] min-h-[40px] ${
              settings.soundEnabled
                ? 'bg-[var(--accent-lime)] text-black border-[var(--accent-lime)]'
                : 'bg-[var(--background)] text-[var(--muted-text)] border-[var(--card-border)]'
            }`}
          >
            {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {settings.soundEnabled ? 'Enabled' : 'Muted'}
          </button>
        </div>
      </div>

      {/* Units & Barbell Calibration */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 space-y-4">
        <h3 className="font-bold text-sm text-[var(--foreground)] uppercase tracking-wider text-[var(--muted-text)]">
          Units & Equipment
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--foreground)]">Unit of Measure</div>
            <div className="text-xs text-[var(--muted-text)]">Current: {settings.units.toUpperCase()}</div>
          </div>
          <div className="flex gap-1 bg-[var(--background)] p-1 rounded-xl border border-[var(--card-border)]">
            {(['kg', 'lb'] as const).map((u) => (
              <button
                key={u}
                onClick={() => handleUnitToggle(u)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  settings.units === u
                    ? 'bg-[var(--accent-lime)] text-black shadow-xs'
                    : 'text-[var(--muted-text)] hover:text-[var(--foreground)]'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[var(--card-border)]">
          <div className="text-sm font-semibold text-[var(--foreground)]">Barbell Weight</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={settings.barWeight}
              onChange={(e) => updateSettings({ barWeight: parseFloat(e.target.value) || 0 })}
              className="w-20 bg-[var(--background)] border border-[var(--card-border)] rounded-lg p-2 text-right font-mono font-bold text-sm text-[var(--foreground)]"
            />
            <span className="text-xs font-mono text-[var(--muted-text)]">{settings.units}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[var(--card-border)]">
          <div>
            <div className="text-sm font-semibold text-[var(--foreground)]">Rest Timer Duration</div>
            <div className="text-xs text-[var(--muted-text)]">Between working sets</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="15"
              value={settings.restTimerDurationSec}
              onChange={(e) => updateSettings({ restTimerDurationSec: parseInt(e.target.value, 10) || 90 })}
              className="w-20 bg-[var(--background)] border border-[var(--card-border)] rounded-lg p-2 text-right font-mono font-bold text-sm text-[var(--foreground)]"
            />
            <span className="text-xs font-mono text-[var(--muted-text)]">sec</span>
          </div>
        </div>
      </div>

      {/* Progression & Deload Defaults */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 space-y-4">
        <h3 className="font-bold text-sm text-[var(--foreground)] uppercase tracking-wider text-[var(--muted-text)]">
          Progression Engine Rules
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--foreground)]">Deload Percentage</div>
            <div className="text-xs text-[var(--muted-text)]">After 3 consecutive failures</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={settings.deloadPercentage}
              onChange={(e) => updateSettings({ deloadPercentage: parseFloat(e.target.value) || 10 })}
              className="w-16 bg-[var(--background)] border border-[var(--card-border)] rounded-lg p-2 text-right font-mono font-bold text-sm text-[var(--foreground)]"
            />
            <span className="text-xs font-mono text-[var(--muted-text)]">%</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[var(--card-border)]">
          <div>
            <div className="text-sm font-semibold text-[var(--foreground)]">Training Break Threshold</div>
            <div className="text-xs text-[var(--muted-text)]">Triggers safe load review prompt</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={settings.breakDaysThreshold}
              onChange={(e) => updateSettings({ breakDaysThreshold: parseInt(e.target.value, 10) || 14 })}
              className="w-16 bg-[var(--background)] border border-[var(--card-border)] rounded-lg p-2 text-right font-mono font-bold text-sm text-[var(--foreground)]"
            />
            <span className="text-xs font-mono text-[var(--muted-text)]">days</span>
          </div>
        </div>
      </div>

      {/* Export, Import & Backups */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-sm text-[var(--foreground)] uppercase tracking-wider text-[var(--muted-text)]">
          Data Portability & Backups
        </h3>

        <button
          onClick={handleExportJson}
          className="w-full p-3 rounded-xl bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--accent-lime)] text-[var(--foreground)] flex items-center justify-between text-xs font-semibold min-h-[48px]"
        >
          <span className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[var(--accent-lime)]" />
            Export Full JSON Backup
          </span>
          <span className="text-xs text-[var(--muted-text)] font-mono">.json</span>
        </button>

        <button
          onClick={handleExportCsv}
          className="w-full p-3 rounded-xl bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--accent-lime)] text-[var(--foreground)] flex items-center justify-between text-xs font-semibold min-h-[48px]"
        >
          <span className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Export Completed Sets as CSV
          </span>
          <span className="text-xs text-[var(--muted-text)] font-mono">.csv</span>
        </button>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full p-3 rounded-xl bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--accent-lime)] text-[var(--foreground)] flex items-center justify-between text-xs font-semibold min-h-[48px]"
          >
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-sky-400" />
              Restore / Import JSON Backup
            </span>
            <span className="text-xs text-[var(--muted-text)] font-mono">Upload</span>
          </button>
        </div>
      </div>

      {/* Demo Data & Danger Zone */}
      <div className="bg-[var(--card-bg)] border border-rose-500/20 rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-sm text-rose-400 uppercase tracking-wider">
          Demo Data & Database Reset
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSeedDemo}
            disabled={isProcessing}
            className="p-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-xs font-semibold text-[var(--foreground)] hover:border-[var(--accent-lime)] text-center min-h-[44px]"
          >
            Load Sample Demo Data
          </button>
          <button
            onClick={handleClearDemo}
            disabled={isProcessing}
            className="p-3 bg-[var(--background)] border border-[var(--card-border)] rounded-xl text-xs font-semibold text-[var(--muted-text)] hover:text-rose-400 text-center min-h-[44px]"
          >
            Clear Demo Data
          </button>
        </div>

        <button
          onClick={handleWipeAll}
          disabled={isProcessing}
          className="w-full p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/20 text-center min-h-[44px] flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" />
          Erase All Workout History
        </button>
      </div>
    </div>
  );
}
