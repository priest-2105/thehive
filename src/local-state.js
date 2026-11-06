import { deriveTournament } from './tournament.js';
import { freshTimer, timerSnapshot } from './timer.js';

export const storageKeys = {
  results: 'thehive-results-v1',
  timer: 'thehive-timer-v1',
  password: 'thehive-admin-password-v1',
  session: 'thehive-admin-session-v1'
};

export function readResults(storage) {
  try { return deriveTournament(JSON.parse(storage.getItem(storageKeys.results) || '{}')).results; }
  catch { return {}; }
}

export function readTimer(storage, now = Date.now()) {
  try {
    const saved = JSON.parse(storage.getItem(storageKeys.timer));
    if (saved && ['first', 'break', 'second'].includes(saved.phase) && ['ready', 'running', 'paused', 'finished'].includes(saved.status) && Number.isFinite(saved.remainingMs) && (saved.status !== 'running' || Number.isFinite(saved.deadline))) {
      return { ...timerSnapshot(saved, now), syncedAt: now };
    }
  } catch { /* A damaged browser save should not stop the clock screen. */ }
  return { ...freshTimer(), syncedAt: now };
}

export function saveResults(storage, results) { storage.setItem(storageKeys.results, JSON.stringify(results)); }
export function saveTimer(storage, timer) { storage.setItem(storageKeys.timer, JSON.stringify(timer)); }

export async function passwordHash(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
