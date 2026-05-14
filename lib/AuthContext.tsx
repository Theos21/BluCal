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
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: undefined,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user) {
      const p = await getProfile(s.user.id);
      setProfile(p);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        try {
          const p = await getProfile(s.user.id);
          setProfile(p);
          // Reschedule local notifications from saved preferences on the
          // initial session and on explicit sign-in only — skipping
          // TOKEN_REFRESHED (fires hourly) and USER_UPDATED keeps us from
          // churning the OS scheduler.
          if (p && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
            try {
              await cancelAllNotifications();
              if (p.notif_log_reminder ?? true) {
                await scheduleDailyLogReminder(
                  p.notif_log_reminder_hour ?? 20,
                  0,
                );
              }
              if (p.notif_weigh_in ?? true) {
                await scheduleWeighInReminder(
                  p.notif_weigh_in_hour ?? 7,
                  0,
                );
              }
              if (p.notif_weekly_summary ?? true) {
                await scheduleWeeklySummary();
              }
            } catch (e) {
              console.error('Failed to reschedule notifications', e);
            }
          }
        } catch {
          setProfile(null);
        }
        // Fire-and-forget push token registration; never block sign-in.
        registerForPushNotifications(s.user.id).catch(console.error);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
