import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { radius, space, type as typo, useTheme, type Theme } from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { useAuth } from '../lib/AuthContext';
import { addMeasurement, getMeasurements } from '../lib/db';
import type { Measurement } from '../lib/types';

const MEASUREMENT_KEYS: { key: string; label: string }[] = [
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'chest', label: 'Chest' },
  { key: 'neck', label: 'Neck' },
  { key: 'bicep_l', label: 'Bicep (L)' },
  { key: 'bicep_r', label: 'Bicep (R)' },
  { key: 'thigh_l', label: 'Thigh (L)' },
  { key: 'thigh_r', label: 'Thigh (R)' },
  { key: 'calf_l', label: 'Calf (L)' },
  { key: 'calf_r', label: 'Calf (R)' },
  { key: 'body_fat', label: 'Body fat %' },
];

const BODY_FAT_LABEL =
  MEASUREMENT_KEYS.find((m) => m.key === 'body_fat')?.label ?? 'Body fat %';
const NON_BODY_FAT_KEYS = MEASUREMENT_KEYS.filter((m) => m.key !== 'body_fat');

// Photo placeholder tiles kept intentionally so the photo grid layout
// remains visible before progress photos are wired up.
// TODO: replace with real data from Supabase
const mockPhotos = [
  { id: '1', date: 'May 1' },
  { id: '2', date: 'Apr 15' },
  { id: '3', date: 'Apr 1' },
];

type SheetTarget = {
  key: string;
  label: string;
  current: Measurement | null;
  allowsUnitToggle: boolean;
};

// ── Small helpers ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
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
      {children}
    </Text>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: t.hairline,
        overflow: 'hidden',
        marginHorizontal: space.lg,
      }}
    >
      {children}
    </View>
  );
}

function Separator({ t, inset = 0 }: { t: Theme; inset?: number }) {
  return (
    <View
      style={{
        height: 0.5,
        backgroundColor: t.hairline,
        marginLeft: inset,
      }}
    />
  );
}

const getDaysAgoLabel = (logged_at: string): string => {
  const diff = Date.now() - new Date(logged_at).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Logged today';
  if (days === 1) return 'Logged yesterday';
  return `Last logged ${days} days ago`;
};

const displayMeasurement = (
  m: Measurement,
  unit: 'in' | 'cm',
  key: string,
): string => {
  if (key === 'body_fat') return `${m.value_cm}%`;
  const val =
    unit === 'in' ? (m.value_cm / 2.54).toFixed(1) : m.value_cm.toFixed(1);
  return `${val} ${unit}`;
};

