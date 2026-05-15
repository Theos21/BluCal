import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, G } from 'react-native-svg';
import { radius, space, type as typo, useTheme } from '../../lib/theme';
import { signOut } from '../../lib/auth';
import { useAuth } from '../../lib/AuthContext';
import {
  calculateMomentumScore,
  getFoodEntriesForDateRange,
  getStreak,
  updateProfile,
} from '../../lib/db';
import { supabase } from '../../lib/supabase';
// HealthKit integration disabled until native linking is fixed via Xcode.
// import { initializeHealthKit, isAvailable } from '../../lib/appleHealth';
import {
  cancelAllNotifications,
  scheduleDailyLogReminder,
  scheduleWeeklySummary,
  scheduleWeighInReminder,
  sendTestNotification,
} from '../../lib/notifications';
import Toast from '../../components/Toast';
import { useToast } from '../../lib/useToast';
import type { Goal, Pace } from '../../lib/types';

const APP_VERSION = '1.0.0';

const GOAL_LABELS: Record<Goal, string> = {
  lose_fat: 'Lose fat',
  build_muscle: 'Build muscle',
  maintain: 'Maintain weight',
  performance: 'Improve performance',
};

const PACE_LABELS: Record<Pace, string> = {
  slow: 'Slow',
  moderate: 'Moderate',
  aggressive: 'Aggressive',
};

function formatHeight(
  heightCm: number | null | undefined,
  isMetric: boolean,
): string {
  if (heightCm === null || heightCm === undefined) return 'Not set';
  if (isMetric) return `${Math.round(heightCm)} cm`;
  const totalInches = heightCm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - ft * 12);
  return `${ft}'${inches}"`;
}

function formatGoalWeight(
  kg: number | null | undefined,
  isMetric: boolean,
): string {
  if (kg === null || kg === undefined) return 'Not set';
  if (isMetric) return `${kg.toFixed(1)} kg`;
  return `${(kg * 2.20462).toFixed(1)} lbs`;
}

