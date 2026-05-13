import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, G } from 'react-native-svg';
import { radius, space, type as typo, useTheme } from '../../lib/theme';
import { signOut } from '../../lib/auth';
import { useAuth } from '../../lib/AuthContext';
import { getStreak, updateProfile } from '../../lib/db';
import { isAvailable, requestPermissions } from '../../lib/appleHealth';
import {
  cancelAllNotifications,
  scheduleDailyLogReminder,
  scheduleWeeklySummary,
  scheduleWeighInReminder,
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
  const toast = useToast();
  const { user, profile, refreshProfile } = useAuth();

  const [isMetric, setIsMetric] = useState(false);
  const [streak, setStreak] = useState(0);
  const [, setLoading] = useState(true);
  const [logReminder, setLogReminder] = useState(false);
  const [weighInReminder, setWeighInReminder] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState(false);
  const [streakAlerts, setStreakAlerts] = useState(false);

  const handleLogReminderToggle = async (val: boolean) => {
    setLogReminder(val);
    try {
      if (val) {
        await scheduleDailyLogReminder(20, 0);
      } else {
        await cancelAllNotifications();
        if (weighInReminder) await scheduleWeighInReminder(7, 0);
        if (weeklySummary) await scheduleWeeklySummary();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleWeighInToggle = async (val: boolean) => {
    setWeighInReminder(val);
    try {
      if (val) await scheduleWeighInReminder(7, 0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleWeeklySummaryToggle = async (val: boolean) => {
    setWeeklySummary(val);
    try {
      if (val) await scheduleWeeklySummary();
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
      const currentStreak = await getStreak(user.id);
      setStreak(currentStreak);
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

  const handleAppleHealth = async () => {
    try {
      const available = await isAvailable();
      if (!available) {
        Alert.alert(
          'Apple Health',
          'Apple Health is not available on this device.',
        );
        return;
      }
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          'Permission denied',
          'You can enable Apple Health access in your iPhone Settings.',
        );
        return;
      }
      if (user) {
        await updateProfile(user.id, { apple_health_connected: true });
        await refreshProfile();
      }
      toast.show('Apple Health connected', 'success');
    } catch {
      Alert.alert('Error', 'Could not connect to Apple Health.');
    }
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
        <MomentumBanner momentumScore={0} streakDays={streak} />

        {/* Profile */}
        <SectionLabel label="Profile" />
        <Section>
          <SettingsRow label="Name" value={profile?.name ?? 'Not set'} />
          <SettingsRow
            label="Birthday"
            value={profile?.birthday ?? 'Not set'}
          />
          <SettingsRow
            label="Biological sex"
            value={profile?.biological_sex ?? 'Not set'}
          />
          <SettingsRow
            label="Height"
            value={formatHeight(profile?.height_cm, isMetric)}
          />
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
          />
          <SettingsRow
            label="Goal weight"
            value={formatGoalWeight(profile?.goal_weight_kg, isMetric)}
          />
          <SettingsRow
            label="Weekly pace"
            value={profile?.pace ? PACE_LABELS[profile.pace] : 'Not set'}
          />
          <SettingsRow
            icon="body-outline"
            label="Body measurements"
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
          <SettingsRow
            label="Weigh-in reminder"
            switchValue={weighInReminder}
            onSwitchChange={handleWeighInToggle}
          />
          <SettingsRow
            label="Weekly coach summary"
            switchValue={weeklySummary}
            onSwitchChange={handleWeeklySummaryToggle}
          />
          <SettingsRow
            label="Streak alerts"
            switchValue={streakAlerts}
            onSwitchChange={setStreakAlerts}
            isLast
          />
        </Section>

        {/* Integrations */}
        <SectionLabel label="Integrations" />
        <Section>
          <SettingsRow
            icon="heart-outline"
            label="Apple Health"
            value={profile?.apple_health_connected ? 'Connected' : 'Not connected'}
            valueColor={profile?.apple_health_connected ? t.success : undefined}
            onPress={handleAppleHealth}
          />
          <SettingsRow
            icon="speedometer-outline"
            label="Connected scale"
            value="Not connected"
            isLast
          />
        </Section>

        {/* Accountability */}
        <SectionLabel label="Accountability" />
        <Section>
          <SettingsRow
            label="Accountability partner"
            value="Not connected"
            onPress={() => router.push('/partner')}
            isLast
          />
        </Section>

        {/* Data */}
        <SectionLabel label="Data" />
        <Section>
          <SettingsRow
            icon="download-outline"
            label="Export my data"
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
          <SettingsRow icon="star-outline" label="Rate BluCal" />
          <SettingsRow icon="share-outline" label="Share BluCal" />
          <SettingsRow icon="document-outline" label="Privacy policy" />
          <SettingsRow
            icon="document-outline"
            label="Terms of service"
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
