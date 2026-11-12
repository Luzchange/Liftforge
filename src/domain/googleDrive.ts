import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { exportDatabaseToJson, importDatabaseFromJson } from './portability';

// Google Drive configuration constants & storage keys
const GOOGLE_CLIENT_ID_STORAGE_KEY = 'liftforge_gdrive_client_id';
const GOOGLE_ACCESS_TOKEN_STORAGE_KEY = 'liftforge_gdrive_token';
const GOOGLE_TOKEN_EXPIRY_KEY = 'liftforge_gdrive_token_expiry';
const GOOGLE_USER_EMAIL_KEY = 'liftforge_gdrive_email';

export interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

export function getStoredGoogleClientId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY) || '';
}

export function saveGoogleClientId(clientId: string): void {
  if (typeof window === 'undefined') return;
  if (clientId.trim()) {
    localStorage.setItem(GOOGLE_CLIENT_ID_STORAGE_KEY, clientId.trim());
  } else {
    localStorage.removeItem(GOOGLE_CLIENT_ID_STORAGE_KEY);
  }
}

export function getStoredGoogleUser(): { email: string | null; isLoggedIn: boolean } {
  if (typeof window === 'undefined') return { email: null, isLoggedIn: false };
  const token = localStorage.getItem(GOOGLE_ACCESS_TOKEN_STORAGE_KEY);
  const expiry = parseInt(localStorage.getItem(GOOGLE_TOKEN_EXPIRY_KEY) || '0', 10);
  const email = localStorage.getItem(GOOGLE_USER_EMAIL_KEY);
  const isValid = !!token && Date.now() < expiry;
  return { email: isValid ? email : null, isLoggedIn: isValid };
}

export function disconnectGoogleDrive(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GOOGLE_ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(GOOGLE_TOKEN_EXPIRY_KEY);
  localStorage.removeItem(GOOGLE_USER_EMAIL_KEY);
}

/**
 * Loads the Google Identity Services script if not already present.
 */
export async function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return;
  if ((window as any).google?.accounts?.oauth2) return;

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

/**
 * Requests an OAuth 2.0 access token via Google Identity Services popup.
 */
export async function authenticateWithGoogle(clientId: string): Promise<string> {
  await loadGsiScript();

  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    throw new Error('Google Identity Services SDK failed to load.');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }

          const accessToken = tokenResponse.access_token;
          const expiresIn = parseInt(tokenResponse.expires_in, 10) || 3600;
          const expiryTime = Date.now() + expiresIn * 1000 - 60000;

          localStorage.setItem(GOOGLE_ACCESS_TOKEN_STORAGE_KEY, accessToken);
          localStorage.setItem(GOOGLE_TOKEN_EXPIRY_KEY, expiryTime.toString());

          // Fetch user info for UI confirmation
          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (userInfoRes.ok) {
              const info = await userInfoRes.json();
              if (info.email) {
                localStorage.setItem(GOOGLE_USER_EMAIL_KEY, info.email);
              }
            }
          } catch {
            // Ignore userInfo fetch failure
          }

          resolve(accessToken);
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || 'Google OAuth prompt was closed or blocked'));
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

async function getValidAccessToken(clientId?: string): Promise<string> {
  const token = localStorage.getItem(GOOGLE_ACCESS_TOKEN_STORAGE_KEY);
  const expiry = parseInt(localStorage.getItem(GOOGLE_TOKEN_EXPIRY_KEY) || '0', 10);

  if (token && Date.now() < expiry) {
    return token;
  }

  const activeClientId = clientId || getStoredGoogleClientId();
  if (!activeClientId) {
    throw new Error('Google Cloud OAuth Client ID is required to connect to Google Drive.');
  }

  return await authenticateWithGoogle(activeClientId);
}

/**
 * Uploads a LiftForge JSON backup directly to the user's Google Drive via REST API.
 */
export async function uploadBackupToGoogleDrive(clientId?: string): Promise<{ fileId: string; fileName: string }> {
  const token = await getValidAccessToken(clientId);
  const backupJson = await exportDatabaseToJson();
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `liftforge-backup-${dateStr}.json`;

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: 'LiftForge Workout & Progression Backup',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([backupJson], { type: 'application/json' }));

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    if (res.status === 401) {
      disconnectGoogleDrive();
      throw new Error('Google Drive authorization expired. Please sign in again.');
    }
    throw new Error(errorBody.error?.message || `Google Drive upload failed (${res.status})`);
  }

  const data = await res.json();
  return { fileId: data.id, fileName };
}

/**
 * Lists available LiftForge backup files in the user's Google Drive.
 */
export async function listGoogleDriveBackups(clientId?: string): Promise<GoogleDriveFile[]> {
  const token = await getValidAccessToken(clientId);

  const query = "name contains 'liftforge-backup' and mimeType = 'application/json' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size)&pageSize=20`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) {
      disconnectGoogleDrive();
      throw new Error('Google Drive authorization expired. Please reconnect.');
    }
    throw new Error('Failed to retrieve backup files from Google Drive.');
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Restores local database from a specific Google Drive backup file.
 */
export async function restoreFromGoogleDriveBackup(
  fileId: string,
  mode: 'replace' | 'merge' = 'replace'
): Promise<{ success: boolean; message: string }> {
  const token = await getValidAccessToken();

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error('Failed to download backup file from Google Drive.');
  }

  const jsonContent = await res.text();
  return await importDatabaseFromJson(jsonContent, mode);
}

/**
 * Universal Mobile & Native Drive Share.
 * On Android/Capacitor, writes the backup to a temporary cache file and invokes the native Android Share Sheet,
 * allowing the user to select the official Google Drive app ("Save to Drive") without needing API keys.
 * On desktop browsers, offers the native Web Share API with file attachment or fallback download.
 */
export async function backupViaSystemShareToDrive(): Promise<{ shared: boolean; message: string }> {
  const backupJson = await exportDatabaseToJson();
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `liftforge-backup-${dateStr}.json`;

  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Write to device Cache directory using Capacitor Filesystem
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: backupJson,
        directory: Directory.Cache,
      });

      // 2. Open Android Native Share Sheet
      await Share.share({
        title: 'Save to Google Drive / Share Backup',
        text: 'LiftForge Workout Database Backup',
        dialogTitle: 'Save to Google Drive or Share',
        files: [savedFile.uri],
      });

      return {
        shared: true,
        message: 'System share sheet opened. Select "Save to Drive" or your preferred cloud destination.',
      };
    } catch (e: any) {
      if (e?.message?.includes('canceled') || e?.message?.includes('dismissed')) {
        return { shared: false, message: 'Share dismissed.' };
      }
      throw new Error(`Native share failed: ${e.message}`);
    }
  }

  // Web fallback: Check if browser supports Web Share API with files
  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      const file = new File([backupJson], fileName, { type: 'application/json' });
      if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({
          title: 'LiftForge Backup',
          text: 'LiftForge Workout Database Backup (Save to Google Drive)',
          files: [file],
        });
        return {
          shared: true,
          message: 'Web share sheet opened. Choose Google Drive or destination.',
        };
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return { shared: false, message: 'Share dismissed.' };
      }
    }
  }

  // Fallback: Trigger instant file download
  const blob = new Blob([backupJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  return {
    shared: true,
    message: 'Backup downloaded. You can upload it to Google Drive manually.',
  };
}