function formatBirthday(birthday: string | null | undefined): string {
  if (!birthday) return 'Not set';
  const [year, month, day] = birthday.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatHour12(hour24: number): string {
  const h = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  return `${h}:00 ${period}`;
}

function TimePickerSheet({
  visible,
  title,
  initialHour24,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  initialHour24: number;
  onClose: () => void;
  onSave: (hour24: number) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [hour12, setHour12] = useState(
    initialHour24 % 12 === 0 ? 12 : initialHour24 % 12,
  );
  const [period, setPeriod] = useState<'AM' | 'PM'>(
    initialHour24 >= 12 ? 'PM' : 'AM',
  );

  useEffect(() => {
    if (!visible) return;
    setHour12(initialHour24 % 12 === 0 ? 12 : initialHour24 % 12);
    setPeriod(initialHour24 >= 12 ? 'PM' : 'AM');
  }, [visible, initialHour24]);

  const handleSave = () => {
    const h12 = hour12 % 12; // 12 → 0
    const hour24 = period === 'PM' ? h12 + 12 : h12;
    onSave(hour24);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: t.scrim,
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: t.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: space.xl,
            paddingTop: space.lg,
            paddingBottom: insets.bottom + space.xl,
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: t.surface3,
              }}
            />
          </View>
          <Text
            style={[
              typo.title3,
              { color: t.text, textAlign: 'center', marginTop: space.lg },
            ]}
          >
            {title}
          </Text>

          {/* Hour grid 1-12 */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: space.sm,
              marginTop: space.xl,
              justifyContent: 'center',
            }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
              const sel = h === hour12;
              return (
                <Pressable
                  key={h}
                  onPress={() => setHour12(h)}
                  style={({ pressed }) => ({
                    width: 56,
                    height: 44,
                    borderRadius: radius.md,
                    backgroundColor: sel ? t.primary : t.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={[
                      typo.subheadEm,
                      { color: sel ? t.textOnPrim : t.text },
                    ]}
                  >
                    {h}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* AM / PM */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: t.surface2,
              borderRadius: radius.lg,
              padding: 3,
              marginTop: space.lg,
            }}
          >
            {(['AM', 'PM'] as const).map((p) => {
              const sel = period === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: radius.md,
                    backgroundColor: sel ? t.surface : 'transparent',
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={[
                      typo.subheadEm,
                      { color: sel ? t.text : t.textTer },
                    ]}
                  >
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleSave}
            style={({ pressed }) => ({
              marginTop: space.xl,
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: t.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={[typo.headline, { color: t.textOnPrim }]}>Save</Text>
          </Pressable>
          <Pressable
            hitSlop={6}
            onPress={onClose}
            style={({ pressed }) => ({
              alignSelf: 'center',
              marginTop: space.md,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[typo.subhead, { color: t.textSec }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Reusable rows + sections ─────────────────────────────────────────────────
type SettingsRowProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  valueColor?: string;
  switchValue?: boolean;
  onSwitchChange?: (v: boolean) => void;
  onPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean;
  danger?: boolean;
};

function SettingsRow({
  icon,
  label,
  value,
  valueColor,
  switchValue,
  onSwitchChange,
  onPress,
  showChevron,
  isLast,
  danger,
}: SettingsRowProps) {
  const t = useTheme();
  const isSwitch = typeof switchValue === 'boolean';
  const chevron = showChevron ?? !isSwitch;
  const labelColor = danger ? t.danger : t.text;
  const iconColor = danger ? t.danger : t.textSec;

  return (
    <View>
      <Pressable
        onPress={isSwitch ? undefined : onPress}
        disabled={isSwitch}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: space.lg,
          paddingVertical: 12,
          minHeight: 48,
          opacity: pressed && !isSwitch ? 0.6 : 1,
        })}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={iconColor}
            style={{ marginRight: 12 }}
          />
        )}
        <Text
          style={[typo.subhead, { color: labelColor, flex: 1 }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {value && (
          <Text
            style={[
              typo.subhead,
              { color: valueColor ?? t.textSec, marginLeft: space.sm },
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
        {isSwitch ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: t.surface3, true: t.primary }}
            style={{ marginLeft: space.sm }}
          />
        ) : chevron ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={t.textTer}
            style={{ marginLeft: space.sm }}
          />
        ) : null}
      </Pressable>
      {!isLast && (
        <View
          style={{
            height: 0.5,
            backgroundColor: t.hairline,
            marginLeft: icon ? 48 : space.lg,
          }}
        />
      )}
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  const t = useTheme();
  return (
    <Text
      style={[
        typo.caption2,
        {
          color: t.textTer,
          letterSpacing: 0.06,
          textTransform: 'uppercase',
          fontWeight: '700',
          paddingHorizontal: space.lg,
          paddingTop: space.xl,
          paddingBottom: space.xs,
        },
      ]}
    >
      {label}
    </Text>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.hairline,
        marginHorizontal: space.lg,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

// ── Header + momentum banner ─────────────────────────────────────────────────
function ProgressRing({
  pct,
  size,
  strokeWidth,
  color,
  trackColor,
}: {
  pct: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, pct)) * c;
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} originX={size / 2} originY={size / 2}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </G>
    </Svg>
  );
}

function ProfileHeader({
  name,
  email,
  initials,
}: {
  name: string;
  email: string;
  initials: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingTop: space.xl,
        paddingBottom: space.xl,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: t.teal,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[typo.title2, { color: t.textOnPrim }]}>{initials}</Text>
      </View>
      <Text style={[typo.title2, { color: t.text, marginTop: space.md }]}>
        {name}
      </Text>
      <Text style={[typo.subhead, { color: t.textSec, marginTop: 2 }]}>
        {email}
      </Text>
      <Pressable
        onPress={() => router.push('/edit-profile')}
        style={({ pressed }) => ({
          marginTop: space.md,
          backgroundColor: t.surface2,
          borderRadius: radius.pill,
          paddingHorizontal: 16,
          paddingVertical: 6,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={[typo.footnote, { color: t.text }]}>Edit profile</Text>
      </Pressable>
    </View>
  );
}

function MomentumBanner({
  momentumScore,
  streakDays,
}: {
  momentumScore: number;
  streakDays: number;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.primarySoft,
        borderRadius: radius.lg,
        marginHorizontal: space.lg,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text
            style={[
              typo.caption2,
              {
                color: t.primary,
                letterSpacing: 0.06,
                textTransform: 'uppercase',
                fontWeight: '700',
              },
            ]}
          >
            Momentum
          </Text>
          <Text
            style={[
              typo.title2,
              {
                color: t.primary,
                marginTop: 2,
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            {momentumScore}
          </Text>
        </View>
        <ProgressRing
          pct={momentumScore / 100}
          size={48}
          strokeWidth={4}
          color={t.primary}
          trackColor={t.primarySoft}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: space.sm,
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Ionicons name="flame" size={14} color={t.warn} />
          <Text style={[typo.footnote, { color: t.textSec }]}>
            {`${streakDays} day streak`}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/log-weight')}
          style={({ pressed }) => ({
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.hairline,
            borderRadius: radius.pill,
            paddingHorizontal: 12,
            paddingVertical: 6,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={[typo.footnote, { color: t.text }]}>Log weight</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function Profile() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, profile, refreshProfile } = useAuth();

  const [isMetric, setIsMetric] = useState(false);
  const [streak, setStreak] = useState(0);
  const [momentumScore, setMomentumScore] = useState(0);
  const [, setLoading] = useState(true);
  const [logReminder, setLogReminder] = useState(
    profile?.notif_log_reminder ?? true,
  );
  const [weighInReminder, setWeighInReminder] = useState(
    profile?.notif_weigh_in ?? true,
  );
  const [weeklySummary, setWeeklySummary] = useState(
    profile?.notif_weekly_summary ?? true,
  );
  const [streakAlerts, setStreakAlerts] = useState(
    profile?.notif_streak_alerts ?? false,
  );
  const [timePickerOpen, setTimePickerOpen] = useState<
    'log' | 'weighIn' | null
  >(null);
  const [logReminderHour, setLogReminderHour] = useState(
    profile?.notif_log_reminder_hour ?? 20,
  );
  const [weighInHour, setWeighInHour] = useState(
    profile?.notif_weigh_in_hour ?? 7,
  );
  const [pwdSheetOpen, setPwdSheetOpen] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const provider = user?.app_metadata?.provider;
  const isSocialUser = provider === 'apple' || provider === 'google';

  const handleAddPassword = async () => {
    setPwdError(null);
    if (newPwd.length < 6) {
      setPwdError('Password must be at least 6 characters.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Passwords do not match.');
      return;
    }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast.show('Password added to your account', 'success');
      setPwdSheetOpen(false);
      setNewPwd('');
      setConfirmPwd('');
      setShowPwd(false);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Could not set password.';
      setPwdError(message);
    } finally {
      setSavingPwd(false);
    }
  };

  const handleClosePwdSheet = () => {
    setPwdSheetOpen(false);
    setNewPwd('');
    setConfirmPwd('');
    setShowPwd(false);
    setPwdError(null);
  };

  // Sync toggles whenever the profile's notification fields change (e.g.,
  // after sign-in or a refresh from another device).
  useEffect(() => {
    if (!profile) return;
    setLogReminder(profile.notif_log_reminder ?? true);
    setWeighInReminder(profile.notif_weigh_in ?? true);
    setWeeklySummary(profile.notif_weekly_summary ?? true);
    setStreakAlerts(profile.notif_streak_alerts ?? false);
    setLogReminderHour(profile.notif_log_reminder_hour ?? 20);
    setWeighInHour(profile.notif_weigh_in_hour ?? 7);
  }, [
    profile?.notif_log_reminder,
    profile?.notif_weigh_in,
    profile?.notif_weekly_summary,
    profile?.notif_streak_alerts,
    profile?.notif_log_reminder_hour,
    profile?.notif_weigh_in_hour,
  ]);

  const handleSaveLogReminderTime = async (hour24: number) => {
    setLogReminderHour(hour24);
    setTimePickerOpen(null);
    if (!user) return;
    try {
      await updateProfile(user.id, { notif_log_reminder_hour: hour24 });
      if (logReminder) {
        await cancelAllNotifications();
        await scheduleDailyLogReminder(hour24, 0);
        if (weighInReminder) await scheduleWeighInReminder(weighInHour, 0);
        if (weeklySummary) await scheduleWeeklySummary();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveWeighInTime = async (hour24: number) => {
    setWeighInHour(hour24);
    setTimePickerOpen(null);
    if (!user) return;
    try {
      await updateProfile(user.id, { notif_weigh_in_hour: hour24 });
      if (weighInReminder) {
        await cancelAllNotifications();
        if (logReminder) await scheduleDailyLogReminder(logReminderHour, 0);
        await scheduleWeighInReminder(hour24, 0);
        if (weeklySummary) await scheduleWeeklySummary();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogReminderToggle = async (val: boolean) => {
    setLogReminder(val);
    if (!user) return;
    try {
      await updateProfile(user.id, { notif_log_reminder: val });
      if (val) {
        await scheduleDailyLogReminder(
          profile?.notif_log_reminder_hour ?? 20,
          0,
        );
        await sendTestNotification();
      } else {
        await cancelAllNotifications();
        if (weighInReminder)
          await scheduleWeighInReminder(profile?.notif_weigh_in_hour ?? 7, 0);
        if (weeklySummary) await scheduleWeeklySummary();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleWeighInToggle = async (val: boolean) => {
    setWeighInReminder(val);
    if (!user) return;
    try {
      await updateProfile(user.id, { notif_weigh_in: val });
      if (val) {
        await scheduleWeighInReminder(profile?.notif_weigh_in_hour ?? 7, 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleWeeklySummaryToggle = async (val: boolean) => {
    setWeeklySummary(val);
    if (!user) return;
    try {
      await updateProfile(user.id, { notif_weekly_summary: val });
      if (val) await scheduleWeeklySummary();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStreakAlertsToggle = async (val: boolean) => {
    setStreakAlerts(val);
    if (!user) return;
    try {
      await updateProfile(user.id, { notif_streak_alerts: val });
    } catch (e) {
      console.error(e);
    }
  };

  // Keep the Units toggle in sync with profile.is_metric whenever the auth
  // context refreshes (initial load, post-onboarding, post-update).
  useEffect(() => {
    if (profile) setIsMetric(profile.is_metric);
  }, [profile?.is_metric]);

  const loadProfileData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [currentStreak, score] = await Promise.all([
        getStreak(user.id),
        calculateMomentumScore(user.id, profile?.goal ?? 'maintain'),
      ]);
      setStreak(currentStreak);
      setMomentumScore(score);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadProfileData();
      // loadProfileData reads `user` from closure; re-run when user changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]),
  );

  const handleUnitsToggle = async (val: boolean) => {
    setIsMetric(val);
    if (!user) return;
    try {
      await updateProfile(user.id, { is_metric: val });
      await refreshProfile();
    } catch {
      console.error('Failed to update units preference');
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    try {
      const entries = await getFoodEntriesForDateRange(
        user.id,
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        new Date(),
      );
      const escape = (v: string): string =>
        /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      const csv = [
        'Date,Food,Calories,Protein,Carbs,Fat',
        ...entries.map((e) =>
          [
            new Date(e.logged_at).toLocaleDateString(),
            escape(e.name),
            e.calories,
            e.protein_g,
            e.carbs_g,
            e.fat_g,
          ].join(','),
        ),
      ].join('\n');

      await Share.share({
        message: csv,
        title: 'BluCal Food Log Export',
      });
    } catch {
      toast.show('Could not export data. Try again.', 'error');
    }
  };

  const handleRate = () => {
    void Linking.openURL(
      'https://apps.apple.com/app/id6768892775?action=write-review',
    );
  };

  const handleShareApp = () => {
    void Share.share({
      message:
        'Check out BluCal, a free macro and calorie tracker! https://apps.apple.com/app/id6768892775',
      title: 'BluCal',
    });
  };

  const handlePrivacy = () => {
    void Linking.openURL(
      'https://github.com/Theos21/BluCal/blob/main/PRIVACY.md',
    );
  };

  const handleTOS = () => {
    void Linking.openURL(
      'https://github.com/Theos21/BluCal/blob/main/PRIVACY.md',
    );
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete all data?',
      'This permanently removes every entry, weight log, and setting. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive' },
      ],
    );
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/welcome');
    } catch {
      Alert.alert('Error', 'Could not sign out. Please try again.');
    }
  };

  const handleDeleteAccount = () => {
    if (!user) return;
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('food_entries').delete().eq('user_id', user.id);
              await supabase.from('weight_entries').delete().eq('user_id', user.id);
              await supabase.from('water_entries').delete().eq('user_id', user.id);
              await supabase.from('macro_targets').delete().eq('user_id', user.id);
              await supabase.from('feeling_entries').delete().eq('user_id', user.id);
              await supabase.from('measurements').delete().eq('user_id', user.id);
              await supabase.from('planned_meals').delete().eq('user_id', user.id);
              await supabase.from('recipes').delete().eq('user_id', user.id);
              await supabase.from('custom_foods').delete().eq('user_id', user.id);
              await supabase.from('profiles').delete().eq('id', user.id);
              await supabase.auth.signOut();
              router.replace('/(auth)/welcome');
            } catch {
              Alert.alert(
                'Error',
                'Could not delete account. Please contact support@blucal.app',
              );
            }
          },
        },
      ],
    );
  };

  const displayName = profile?.name ?? 'Your Name';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const email = profile?.email ?? user?.email ?? '';

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.bg }}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
      >
        <ProfileHeader name={displayName} email={email} initials={initials} />
        <MomentumBanner momentumScore={momentumScore} streakDays={streak} />

        {/* Profile */}
        <SectionLabel label="Profile" />
        <Section>
          <SettingsRow
            label="Name"
            value={profile?.name ?? 'Not set'}
            onPress={() => router.push('/edit-profile')}
          />
          <SettingsRow
            label="Birthday"
            value={formatBirthday(profile?.birthday)}
            onPress={() => router.push('/edit-profile')}
          />
          <SettingsRow
            label="Biological sex"
            value={profile?.biological_sex ?? 'Not set'}
            onPress={() => router.push('/edit-profile')}
          />
          <SettingsRow
            label="Height"
            value={formatHeight(profile?.height_cm, isMetric)}
            onPress={() => router.push('/edit-profile')}
          />
          {isSocialUser && (
            <SettingsRow
              icon="key-outline"
              label="Add password"
              onPress={() => setPwdSheetOpen(true)}
            />
          )}
          <SettingsRow
            label="Units"
            value={isMetric ? 'Metric' : 'Imperial'}
            switchValue={isMetric}
            onSwitchChange={handleUnitsToggle}
            isLast
          />
        </Section>

        {/* Goals */}
        <SectionLabel label="Goals" />
        <Section>
          <SettingsRow
            label="Current goal"
            value={profile?.goal ? GOAL_LABELS[profile.goal] : 'Not set'}
            onPress={() => router.push('/edit-goals')}
          />
          <SettingsRow
            label="Goal weight"
            value={formatGoalWeight(profile?.goal_weight_kg, isMetric)}
            onPress={() => router.push('/edit-goals')}
          />
          <SettingsRow
            label="Weekly pace"
            value={profile?.pace ? PACE_LABELS[profile.pace] : 'Not set'}
            onPress={() => router.push('/edit-goals')}
          />
          <SettingsRow
            icon="body-outline"
            label="Body measurements"
            onPress={() => router.push('/body-measurements')}
          />
          <SettingsRow
            icon="camera-outline"
            label="Progress Photos"
            value="View and compare"
            onPress={() => router.push('/body-measurements')}
          />
          <SettingsRow
            label="Edit macro targets"
            onPress={() => router.push('/edit-macros')}
            isLast
          />
        </Section>

        {/* Notifications */}
        <SectionLabel label="Notifications" />
        <Section>
          <SettingsRow
            label="Daily log reminder"
            switchValue={logReminder}
            onSwitchChange={handleLogReminderToggle}
          />
          {logReminder && (
            <SettingsRow
              label="Reminder time"
              value={formatHour12(logReminderHour)}
              onPress={() => setTimePickerOpen('log')}
            />
          )}
          <SettingsRow
            label="Weigh-in reminder"
            switchValue={weighInReminder}
            onSwitchChange={handleWeighInToggle}
          />
          {weighInReminder && (
            <SettingsRow
              label="Reminder time"
              value={formatHour12(weighInHour)}
              onPress={() => setTimePickerOpen('weighIn')}
            />
          )}
          <SettingsRow
            label="Weekly coach summary"
            switchValue={weeklySummary}
            onSwitchChange={handleWeeklySummaryToggle}
          />
          <SettingsRow
            label="Streak alerts"
            switchValue={streakAlerts}
            onSwitchChange={handleStreakAlertsToggle}
            isLast
          />
        </Section>

        {/* Integrations */}
        <SectionLabel label="Integrations" />
        <Section>
          {/* TODO: Re-enable Apple Health when HealthKit linking is fixed via Xcode */}
          <SettingsRow
            icon="watch-outline"
            label="Apple Watch"
            value="Coming soon"
            valueColor={t.textTer}
            isLast
          />
        </Section>

        {/* TODO: Accountability partner — re-enable when real invite system is built */}
        {/* <SectionLabel label="Accountability" />
        <Section>
          <SettingsRow
            label="Accountability partner"
            value="Not connected"
            onPress={() => router.push('/partner')}
            isLast
          />
        </Section> */}

        {/* Data */}
        <SectionLabel label="Data" />
        <Section>
          <SettingsRow
            icon="download-outline"
            label="Export my data"
            onPress={handleExportData}
          />
          <SettingsRow
            icon="trash-outline"
            label="Delete all data"
            danger
            onPress={handleDeleteAll}
            isLast
          />
        </Section>

        {/* About */}
        <SectionLabel label="About" />
        <Section>
          <SettingsRow
            icon="star-outline"
            label="Rate BluCal"
            onPress={handleRate}
          />
          <SettingsRow
            icon="share-outline"
            label="Share BluCal"
            onPress={handleShareApp}
          />
          <SettingsRow
            icon="document-outline"
            label="Privacy policy"
            onPress={handlePrivacy}
          />
          <SettingsRow
            icon="document-outline"
            label="Terms of service"
            onPress={handleTOS}
            isLast
          />
        </Section>

        {/* Account */}
        <SectionLabel label="Account" />
        <Section>
          <SettingsRow
            icon="trash-outline"
            label="Delete account"
            value="Permanently delete all data"
            valueColor={t.danger}
            danger
            onPress={handleDeleteAccount}
            isLast
          />
        </Section>

        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => ({
            marginHorizontal: space.lg,
            marginTop: space.xl,
            height: 48,
            borderRadius: radius.lg,
            backgroundColor: t.dangerSoft,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="log-out-outline" size={18} color={t.danger} />
          <Text style={[typo.subheadEm, { color: t.danger }]}>Sign out</Text>
        </Pressable>

        <Text
          style={[
            typo.caption1,
            {
              color: t.textTer,
              textAlign: 'center',
              marginTop: space.xl,
            },
          ]}
        >
          {`BluCal v${APP_VERSION}`}
        </Text>
      </ScrollView>

      <TimePickerSheet
        visible={timePickerOpen === 'log'}
        title="Daily log reminder"
        initialHour24={logReminderHour}
        onClose={() => setTimePickerOpen(null)}
        onSave={handleSaveLogReminderTime}
      />
      <TimePickerSheet
        visible={timePickerOpen === 'weighIn'}
        title="Weigh-in reminder"
        initialHour24={weighInHour}
        onClose={() => setTimePickerOpen(null)}
        onSave={handleSaveWeighInTime}
      />

      <Modal
        visible={pwdSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={handleClosePwdSheet}
      >
        <Pressable
          onPress={handleClosePwdSheet}
          style={{
            flex: 1,
            backgroundColor: t.scrim,
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: t.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingHorizontal: space.xl,
              paddingTop: space.lg,
              paddingBottom: insets.bottom + space.xl,
            }}
          >
            <View style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: radius.pill,
                  backgroundColor: t.surface3,
                }}
              />
            </View>
            <Text
              style={[
                typo.title3,
                { color: t.text, textAlign: 'center', marginTop: space.lg },
              ]}
            >
              Add password
            </Text>
            <Text
              style={[
                typo.subhead,
                {
                  color: t.textSec,
                  textAlign: 'center',
                  marginTop: space.xs,
                },
              ]}
            >
              Set a password so you can also sign in with email.
            </Text>

            <View style={{ marginTop: space.xl, gap: space.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: t.surface2,
                  borderRadius: radius.md,
                  paddingHorizontal: 14,
                }}
              >
                <TextInput
                  value={newPwd}
                  onChangeText={setNewPwd}
                  placeholder="New password"
                  placeholderTextColor={t.textTer}
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  style={[
                    typo.body,
                    { flex: 1, color: t.text, paddingVertical: 12 },
                  ]}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() => setShowPwd((v) => !v)}
                  style={({ pressed }) => ({
                    padding: 4,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Ionicons
                    name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={t.textSec}
                  />
                </Pressable>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: t.surface2,
                  borderRadius: radius.md,
                  paddingHorizontal: 14,
                }}
              >
                <TextInput
                  value={confirmPwd}
                  onChangeText={setConfirmPwd}
                  placeholder="Confirm password"
                  placeholderTextColor={t.textTer}
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  style={[
                    typo.body,
                    { flex: 1, color: t.text, paddingVertical: 12 },
                  ]}
                />
              </View>
            </View>

            {pwdError && (
              <Text
                style={[
                  typo.footnote,
                  {
                    color: t.danger,
                    marginTop: space.md,
                    textAlign: 'center',
                  },
                ]}
              >
                {pwdError}
              </Text>
            )}

            <Pressable
              onPress={handleAddPassword}
              disabled={savingPwd || !newPwd || !confirmPwd}
              style={({ pressed }) => ({
                marginTop: space.xl,
                height: 52,
                borderRadius: radius.lg,
                backgroundColor: t.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity:
                  savingPwd || !newPwd || !confirmPwd
                    ? 0.4
                    : pressed
                      ? 0.85
                      : 1,
              })}
            >
              {savingPwd ? (
                <ActivityIndicator color={t.textOnPrim} />
              ) : (
                <Text style={[typo.headline, { color: t.textOnPrim }]}>
                  Save
                </Text>
              )}
            </Pressable>
            <Pressable
              hitSlop={6}
              onPress={handleClosePwdSheet}
              style={({ pressed }) => ({
                alignSelf: 'center',
                marginTop: space.md,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[typo.subhead, { color: t.textSec }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Toast
        message={toast.message}
        visible={toast.visible}
        type={toast.type}
        duration={toast.duration}
        onHide={toast.hide}
      />
    </SafeAreaView>
  );
}
