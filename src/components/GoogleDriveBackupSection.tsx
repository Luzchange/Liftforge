'use client';

import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Share2,
  UploadCloud,
  DownloadCloud,
  Check,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  RefreshCw,
  LogOut,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  backupViaSystemShareToDrive,
  uploadBackupToGoogleDrive,
  listGoogleDriveBackups,
  restoreFromGoogleDriveBackup,
  getStoredGoogleClientId,
  saveGoogleClientId,
  getStoredGoogleUser,
  disconnectGoogleDrive,
  DEFAULT_GOOGLE_CLIENT_ID,
  GoogleDriveFile,
} from '@/domain/googleDrive';

interface GoogleDriveBackupSectionProps {
  onSuccessNotification: (msg: string) => void;
  onErrorNotification: (msg: string) => void;
  onDataRestored?: () => void;
}

export function GoogleDriveBackupSection({
  onSuccessNotification,
  onErrorNotification,
  onDataRestored,
}: GoogleDriveBackupSectionProps) {
  const [clientId, setClientId] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<{ email: string | null; isLoggedIn: boolean }>({
    email: null,
    isLoggedIn: false,
  });
  const [remoteBackups, setRemoteBackups] = useState<GoogleDriveFile[]>([]);
  const [showRemoteFiles, setShowRemoteFiles] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string>('');

  useEffect(() => {
    setClientId(getStoredGoogleClientId());
    setUser(getStoredGoogleUser());
  }, []);

  const handleSaveClientId = () => {
    saveGoogleClientId(clientId);
    onSuccessNotification('Google Cloud Client ID saved.');
    setShowConfig(false);
  };

  // 1. Instant System Share to Drive (No setup required)
  const handleSystemShareToDrive = async () => {
    try {
      setIsProcessing(true);
      const res = await backupViaSystemShareToDrive();
      if (res.shared) {
        onSuccessNotification(res.message);
      }
    } catch (err: any) {
      onErrorNotification(err.message || 'Failed to share backup');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Direct Cloud Upload via Google Drive REST API
  const handleCloudUpload = async () => {
    try {
      setIsProcessing(true);
      const activeId = clientId || getStoredGoogleClientId();
      const result = await uploadBackupToGoogleDrive(activeId);
      setUser(getStoredGoogleUser());
      onSuccessNotification(`Successfully backed up to Google Drive (${result.fileName})`);
      // Refresh backup list
      handleListBackups();
    } catch (err: any) {
      onErrorNotification(err.message || 'Google Drive upload failed');
      setUser(getStoredGoogleUser());
    } finally {
      setIsProcessing(false);
    }
  };

  const handleListBackups = async () => {
    try {
      setIsProcessing(true);
      const files = await listGoogleDriveBackups(clientId);
      setRemoteBackups(files);
      setShowRemoteFiles(true);
      if (files.length > 0 && !selectedFileId) {
        setSelectedFileId(files[0].id);
      }
    } catch (err: any) {
      onErrorNotification(err.message || 'Failed to list Google Drive files');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedFileId) {
      onErrorNotification('Please select a backup file from Google Drive to restore.');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to restore from this Google Drive backup? Any local logs matching this backup will be updated.'
    );
    if (!confirmed) return;

    try {
      setIsProcessing(true);
      const result = await restoreFromGoogleDriveBackup(selectedFileId, 'replace');
      if (result.success) {
        onSuccessNotification('Successfully restored database from Google Drive.');
        if (onDataRestored) onDataRestored();
      } else {
        onErrorNotification(result.message);
      }
    } catch (err: any) {
      onErrorNotification(err.message || 'Failed to restore backup');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleDrive();
    setUser({ email: null, isLoggedIn: false });
    setRemoteBackups([]);
    setShowRemoteFiles(false);
    onSuccessNotification('Disconnected from Google Drive.');
  };

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-lime)]/10 text-[var(--accent-lime)] flex items-center justify-center font-bold">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[var(--foreground)]">Google Drive Cloud Backup</h3>
            <p className="text-[11px] text-[var(--muted-text)]">
              Store your workouts safely in your personal Google Drive
            </p>
          </div>
        </div>

        {user.isLoggedIn && (
          <button
            onClick={handleDisconnect}
            className="text-[11px] text-rose-400 hover:underline flex items-center gap-1 font-mono"
            title="Disconnect Google Drive"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        )}
      </div>

      {user.isLoggedIn && user.email && (
        <div className="px-3 py-1.5 rounded-lg bg-[var(--background)] border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5 truncate">
            <Check className="w-3.5 h-3.5 flex-shrink-0" />
            Connected: <strong className="font-mono truncate">{user.email}</strong>
          </span>
        </div>
      )}

      {/* Primary Actions Grid */}
      <div className="space-y-2">
        {/* Quick Save to Drive (Native Sheet / Share Intent) */}
        <button
          onClick={handleSystemShareToDrive}
          disabled={isProcessing}
          className="w-full p-3 rounded-xl bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--accent-lime)] text-[var(--foreground)] flex items-center justify-between text-xs font-semibold min-h-[48px] transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Share2 className="w-4 h-4 text-[var(--accent-lime)]" />
            <span>Save to Google Drive / Share</span>
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--accent-lime)]/10 text-[var(--accent-lime)] font-mono font-medium">
            1-Tap
          </span>
        </button>

        {/* Direct Cloud Sync (Google Drive REST API) */}
        <button
          onClick={handleCloudUpload}
          disabled={isProcessing}
          className="w-full p-3 rounded-xl bg-[var(--background)] border border-[var(--card-border)] hover:border-sky-400 text-[var(--foreground)] flex items-center justify-between text-xs font-semibold min-h-[48px] transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <UploadCloud className="w-4 h-4 text-sky-400" />
            <span>Direct Upload to Google Drive</span>
          </span>
          <span className="text-[10px] text-[var(--muted-text)] font-mono">Cloud API</span>
        </button>
      </div>

      {/* Cloud Restore & History Drawer */}
      <div className="border-t border-[var(--card-border)] pt-3">
        <button
          onClick={() => {
            if (!showRemoteFiles) {
              handleListBackups();
            } else {
              setShowRemoteFiles(false);
            }
          }}
          disabled={isProcessing}
          className="w-full py-1 text-xs text-[var(--muted-text)] hover:text-[var(--foreground)] flex items-center justify-between font-medium"
        >
          <span className="flex items-center gap-1.5">
            <DownloadCloud className="w-3.5 h-3.5 text-sky-400" />
            Restore from Google Drive
          </span>
          {showRemoteFiles ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showRemoteFiles && (
          <div className="mt-2.5 space-y-2 bg-[var(--background)] p-3 rounded-xl border border-[var(--card-border)]">
            {remoteBackups.length === 0 ? (
              <div className="text-center py-3 text-xs text-[var(--muted-text)]">
                No LiftForge backup files found on Google Drive.
              </div>
            ) : (
              <>
                <label className="text-[11px] font-semibold text-[var(--foreground)] block">
                  Select Backup Version:
                </label>
                <select
                  value={selectedFileId}
                  onChange={(e) => setSelectedFileId(e.target.value)}
                  className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-2 text-xs font-mono text-[var(--foreground)]"
                >
                  {remoteBackups.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({new Date(f.modifiedTime).toLocaleDateString()})
                    </option>
                  ))}
                </select>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleRestoreBackup}
                    disabled={isProcessing || !selectedFileId}
                    className="flex-1 py-2 px-3 bg-[var(--accent-lime)] text-black font-bold text-xs rounded-lg hover:opacity-90 flex items-center justify-center gap-1.5"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    Restore Selected Backup
                  </button>
                  <button
                    onClick={handleListBackups}
                    disabled={isProcessing}
                    className="p-2 border border-[var(--card-border)] rounded-lg hover:border-[var(--muted-text)] text-[var(--muted-text)]"
                    title="Refresh List"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Cloud API Client ID Configuration Toggle */}
      <div className="pt-2 border-t border-[var(--card-border)]">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="text-[11px] text-[var(--muted-text)] hover:text-[var(--foreground)] flex items-center gap-1 font-mono transition-colors"
        >
          <HelpCircle className="w-3 h-3" />
          {showConfig ? 'Hide Cloud API Setup' : 'Custom Google Cloud OAuth Client ID (Optional)'}
        </button>

        {showConfig && (
          <div className="mt-2.5 p-3 rounded-xl bg-[var(--background)] border border-[var(--card-border)] space-y-2.5 text-xs">
            <p className="text-[11px] text-[var(--muted-text)] leading-relaxed">
              LiftForge connects directly from your browser to Google Drive using your OAuth Client ID. The default client ID is already pre-configured:
            </p>
            <div>
              <label className="text-[11px] font-semibold text-[var(--foreground)] block mb-1">
                OAuth 2.0 Client ID:
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={DEFAULT_GOOGLE_CLIENT_ID}
                className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-2 text-xs font-mono text-[var(--foreground)]"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setClientId(DEFAULT_GOOGLE_CLIENT_ID);
                  saveGoogleClientId(DEFAULT_GOOGLE_CLIENT_ID);
                  onSuccessNotification('Reset to default Client ID');
                }}
                className="text-[11px] text-[var(--muted-text)] hover:text-[var(--accent-lime)] underline"
              >
                Reset Default
              </button>
              <button
                onClick={handleSaveClientId}
                className="px-3 py-1.5 bg-[var(--accent-lime)] text-black font-bold text-xs rounded-lg hover:opacity-90"
              >
                Save Custom Key
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