// ── Screen ───────────────────────────────────────────────────────────────────
export default function BodyMeasurements() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const toast = useToast();
  const { user, profile } = useAuth();

  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [inputUnit, setInputUnit] = useState<'in' | 'cm' | '%'>('in');

  const displayUnit: 'in' | 'cm' = profile?.is_metric ? 'cm' : 'in';

  useEffect(() => {
    if (!user) return;
    getMeasurements(user.id)
      .then(setMeasurements)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const getLatestMeasurement = (type: string): Measurement | null => {
    const matching = measurements
      .filter((m) => m.measurement_type === type)
      .sort(
        (a, b) =>
          new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime(),
      );
    return matching[0] ?? null;
  };

  // Reset inputs when target changes
  useEffect(() => {
    if (!target) return;
    if (target.key === 'body_fat') {
      setInputUnit('%');
      setInputValue(target.current ? String(target.current.value_cm) : '');
      return;
    }
    setInputUnit(displayUnit);
    if (target.current) {
      const v =
        displayUnit === 'in'
          ? target.current.value_cm / 2.54
          : target.current.value_cm;
      setInputValue(v.toFixed(1));
    } else {
      setInputValue('');
    }
  }, [target, displayUnit]);

  const openMeasurementSheet = (key: string, label: string) => {
    const current = getLatestMeasurement(key);
    setTarget({ key, label, current, allowsUnitToggle: true });
  };

  const openBodyFatSheet = () => {
    setTarget({
      key: 'body_fat',
      label: BODY_FAT_LABEL,
      current: getLatestMeasurement('body_fat'),
      allowsUnitToggle: false,
    });
  };

  const closeSheet = () => setTarget(null);

  const handleLogMeasurement = async () => {
    if (!user || !target || !inputValue) return;
    setSaving(true);
    try {
      const valueCm =
        target.key === 'body_fat'
          ? Number(inputValue)
          : inputUnit === 'in'
            ? Number(inputValue) * 2.54
            : Number(inputValue);

      await addMeasurement({
        user_id: user.id,
        logged_at: new Date().toISOString(),
        measurement_type: target.key,
        value_cm: valueCm,
      });

      const updated = await getMeasurements(user.id);
      setMeasurements(updated);
      toast.show(`${target.label} logged`, 'success');
      setTarget(null);
    } catch {
      toast.show('Could not save. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleNavyMethod = () => {
    Alert.alert(
      'Navy method',
      'The Navy body fat formula uses your neck, waist, and height measurements to estimate body fat percentage.',
    );
  };

  const handleAddPhoto = () => {
    Alert.alert(
      'Coming soon',
      'Progress photos will be available in a future update.',
    );
  };

  const handleCompare = () => {
    Alert.alert(
      'Coming soon',
      'Photo comparison will be available in a future update.',
    );
  };

  // 48 = 16 margin each side + 8 gap between 3 tiles. Floor so widths
  // are integer pixels and three tiles always fit on a single row.
  const tileSize = Math.floor((screenW - 48) / 3);

  const bodyFatLatest = getLatestMeasurement('body_fat');

  const previousLabel = target?.current
    ? `${displayMeasurement(target.current, displayUnit, target.key)} · ${getDaysAgoLabel(target.current.logged_at)}`
    : null;

  const logDisabled = saving || !inputValue;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.bg }}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
      >
        {/* Top nav */}
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Pressable
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons name="chevron-back" size={24} color={t.primary} />
          </Pressable>
        </View>

        {/* Header */}
        <View
          style={{ paddingHorizontal: space.xl, marginTop: space.md }}
        >
          <Text style={[typo.title2, { color: t.text }]}>
            Body measurements
          </Text>
          <Text
            style={[typo.subhead, { color: t.textSec, marginTop: 2 }]}
          >
            Track your progress beyond the scale.
          </Text>
        </View>

        {/* Current measurements */}
        <SectionLabel>Current measurements</SectionLabel>
        <SectionCard>
          {NON_BODY_FAT_KEYS.map((m, i) => {
            const latest = getLatestMeasurement(m.key);
            const isLast = i === NON_BODY_FAT_KEYS.length - 1;
            return (
              <View key={m.key}>
                <Pressable
                  onPress={() => openMeasurementSheet(m.key, m.label)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: space.lg,
                    paddingVertical: 12,
                    gap: space.sm,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typo.subhead, { color: t.text }]}>
                      {m.label}
                    </Text>
                    <Text
                      style={[
                        typo.caption1,
                        { color: t.textTer, marginTop: 2 },
                      ]}
                    >
                      {latest
                        ? getDaysAgoLabel(latest.logged_at)
                        : loading
                          ? 'Loading…'
                          : 'Never logged'}
                    </Text>
                  </View>
                  {latest ? (
                    <Text style={[typo.subhead, { color: t.text }]}>
                      {displayMeasurement(latest, displayUnit, m.key)}
                    </Text>
                  ) : (
                    <Text style={[typo.subhead, { color: t.textTer }]}>
                      {'--'}
                    </Text>
                  )}
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={t.textTer}
                  />
                </Pressable>
                {!isLast && <Separator t={t} inset={space.lg} />}
              </View>
            );
          })}
        </SectionCard>

        {/* Body fat */}
        <SectionLabel>Body fat</SectionLabel>
        <SectionCard>
          <Pressable
            onPress={openBodyFatSheet}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: space.lg,
              paddingVertical: 12,
              gap: space.sm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typo.subheadEm, { color: t.text }]}>
                Body fat %
              </Text>
              <Text
                style={[
                  typo.caption1,
                  { color: t.textTer, marginTop: 2 },
                ]}
              >
                {bodyFatLatest
                  ? getDaysAgoLabel(bodyFatLatest.logged_at)
                  : loading
                    ? 'Loading…'
                    : 'Never logged'}
              </Text>
            </View>
            {bodyFatLatest ? (
              <Text style={[typo.subheadEm, { color: t.text }]}>
                {`${bodyFatLatest.value_cm}%`}
              </Text>
            ) : (
              <Text style={[typo.subheadEm, { color: t.textTer }]}>
                {'--'}
              </Text>
            )}
            <Ionicons
              name="chevron-forward"
              size={16}
              color={t.textTer}
            />
          </Pressable>
          <Separator t={t} inset={space.lg} />
          <Pressable
            onPress={handleNavyMethod}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: space.lg,
              paddingVertical: 12,
              gap: space.sm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[typo.subhead, { color: t.primary, flex: 1 }]}>
              Estimate via Navy method
            </Text>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={t.primary}
            />
          </Pressable>
        </SectionCard>

        {/* Progress photos */}
        <SectionLabel>Progress photos</SectionLabel>
        <View
          style={{
            paddingHorizontal: space.lg,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Pressable
            onPress={handleAddPhoto}
            style={({ pressed }) => ({
              width: tileSize,
              height: tileSize,
              borderRadius: radius.md,
              overflow: 'hidden',
              borderWidth: 1.5,
              borderColor: `${t.primary}66`,
              borderStyle: 'dashed',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="camera-outline" size={28} color={t.primary} />
            <Text style={[typo.caption2, { color: t.primary }]}>
              Add photo
            </Text>
          </Pressable>
          {mockPhotos.map((p) => (
            <View
              key={p.id}
              style={{
                width: tileSize,
                height: tileSize,
                borderRadius: radius.md,
                overflow: 'hidden',
                backgroundColor: t.surface2,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Ionicons name="image-outline" size={32} color={t.textTer} />
              <Text style={[typo.caption2, { color: t.textTer }]}>
                {p.date}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={handleCompare}
          style={({ pressed }) => ({
            marginHorizontal: space.lg,
            marginTop: space.md,
            backgroundColor: t.surface2,
            borderRadius: radius.lg,
            height: 44,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="images-outline" size={18} color={t.text} />
          <Text style={[typo.subhead, { color: t.text }]}>
            Compare two photos
          </Text>
        </Pressable>
      </ScrollView>

      {/* Log measurement sheet */}
      <Modal
        visible={target !== null}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <Pressable
          onPress={closeSheet}
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
              paddingTop: space.xl,
              paddingBottom: insets.bottom + space.lg,
            }}
          >
            {target && (
              <>
                <Text
                  style={[
                    typo.title3,
                    { color: t.text, textAlign: 'center' },
                  ]}
                >
                  {`Log ${target.label.toLowerCase()}`}
                </Text>

                {/* Input row */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    justifyContent: 'center',
                    marginTop: space.xl,
                  }}
                >
                  <TextInput
                    value={inputValue}
                    onChangeText={setInputValue}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    autoFocus
                    placeholder="0"
                    placeholderTextColor={t.textTer}
                    style={{
                      fontSize: 34,
                      lineHeight: 41,
                      fontWeight: '700',
                      letterSpacing: 0.37,
                      color: t.text,
                      textAlign: 'center',
                      minWidth: 80,
                      padding: 0,
                    }}
                  />
                  <Text
                    style={[
                      typo.title2,
                      { color: t.textSec, marginLeft: space.sm },
                    ]}
                  >
                    {inputUnit}
                  </Text>
                </View>

                {/* Unit toggle */}
                {target.allowsUnitToggle && (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: space.sm,
                      marginTop: space.md,
                    }}
                  >
                    {(['in', 'cm'] as const).map((u) => {
                      const selected = u === inputUnit;
                      return (
                        <Pressable
                          key={u}
                          onPress={() => setInputUnit(u)}
                          style={({ pressed }) => ({
                            backgroundColor: selected
                              ? t.primary
                              : t.surface2,
                            borderRadius: radius.pill,
                            paddingHorizontal: 12,
                            paddingVertical: 4,
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
                          <Text
                            style={[
                              typo.caption1,
                              {
                                color: selected ? t.textOnPrim : t.textSec,
                                fontWeight: '600',
                              },
                            ]}
                          >
                            {u}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {/* Previous label */}
                {previousLabel && (
                  <Text
                    style={[
                      typo.caption1,
                      {
                        color: t.textTer,
                        textAlign: 'center',
                        marginTop: space.md,
                      },
                    ]}
                  >
                    {previousLabel}
                  </Text>
                )}

                {/* Log button */}
                <Pressable
                  onPress={handleLogMeasurement}
                  disabled={logDisabled}
                  style={({ pressed }) => ({
                    marginTop: space.xl,
                    height: 52,
                    borderRadius: radius.lg,
                    backgroundColor: t.teal,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: logDisabled ? 0.4 : pressed ? 0.85 : 1,
                  })}
                >
                  {saving ? (
                    <ActivityIndicator color={t.textOnPrim} />
                  ) : (
                    <Text style={[typo.headline, { color: t.textOnPrim }]}>
                      Log
                    </Text>
                  )}
                </Pressable>

                {/* Cancel */}
                <Pressable
                  hitSlop={6}
                  onPress={closeSheet}
                  style={({ pressed }) => ({
                    alignSelf: 'center',
                    marginTop: space.md,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={[typo.subhead, { color: t.textSec }]}>
                    Cancel
                  </Text>
                </Pressable>
              </>
            )}
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
