import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getProfile } from './db';
import {
  cancelAllNotifications,
  registerForPushNotifications,
  scheduleDailyLogReminder,
  scheduleWeeklySummary,
  scheduleWeighInReminder,
} from './notifications';
import type { Profile } from './types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null | undefined;
  /**
   * True once the cached session has been read from AsyncStorage. Routing
   * keys off this flag — it intentionally does NOT wait for the profile
   * network request, which resolves separately in the background.
   */
  isReady: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: undefined,
  isReady: false,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);

  const refreshProfile = async () => {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    if (s?.user) {
      const p = await getProfile(s.user.id);
      setProfile(p);
    }
  };

  useEffect(() => {
    let mounted = true;

    const rescheduleNotifications = async (p: Profile): Promise<void> => {
      try {
        await cancelAllNotifications();
        if (p.notif_log_reminder ?? true) {
          await scheduleDailyLogReminder(p.notif_log_reminder_hour ?? 20, 0);
        }
        if (p.notif_weigh_in ?? true) {
          await scheduleWeighInReminder(p.notif_weigh_in_hour ?? 7, 0);
        }
        if (p.notif_weekly_summary ?? true) {
          await scheduleWeeklySummary();
        }
      } catch (e) {
        console.error('Failed to reschedule notifications', e);
      }
    };

    // Loads the profile in the background. This is never awaited on the
    // routing path, so a cold start can render as soon as the cached session
    // resolves rather than blocking on this network request.
    const loadProfile = async (
      userId: string,
      reschedule: boolean,
    ): Promise<void> => {
      try {
        const p = await getProfile(userId);
        if (!mounted) return;
        setProfile(p);
        if (p && reschedule) await rescheduleNotifications(p);
      } catch {
        if (mounted) setProfile(null);
      }
    };

    // Cold-start path. getSession() resolves the persisted session straight
    // from AsyncStorage with no network round-trip, so auth state is known
    // almost immediately. The profile request is fired off WITHOUT awaiting
    // it, and isReady flips as soon as the cached session is in hand — the
    // app can route now while the profile fills in a moment later.
    void (async () => {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        void loadProfile(s.user.id, true);
        // Fire-and-forget push token registration; never block startup.
        registerForPushNotifications(s.user.id).catch(console.error);
      } else {
        setProfile(null);
      }
      setIsReady(true);
    })();

    // Subsequent auth changes. INITIAL_SESSION duplicates the cold-start path
    // above so it is ignored. SIGNED_IN refetches the profile and reschedules
    // notifications; TOKEN_REFRESHED / USER_UPDATED only rotate the session
    // token and leave the profile in place to avoid a spurious spinner.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'INITIAL_SESSION' || !mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (event === 'SIGNED_IN' && s?.user) {
        setProfile(undefined);
        void loadProfile(s.user.id, true);
        registerForPushNotifications(s.user.id).catch(console.error);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
      setIsReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, user, profile, isReady, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
