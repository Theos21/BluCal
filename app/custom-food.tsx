import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { radius, space, type as typo, useTheme, type Theme } from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { useAuth } from '../lib/AuthContext';
import { addCustomFood, updateCustomFood } from '../lib/db';
import { scanNutritionLabel } from '../lib/bluai';
import { sessionState } from '../lib/sessionState';

const UNITS = ['g', 'oz', 'ml', 'cup', 'tbsp', 'tsp', 'piece', 'serving'] as const;

const PROTEIN_KCAL = 4;
const CARBS_KCAL = 4;
const FAT_KCAL = 9;

function safeNum(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function shake(anim: Animated.Value) {
  Animated.sequence([
    Animated.timing(anim, { toValue: 8, duration: 50, useNativeDriver: true }),
    Animated.timing(anim, { toValue: -8, duration: 50, useNativeDriver: true }),
    Animated.timing(anim, { toValue: 8, duration: 50, useNativeDriver: true }),
    Animated.timing(anim, { toValue: -8, duration: 50, useNativeDriver: true }),
    Animated.timing(anim, { toValue: 8, duration: 50, useNativeDriver: true }),
    Animated.timing(anim, { toValue: 0, duration: 50, useNativeDriver: true }),
  ]).start();
}

// ── Small helpers ────────────────────────────────────────────────────────────
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
        marginTop: space.md,
      }}
    >
      {children}
    </View>
  );
}

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
          marginHorizontal: space.lg,
        },
      ]}
    >
      {children}
    </Text>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function CustomFood() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user } = useAuth();

  const params = useLocalSearchParams<{
    fromLabelScan?: string;
    editId?: string;
    prefillName?: string;
    prefillBrand?: string;
    prefillBarcode?: string;
    prefillServingSize?: string;
    prefillServingUnit?: string;
    prefillCal?: string;
    prefillProtein?: string;
    prefillCarbs?: string;
    prefillFat?: string;
    prefillFiber?: string;
    prefillSugar?: string;
    prefillSodium?: string;
    prefillSatFat?: string;
    prefillCholesterol?: string;
    isShared?: string;
  }>();
  const param = (v: string | undefined): string =>
    typeof v === 'string' ? v : '';
  const fromLabelScan = param(params.fromLabelScan) === '1';
  const isEditing = !!params.editId;

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(param(params.prefillName));
  const [brand, setBrand] = useState(param(params.prefillBrand));
  const [barcode, setBarcode] = useState(param(params.prefillBarcode));
  const [servingSize, setServingSize] = useState(
    param(params.prefillServingSize) || '1',
  );
  const [unitIdx, setUnitIdx] = useState(() => {
    const i = UNITS.findIndex((u) => u === param(params.prefillServingUnit));
    return i >= 0 ? i : 0;
  });

  const [cal, setCal] = useState(param(params.prefillCal));
  const [protein, setProtein] = useState(param(params.prefillProtein));
  const [carbs, setCarbs] = useState(param(params.prefillCarbs));
  const [fat, setFat] = useState(param(params.prefillFat));

  const [extendedOpen, setExtendedOpen] = useState(false);
  const [fiber, setFiber] = useState(param(params.prefillFiber));
  const [sugar, setSugar] = useState(param(params.prefillSugar));
  const [sodium, setSodium] = useState(param(params.prefillSodium));
  const [satFat, setSatFat] = useState(param(params.prefillSatFat));
  const [cholesterol, setCholesterol] = useState(
    param(params.prefillCholesterol),
  );

  const [shareCommunity, setShareCommunity] = useState(
    param(params.isShared) === '1',
  );
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [scanningLabel, setScanningLabel] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const nameShake = useRef(new Animated.Value(0)).current;
  const calShake = useRef(new Animated.Value(0)).current;

  const nameValid = name.trim().length > 0;
  const calOrProteinValid = cal.length > 0 || protein.length > 0;
  const canSave = nameValid && calOrProteinValid;

  const nameInvalid = attemptedSave && !nameValid;
  const calInvalid = attemptedSave && !calOrProteinValid;

  const macroCal =
    safeNum(protein) * PROTEIN_KCAL +
    safeNum(carbs) * CARBS_KCAL +
    safeNum(fat) * FAT_KCAL;

  const cycleUnit = () => setUnitIdx((i) => (i + 1) % UNITS.length);

  const handleSave = async () => {
    if (!canSave) {
      setAttemptedSave(true);
      if (!nameValid) shake(nameShake);
      if (!calOrProteinValid) shake(calShake);
      return;
    }
    if (!user || saving) return;
    setSaving(true);
    try {
      const foodData = {
        name: name.trim(),
        brand: brand.trim() || null,
        barcode: barcode || null,
        serving_size: Number(servingSize) || 1,
        serving_unit: UNITS[unitIdx],
        calories: Number(cal),
        protein_g: Number(protein),
        carbs_g: Number(carbs),
        fat_g: Number(fat),
        fiber_g: Number(fiber) || 0,
        sugar_g: Number(sugar) || 0,
        sodium_mg: Number(sodium) || 0,
        saturated_fat_g: Number(satFat) || 0,
        cholesterol_mg: Number(cholesterol) || 0,
        is_public: shareCommunity,
      };
      if (isEditing) {
        await updateCustomFood(params.editId!, user.id, foodData);
      } else {
        await addCustomFood({ user_id: user.id, ...foodData });
      }
      sessionState.setNeedsRefresh(true);
      toast.show(
        isEditing ? 'Food updated.' : 'Food saved to your library',
        'success',
      );
      setTimeout(() => router.back(), 800);
    } catch {
      toast.show('Could not save food. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleScanNutritionLabel = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        toast.show('Camera permission required.', 'error');
        return;
      }
    }
    setScanningLabel(true);
    try {
      const photo = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.9,
        allowsEditing: false,
      });
      if (photo.canceled) return;
      const base64 = photo.assets[0]?.base64;
      if (!base64) return;
      toast.show('Reading nutrition label…', 'info');
      const result = await scanNutritionLabel(base64, 'image/jpeg');

      // Pre-fill the form from the scanned label.
      if (result.name && result.name !== 'Scanned Food') setName(result.name);
      setCal(String(result.calories));
      setProtein(String(result.protein_g));
      setCarbs(String(result.carbs_g));
      setFat(String(result.fat_g));
      setFiber(String(result.fiber_g));
      setSugar(String(result.sugar_g));
      setSodium(String(result.sodium_mg));
      setSatFat(String(result.saturated_fat_g));
      setCholesterol(String(result.cholesterol_mg));
      setServingSize(String(result.serving_size_g));
      setUnitIdx(0);

      toast.show('Nutrition label scanned successfully.', 'success');
    } catch {
      toast.show(
        'Could not read label. Try again with better lighting.',
        'error',
      );
    } finally {
      setScanningLabel(false);
    }
  };

  const fieldInputStyle: TextStyle = {
    ...typo.body,
    color: t.text,
    flex: 1,
    padding: 0,
    textAlign: 'right',
  };
  const numericInputStyle: TextStyle = {
    ...typo.subhead,
    width: 72,
    backgroundColor: t.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 8,
    color: t.text,
    textAlign: 'center',
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.bg }}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View>
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: t.surface3,
                marginTop: 8,
              }}
            />
          </View>
          <Text
            style={[
              typo.title3,
              { color: t.text, textAlign: 'center', marginTop: 12 },
            ]}
          >
            {isEditing ? 'Edit food' : 'New food'}
          </Text>
          <Pressable
            onPress={() => router.back()}
            hitSlop={6}
            style={({ pressed }) => ({
              position: 'absolute',
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: t.surface2,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="close-outline" size={18} color={t.textSec} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: space.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section 1 — Basic info */}
          {fromLabelScan && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.xs,
                backgroundColor: t.primarySoft,
                borderRadius: radius.md,
                padding: space.sm,
                marginTop: space.md,
                marginHorizontal: space.lg,
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={16}
                color={t.primary}
              />
              <Text style={[typo.caption1, { color: t.primary, flex: 1 }]}>
                Scanned from nutrition label. Review and confirm the name
                before saving.
              </Text>
            </View>
          )}
          <View style={{ marginTop: space.md }} />
          <SectionCard>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                gap: space.md,
              }}
            >
              <Text style={[typo.subhead, { color: t.textSec }]}>
                Food name
              </Text>
              <Animated.View
                style={{
                  flex: 1,
                  transform: [{ translateX: nameShake }],
                }}
              >
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Homemade granola"
                  placeholderTextColor={t.textTer}
                  autoCapitalize="words"
                  returnKeyType="done"
                  style={[
                    fieldInputStyle,
                    nameInvalid && {
                      color: t.danger,
                    },
                  ]}
                />
              </Animated.View>
            </View>
            <Separator t={t} inset={space.lg} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                gap: space.md,
              }}
            >
              <Text style={[typo.subhead, { color: t.textSec }]}>Brand</Text>
              <TextInput
                value={brand}
                onChangeText={setBrand}
                placeholder="Optional"
                placeholderTextColor={t.textTer}
                autoCapitalize="words"
                returnKeyType="done"
                style={fieldInputStyle}
              />
            </View>
            <Separator t={t} inset={space.lg} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                gap: space.md,
              }}
            >
              <Text
                style={[typo.subhead, { color: t.textSec, flex: 1 }]}
              >
                Barcode
              </Text>
              {barcode ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Text style={[typo.subhead, { color: t.text }]}>
                    {barcode}
                  </Text>
                  <Pressable
                    hitSlop={6}
                    onPress={() => setBarcode('')}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Ionicons
                      name="close-outline"
                      size={16}
                      color={t.textTer}
                    />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  hitSlop={6}
                  onPress={() => router.push('/barcode-scanner')}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={[typo.subhead, { color: t.primary }]}>
                    Add barcode
                  </Text>
                </Pressable>
              )}
            </View>
            <Separator t={t} inset={space.lg} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                gap: space.sm,
              }}
            >
              <Text
                style={[typo.subhead, { color: t.textSec, flex: 1 }]}
              >
                Serving size
              </Text>
              <TextInput
                value={servingSize}
                onChangeText={setServingSize}
                keyboardType="decimal-pad"
                returnKeyType="done"
                style={{
                  width: 60,
                  backgroundColor: t.surface2,
                  borderRadius: radius.sm,
                  paddingHorizontal: 8,
                  paddingVertical: 8,
                  ...typo.subhead,
                  color: t.text,
                  textAlign: 'center',
                }}
              />
              <Pressable
                onPress={cycleUnit}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: t.surface2,
                  borderRadius: radius.sm,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={[typo.subhead, { color: t.text }]}>
                  {UNITS[unitIdx]}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color={t.textSec}
                />
              </Pressable>
            </View>
          </SectionCard>

          {/* Scan nutrition label button */}
          <Pressable
            onPress={handleScanNutritionLabel}
            disabled={scanningLabel}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              backgroundColor: t.surface2,
              borderRadius: radius.lg,
              padding: space.md,
              marginTop: space.sm,
              marginHorizontal: space.lg,
              opacity: pressed || scanningLabel ? 0.6 : 1,
            })}
          >
            {scanningLabel ? (
              <ActivityIndicator size="small" color={t.primary} />
            ) : (
              <Ionicons
                name="document-text-outline"
                size={20}
                color={t.primary}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={[typo.subhead, { color: t.text, fontWeight: '600' }]}
              >
                {scanningLabel ? 'Reading label…' : 'Scan nutrition label'}
              </Text>
              <Text style={[typo.caption1, { color: t.textSec }]}>
                Point camera at the Nutrition Facts panel to auto-fill
              </Text>
            </View>
            {!scanningLabel && (
              <Ionicons name="camera-outline" size={18} color={t.textTer} />
            )}
          </Pressable>

          {/* Section 2 — Nutrition */}
          <SectionLabel>Nutrition per serving</SectionLabel>
          <SectionCard>
            {/* Calories — no accent */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                gap: space.sm,
              }}
            >
              <Text
                style={[typo.subheadEm, { color: t.text, flex: 1 }]}
              >
                Calories
              </Text>
              <Animated.View
                style={{ transform: [{ translateX: calShake }] }}
              >
                <TextInput
                  value={cal}
                  onChangeText={setCal}
                  keyboardType="numeric"
                  returnKeyType="done"
                  placeholder="0"
                  placeholderTextColor={t.textTer}
                  style={[
                    numericInputStyle,
                    calInvalid && {
                      borderWidth: 1,
                      borderColor: t.danger,
                    },
                  ]}
                />
              </Animated.View>
            </View>
            <Separator t={t} inset={space.lg} />

            {/* Macro rows */}
            <MacroInputRow
              label="Protein"
              value={protein}
              onChangeText={setProtein}
              color={t.protein}
              t={t}
            />
            <Separator t={t} inset={space.lg} />
            <MacroInputRow
              label="Carbohydrates"
              value={carbs}
              onChangeText={setCarbs}
              color={t.carbs}
              t={t}
            />
            <Separator t={t} inset={space.lg} />
            <MacroInputRow
              label="Fat"
              value={fat}
              onChangeText={setFat}
              color={t.teal}
              t={t}
            />
            <Separator t={t} inset={space.lg} />

            {/* Live macro summary */}
            <View
              style={{
                paddingHorizontal: space.lg,
                paddingVertical: 10,
              }}
            >
              <Text style={[typo.caption1, { color: t.textTer }]}>
                {`${macroCal} kcal from macros`}
              </Text>
            </View>
          </SectionCard>

          {/* Section 3 — Extended */}
          <SectionCard>
            <Pressable
              onPress={() => setExtendedOpen((v) => !v)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 14,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[typo.subhead, { color: t.textSec, flex: 1 }]}>
                More nutrients
              </Text>
              <Ionicons
                name={extendedOpen ? 'chevron-down' : 'chevron-forward'}
                size={18}
                color={t.textSec}
              />
            </Pressable>
            {extendedOpen && (
              <View>
                <Separator t={t} inset={space.lg} />
                <ExtendedRow
                  label="Fiber"
                  unit="g"
                  value={fiber}
                  onChangeText={setFiber}
                  t={t}
                />
                <Separator t={t} inset={space.lg} />
                <ExtendedRow
                  label="Sugar"
                  unit="g"
                  value={sugar}
                  onChangeText={setSugar}
                  t={t}
                />
                <Separator t={t} inset={space.lg} />
                <ExtendedRow
                  label="Sodium"
                  unit="mg"
                  value={sodium}
                  onChangeText={setSodium}
                  t={t}
                />
                <Separator t={t} inset={space.lg} />
                <ExtendedRow
                  label="Saturated fat"
                  unit="g"
                  value={satFat}
                  onChangeText={setSatFat}
                  t={t}
                />
                <Separator t={t} inset={space.lg} />
                <ExtendedRow
                  label="Cholesterol"
                  unit="mg"
                  value={cholesterol}
                  onChangeText={setCholesterol}
                  t={t}
                />
              </View>
            )}
          </SectionCard>

          {/* Community toggle */}
          <SectionCard>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: space.lg,
                paddingVertical: 12,
                gap: space.sm,
              }}
            >
              <Ionicons name="earth-outline" size={20} color={t.textSec} />
              <Text
                style={[typo.subhead, { color: t.text, flex: 1, marginLeft: 4 }]}
              >
                Share with BluCal community
              </Text>
              <Switch
                value={shareCommunity}
                onValueChange={setShareCommunity}
                trackColor={{ false: t.surface3, true: t.primary }}
                style={{ marginLeft: space.sm }}
              />
            </View>
            {shareCommunity && (
              <View
                style={{
                  paddingHorizontal: space.lg,
                  paddingBottom: 12,
                }}
              >
                <Text style={[typo.caption1, { color: t.textTer }]}>
                  Other users can find and log this food.
                </Text>
              </View>
            )}
          </SectionCard>
        </ScrollView>

        {/* Save button */}
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: insets.bottom + space.md,
          }}
        >
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: t.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: saving ? 0.6 : canSave ? (pressed ? 0.85 : 1) : 0.4,
            })}
          >
            {saving ? (
              <ActivityIndicator color={t.textOnPrim} />
            ) : (
              <Text style={[typo.headline, { color: t.textOnPrim }]}>Save</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

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

// ── Subcomponents at file scope ──────────────────────────────────────────────
function MacroInputRow({
  label,
  value,
  onChangeText,
  color,
  t,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  color: string;
  t: Theme;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        paddingHorizontal: space.lg,
        paddingVertical: 12,
        gap: space.md,
      }}
    >
      <View
        style={{
          width: 3,
          borderRadius: radius.pill,
          backgroundColor: color,
        }}
      />
      <Text
        style={[
          typo.subheadEm,
          { color: t.text, flex: 1, alignSelf: 'center' },
        ]}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        returnKeyType="done"
        placeholder="0"
        placeholderTextColor={t.textTer}
        style={{
          width: 72,
          backgroundColor: t.surface2,
          borderRadius: radius.sm,
          paddingHorizontal: 8,
          paddingVertical: 8,
          ...typo.subhead,
          color: t.text,
          textAlign: 'center',
        }}
      />
      <Text
        style={[typo.subhead, { color: t.textSec, alignSelf: 'center' }]}
      >
        g
      </Text>
    </View>
  );
}

function ExtendedRow({
  label,
  unit,
  value,
  onChangeText,
  t,
}: {
  label: string;
  unit: string;
  value: string;
  onChangeText: (s: string) => void;
  t: Theme;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space.lg,
        paddingVertical: 12,
        gap: space.md,
      }}
    >
      <Text style={[typo.subhead, { color: t.text, flex: 1 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        returnKeyType="done"
        placeholder="0"
        placeholderTextColor={t.textTer}
        style={{
          width: 72,
          backgroundColor: t.surface2,
          borderRadius: radius.sm,
          paddingHorizontal: 8,
          paddingVertical: 8,
          ...typo.subhead,
          color: t.text,
          textAlign: 'center',
        }}
      />
      <Text style={[typo.subhead, { color: t.textSec }]}>{unit}</Text>
    </View>
  );
}
