import type { Connection } from './api';

const KEY = 'pharmacy-connection';

function parseConnection(raw: string | null): Connection | null {
  if (!raw) return null;
  try {
    const config = JSON.parse(raw);
    if (typeof config.url !== 'string' || typeof config.token !== 'string' || config.token.length < 32) return null;
    const url = new URL(config.url);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash) return null;
    return { url: url.toString().replace(/\/$/, ''), token: config.token };
  } catch { return null; }
}

export function rememberConnection(config: Connection) {
  // Save first: if storage is unavailable, the settings form can report it honestly.
  window.localStorage.setItem(KEY, JSON.stringify(config));
  window.sessionStorage.removeItem(KEY);
}

export function restoreConnection(): Connection | null {
  try {
    const saved = parseConnection(window.localStorage.getItem(KEY));
    if (saved) return saved;
    // Carry forward an already connected tab without asking for its token again.
    const legacy = parseConnection(window.sessionStorage.getItem(KEY));
    if (legacy) {
      try { rememberConnection(legacy); } catch { /* Keep this session usable if persistent storage is blocked. */ }
      return legacy;
    }
  } catch { /* Storage restrictions must not prevent the app from opening. */ }
  return null;
}

export function forgetConnection() {
  window.localStorage.removeItem(KEY);
  window.sessionStorage.removeItem(KEY);
}
