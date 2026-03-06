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
const onVisible = () => {
  // Restart the auto-refresh timer — it will refresh the token before it expires.
  // Do NOT call refreshSession() explicitly here: on page load the window focus event
  // fires at the same time as boot()'s getSession(), and the Supabase client serialises
  // concurrent refresh calls, doubling the latency (~9 s instead of ~4 s).
  supabase.auth.startAutoRefresh();

  // Reconnect realtime websocket if it was dropped
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
