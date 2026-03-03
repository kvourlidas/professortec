import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'pt_web_auth_v1',
  },
  realtime: {
    params: {
      // helps when network flaps / tab sleeps
      eventsPerSecond: 10,
    },
  },
});

/**
 * Keep auth refresh and realtime healthy when tab sleeps/wakes.
 * IMPORTANT: do this once (module scope is OK).
 */
const onVisible = async () => {
  // restart refresh loop
  supabase.auth.startAutoRefresh();

  // refresh token if needed (fast no-op if still valid)
  try {
    await supabase.auth.refreshSession();
  } catch (e) {
    console.warn('refreshSession failed on visible', e);
  }

  // reconnect realtime websocket if it was dropped
  try {
    supabase.realtime.connect();
  } catch (e) {
    console.warn('realtime connect failed', e);
  }
};

const onHidden = () => {
  // avoid running refresh timers in background
  supabase.auth.stopAutoRefresh();
  // optional: you may keep realtime connected, but this reduces issues on some browsers
  try {
    supabase.realtime.disconnect();
  } catch {
    // ignore
  }
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') onVisible();
  else onHidden();
});

// Also handle real focus (user alt-tabs back)
window.addEventListener('focus', () => {
  if (document.visibilityState === 'visible') onVisible();
});

// When connection returns, refresh + reconnect
window.addEventListener('online', () => {
  if (document.visibilityState === 'visible') onVisible();
});
