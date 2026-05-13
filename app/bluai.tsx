// BluAI requires a dev build to work. Camera capture and image picking via
// expo-camera / expo-image-picker are not available in Expo Go.
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { radius, space, type as typo, useTheme } from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { useAuth } from '../lib/AuthContext';
import { addFoodEntry } from '../lib/db';
import { sessionState } from '../lib/sessionState';
import {
  analyzeMealPhoto,
  refineMealAnalysis,
  type BluAIFoodItem,
  type BluAIMimeType,
} from '../lib/bluai';

// Camera-overlay specific colors. These sit on top of a live camera feed and
// are independent of the app theme — no theme tokens exist for them.
const OVERLAY_COLOR = 'rgba(0,0,0,0.55)';
const CONTROL_BG = 'rgba(0,0,0,0.5)';
const PILL_BG = 'rgba(0,0,0,0.3)';
const SHUTTER_RING = 'rgba(255,255,255,0.4)';

const CONTROL_SIZE = 40;
const SHUTTER_OUTER = 72;
const SHUTTER_INNER = 56;

type Confidence = BluAIFoodItem['confidence'];

type ActiveField =
  | { type: 'chip'; q: string }
  | { type: 'freeText' };

type CapturedImage = {
  base64: string;
  uri: string;
  mimeType: BluAIMimeType;
};

type Phase = 'camera' | 'analyzing' | 'results';

// ── Small subcomponents ──────────────────────────────────────────────────────
function BrandLabel() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: t.teal,
        }}
      />
      <Text style={[typo.headline, { fontWeight: '600' }]}>
        <Text style={{ color: t.primary }}>Blu</Text>
        <Text style={{ color: t.textOnPrim }}>AI</Text>
      </Text>
    </View>
  );
}

function CircleControl({
  icon,
  onPress,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  style?: object;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: CONTROL_SIZE,
        height: CONTROL_SIZE,
        borderRadius: CONTROL_SIZE / 2,
        backgroundColor: CONTROL_BG,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
        ...style,
      })}
    >
      <Ionicons name={icon} size={22} color={t.textOnPrim} />
    </Pressable>
  );
}

function Checkbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={6}
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: checked ? t.primary : t.surface2,
        borderWidth: checked ? 0 : 1,
        borderColor: t.hairline,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked && <Ionicons name="checkmark" size={14} color={t.textOnPrim} />}
    </Pressable>
  );
}

function ConfidenceDot({ confidence }: { confidence: Confidence }) {
  const t = useTheme();
  const color =
    confidence === 'high'
      ? t.success
      : confidence === 'medium'
        ? t.warn
        : t.danger;
  return (
    <View
      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }}
    />
  );
}

function MacroCol({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', minWidth: 44 }}>
      <Text
        style={[
          typo.subheadEm,
          { color, fontVariant: ['tabular-nums'] },
        ]}
      >
        {`${value}g`}
      </Text>
      <Text style={[typo.caption2, { color: t.textTer, marginTop: 2 }]}>
        {label}
      </Text>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function BluAI() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const toast = useToast();
  const { user } = useAuth();

  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase] = useState<Phase>('camera');
  const [capturedImage, setCapturedImage] = useState<CapturedImage | null>(null);
  const [detectedItems, setDetectedItems] = useState<BluAIFoodItem[]>([]);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [userNote, setUserNote] = useState('');
  const [chipAnswers, setChipAnswers] = useState<Record<string, string>>({});
  const [activeField, setActiveField] = useState<ActiveField | null>(null);
  const [draftText, setDraftText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Refs mirror activeField + draftText so the keyboard listener (attached
  // once, on mount) always sees the latest values without stale closures.
  const activeFieldRef = useRef<ActiveField | null>(null);
  const draftTextRef = useRef('');
  useEffect(() => {
    activeFieldRef.current = activeField;
  }, [activeField]);
  useEffect(() => {
    draftTextRef.current = draftText;
  }, [draftText]);

  const commitChipAnswer = (chipId: string, text: string) => {
    const trimmed = text.trim();
    setChipAnswers((prev) => {
      const next = { ...prev };
      if (trimmed) next[chipId] = trimmed;
      else delete next[chipId];
      return next;
    });
  };

  useEffect(() => {
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setKeyboardHeight(0);
      // Tap-outside-to-dismiss: auto-save whatever the user typed, clear the
      // floating bar state. Refs are pre-cleared by commitAndClose when the
      // user taps Done, so we skip this branch in that case.
      const af = activeFieldRef.current;
      if (af) {
        const draft = draftTextRef.current;
        if (af.type === 'chip') {
          commitChipAnswer(af.q, draft);
        } else {
          setUserNote(draft.trim());
        }
        activeFieldRef.current = null;
        draftTextRef.current = '';
        setActiveField(null);
        setDraftText('');
      }
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const openChipEditor = (q: string) => {
    setActiveField({ type: 'chip', q });
    setDraftText(chipAnswers[q] ?? '');
  };

  const openFreeTextEditor = () => {
    setActiveField({ type: 'freeText' });
    setDraftText(userNote);
  };

  const commitAndClose = () => {
    if (!activeField) return;
    if (activeField.type === 'chip') {
      commitChipAnswer(activeField.q, draftText);
    } else {
      setUserNote(draftText.trim());
    }
    activeFieldRef.current = null;
    draftTextRef.current = '';
    setActiveField(null);
    setDraftText('');
    Keyboard.dismiss();
  };

  const resetSession = () => {
    setCapturedImage(null);
    setDetectedItems([]);
    setFollowUpQuestions([]);
    setCheckedIds(new Set());
    setUserNote('');
    setChipAnswers({});
    setActiveField(null);
    setDraftText('');
  };

  const handleClose = () => {
    if (phase === 'results') {
      setPhase('camera');
      resetSession();
    }
    router.back();
  };

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const runAnalysis = async (base64: string, mimeType: BluAIMimeType) => {
    try {
      const result = await analyzeMealPhoto(base64, mimeType);
      setDetectedItems(result.items);
      setFollowUpQuestions(result.questions);
      setCheckedIds(new Set(result.items.map((i) => i.id)));
      setPhase('results');
    } catch (e) {
      console.error(e);
      setPhase('camera');
      toast.show('Could not analyze photo. Try again.', 'error');
    }
  };

  const handleShutter = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        exif: false,
      });
      if (!photo?.base64) throw new Error('No image data');
      const captured: CapturedImage = {
        base64: photo.base64,
        uri: photo.uri,
        mimeType: 'image/jpeg',
      };
      setCapturedImage(captured);
      setPhase('analyzing');
      await runAnalysis(captured.base64, captured.mimeType);
    } catch (e) {
      console.error(e);
      setPhase('camera');
      toast.show('Could not capture photo. Try again.', 'error');
    }
  };

  const handleGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset || !asset.base64) return;
    const captured: CapturedImage = {
      base64: asset.base64,
      uri: asset.uri,
      mimeType: 'image/jpeg',
    };
    setCapturedImage(captured);
    setPhase('analyzing');
    await runAnalysis(captured.base64, captured.mimeType);
  };

  const handleRefine = async () => {
    if (!capturedImage) return;
    setPhase('analyzing');
    try {
      const result = await refineMealAnalysis(
        capturedImage.base64,
        capturedImage.mimeType,
        detectedItems,
        chipAnswers,
        userNote,
      );
      setDetectedItems(result.items);
      setCheckedIds(new Set(result.items.map((i) => i.id)));
      setPhase('results');
    } catch (e) {
      console.error(e);
      setPhase('results');
      toast.show('Could not refine estimate. Try again.', 'error');
    }
  };

  const handleAddToLog = async () => {
    if (!user || saving) return;
    const checkedItemsToLog = detectedItems.filter((i) => checkedIds.has(i.id));
    if (checkedItemsToLog.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        checkedItemsToLog.map((item) =>
          addFoodEntry({
            user_id: user.id,
            logged_at: new Date().toISOString(),
            name: item.name,
            portion_description: item.quantity,
            quantity: 1,
            unit: 'serving',
            calories: item.cal,
            protein_g: item.p,
            carbs_g: item.c,
            fat_g: item.f,
            fiber_g: 0,
            sugar_g: 0,
            sodium_mg: 0,
            saturated_fat_g: 0,
            cholesterol_mg: 0,
            food_database_id: null,
            barcode: null,
            source: 'bluai',
          }),
        ),
      );
      sessionState.setJustLoggedFood(
        checkedItemsToLog.length === 1
          ? checkedItemsToLog[0].name
          : `${checkedItemsToLog.length} items`,
      );
      toast.show(
        `Logged ${checkedItemsToLog.length} item${checkedItemsToLog.length !== 1 ? 's' : ''}`,
        'success',
      );
      setTimeout(() => router.back(), 800);
    } catch {
      toast.show('Could not add to log. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!permission) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.xl,
        }}
      >
        <Text
          style={[
            typo.subhead,
            { color: t.textSec, textAlign: 'center', marginBottom: space.lg },
          ]}
        >
          Camera access is needed to use BluAI
        </Text>
        <Pressable
          onPress={() => Linking.openSettings()}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[typo.body, { color: t.primary }]}>Open Settings</Text>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            marginTop: space.xl,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={[typo.footnote, { color: t.textTer }]}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const photoHeight = phase === 'results' ? screenH * 0.4 : screenH;

  const checkedItems = detectedItems.filter((r) => checkedIds.has(r.id));
  const totals = checkedItems.reduce(
    (acc, r) => ({
      cal: acc.cal + r.cal,
      p: acc.p + r.p,
      c: acc.c + r.c,
      f: acc.f + r.f,
    }),
    { cal: 0, p: 0, c: 0, f: 0 },
  );

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasUserContext =
    Object.keys(chipAnswers).length > 0 || userNote.trim().length > 0;

  return (
    <View style={{ flex: 1 }}>
      {/* Background layer */}
      {phase === 'camera' ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      ) : capturedImage ? (
        <Image
          source={{ uri: capturedImage.uri }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: photoHeight,
          }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: photoHeight,
            backgroundColor: t.surface3,
          }}
        />
      )}

      {/* Top header — close + brand. Hidden during analyzing (overlay covers it). */}
      {phase !== 'analyzing' && (
        <View
          style={{
            position: 'absolute',
            top: insets.top + space.sm,
            left: 0,
            right: 0,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: space.lg,
          }}
        >
          <CircleControl icon="close" onPress={handleClose} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <BrandLabel />
          </View>
          <View style={{ width: CONTROL_SIZE }} />
        </View>
      )}

      {/* ─── Camera state ─── */}
      {phase === 'camera' && (
        <>
          {/* Instruction pill */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: insets.bottom + SHUTTER_OUTER + space.xxl,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: PILL_BG,
              }}
            >
              <Text style={[typo.subhead, { color: t.textOnPrim }]}>
                Point at your meal
              </Text>
            </View>
          </View>

          {/* Gallery picker (bottom-left) */}
          <View
            style={{
              position: 'absolute',
              bottom:
                insets.bottom + (SHUTTER_OUTER - CONTROL_SIZE) / 2 + space.xl,
              left: space.xl,
            }}
          >
            <CircleControl icon="image-outline" onPress={handleGallery} />
          </View>

          {/* Shutter (bottom center) */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: insets.bottom + space.xl,
              alignItems: 'center',
            }}
          >
            <Pressable
              onPress={handleShutter}
              style={({ pressed }) => ({
                width: SHUTTER_OUTER,
                height: SHUTTER_OUTER,
                borderRadius: SHUTTER_OUTER / 2,
                borderWidth: 4,
                borderColor: SHUTTER_RING,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                style={{
                  width: SHUTTER_INNER,
                  height: SHUTTER_INNER,
                  borderRadius: SHUTTER_INNER / 2,
                  backgroundColor: t.textOnPrim,
                }}
              />
            </Pressable>
          </View>
        </>
      )}

      {/* ─── Analyzing state ─── */}
      {phase === 'analyzing' && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: OVERLAY_COLOR,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <ActivityIndicator color={t.textOnPrim} size="large" />
          <Text
            style={[
              typo.subhead,
              { color: t.textOnPrim, marginTop: space.md },
            ]}
          >
            Analyzing your meal…
          </Text>
        </View>
      )}

      {/* ─── Results state ─── */}
      {phase === 'results' && (
        <View
          style={{
            position: 'absolute',
            top: photoHeight,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: t.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: space.lg,
            paddingTop: space.lg,
            paddingBottom: insets.bottom + space.md,
          }}
        >
          <Text
            style={[
              typo.caption2,
              {
                color: t.textTer,
                letterSpacing: 0.06,
                textTransform: 'uppercase',
                fontWeight: '700',
              },
            ]}
          >
            What we found
          </Text>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ marginTop: space.md }}>
              {detectedItems.length === 0 ? (
                <Text
                  style={[
                    typo.footnote,
                    { color: t.textTer, paddingVertical: space.lg },
                  ]}
                >
                  No food detected in this photo.
                </Text>
              ) : (
                detectedItems.map((item, i) => {
                  const checked = checkedIds.has(item.id);
                  const isLast = i === detectedItems.length - 1;
                  return (
                    <View key={item.id}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          paddingVertical: 12,
                        }}
                      >
                        <Checkbox
                          checked={checked}
                          onToggle={() => toggleChecked(item.id)}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={[typo.subhead, { color: t.text }]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={[
                              typo.footnote,
                              { color: t.textSec, marginTop: 2 },
                            ]}
                            numberOfLines={1}
                          >
                            {item.quantity}
                          </Text>
                        </View>
                        <ConfidenceDot confidence={item.confidence} />
                        <Pressable
                          hitSlop={6}
                          style={({ pressed }) => ({
                            opacity: pressed ? 0.6 : 1,
                          })}
                        >
                          <Ionicons
                            name="create-outline"
                            size={16}
                            color={t.textTer}
                          />
                        </Pressable>
                      </View>
                      {!isLast && (
                        <View
                          style={{
                            height: 0.5,
                            backgroundColor: t.hairline,
                            marginLeft: 22 + 12,
                          }}
                        />
                      )}
                    </View>
                  );
                })
              )}
            </View>

            {(followUpQuestions.length > 0 || detectedItems.length > 0) && (
              <View style={{ marginTop: space.xl }}>
                <Text style={[typo.subheadEm, { color: t.text }]}>
                  Tell us more
                </Text>
                <Text
                  style={[
                    typo.footnote,
                    { color: t.textTer, marginTop: 2 },
                  ]}
                >
                  Help BluAI refine the estimate
                </Text>
                {followUpQuestions.length > 0 && (
                  <View style={{ marginTop: space.md }}>
                    {followUpQuestions.map((q) => {
                      const savedAnswer = chipAnswers[q];
                      return (
                        <View key={q} style={{ marginBottom: space.sm }}>
                          <View
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                          >
                            <Pressable
                              onPress={() => openChipEditor(q)}
                              style={({ pressed }) => ({
                                backgroundColor: t.surface2,
                                borderRadius: radius.pill,
                                paddingLeft: 14,
                                paddingRight: savedAnswer ? 8 : 14,
                                paddingVertical: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                opacity: pressed ? 0.6 : 1,
                              })}
                            >
                              <Text
                                style={[typo.footnote, { color: t.textSec }]}
                              >
                                {q}
                              </Text>
                              {savedAnswer && (
                                <View
                                  style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: 7,
                                    backgroundColor: t.success,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Ionicons
                                    name="checkmark"
                                    size={10}
                                    color={t.textOnPrim}
                                  />
                                </View>
                              )}
                            </Pressable>
                          </View>

                          {savedAnswer && (
                            <Pressable
                              onPress={() => openChipEditor(q)}
                              style={({ pressed }) => ({
                                marginTop: 6,
                                paddingHorizontal: 4,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                opacity: pressed ? 0.6 : 1,
                              })}
                            >
                              <Text
                                style={[
                                  typo.caption1,
                                  { color: t.textSec, flex: 1 },
                                ]}
                              >
                                {savedAnswer}
                              </Text>
                              <Ionicons
                                name="create-outline"
                                size={14}
                                color={t.textTer}
                              />
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                <Pressable
                  onPress={openFreeTextEditor}
                  style={({ pressed }) => ({
                    marginTop: space.md,
                    backgroundColor: t.surface2,
                    borderRadius: radius.lg,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Ionicons name="create-outline" size={18} color={t.textTer} />
                  <Text
                    style={[
                      typo.footnote,
                      { flex: 1, color: userNote ? t.text : t.textTer },
                    ]}
                    numberOfLines={1}
                  >
                    {userNote ||
                      'Anything else? e.g. used olive oil, gluten free bread…'}
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* Refine + totals + button — ride up with keyboard via marginBottom */}
          <View style={{ marginBottom: keyboardHeight }}>
            {hasUserContext && capturedImage && (
              <Pressable
                onPress={handleRefine}
                style={({ pressed }) => ({
                  marginBottom: space.sm,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: t.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 6,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="sparkles-outline" size={16} color={t.primary} />
                <Text
                  style={[typo.subheadEm, { color: t.primary }]}
                >
                  Refine estimate
                </Text>
              </Pressable>
            )}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                paddingTop: space.md,
                paddingBottom: space.md,
                borderTopWidth: 0.5,
                borderTopColor: t.hairline,
              }}
            >
              <View>
                <Text
                  style={[
                    typo.caption2,
                    {
                      color: t.textTer,
                      letterSpacing: 0.06,
                      textTransform: 'uppercase',
                      fontWeight: '700',
                    },
                  ]}
                >
                  Total
                </Text>
                <Text
                  style={[
                    typo.title2,
                    {
                      color: t.text,
                      marginTop: 2,
                      fontVariant: ['tabular-nums'],
                    },
                  ]}
                >
                  {totals.cal}
                  <Text style={[typo.body, { color: t.textSec }]}> kcal</Text>
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <MacroCol value={totals.p} label="protein" color={t.protein} />
                <MacroCol value={totals.c} label="carbs" color={t.carbs} />
                <MacroCol value={totals.f} label="fat" color={t.fat} />
              </View>
            </View>

            <Pressable
              onPress={handleAddToLog}
              disabled={saving || checkedItems.length === 0}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: radius.lg,
                backgroundColor: t.primary,
                alignItems: 'center',
                justifyContent: 'center',
                opacity:
                  saving || checkedItems.length === 0
                    ? 0.4
                    : pressed
                      ? 0.85
                      : 1,
              })}
            >
              {saving ? (
                <ActivityIndicator color={t.textOnPrim} />
              ) : (
                <Text style={[typo.headline, { color: t.textOnPrim }]}>
                  Add to log
                </Text>
              )}
            </Pressable>
          </View>

          {/* Floating input bar — iMessage-style. Sits just above keyboard. */}
          {activeField !== null && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: keyboardHeight,
                backgroundColor: t.surface,
                borderTopWidth: 0.5,
                borderTopColor: t.hairline,
                paddingHorizontal: 12,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text
                style={[typo.footnote, { color: t.textSec, flex: 1 }]}
                numberOfLines={1}
              >
                {activeField.type === 'chip' ? activeField.q : 'Notes'}
              </Text>
              <TextInput
                autoFocus
                value={draftText}
                onChangeText={setDraftText}
                placeholder={
                  activeField.type === 'chip'
                    ? 'Your answer…'
                    : 'Type your note…'
                }
                placeholderTextColor={t.textTer}
                multiline={false}
                returnKeyType="done"
                onSubmitEditing={commitAndClose}
                style={[typo.subhead, { flex: 2, color: t.text, padding: 0 }]}
              />
              <Pressable onPress={commitAndClose} hitSlop={8}>
                <Text style={[typo.subheadEm, { color: t.primary }]}>Done</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <Toast
        message={toast.message}
        visible={toast.visible}
        type={toast.type}
        duration={toast.duration}
        onHide={toast.hide}
      />
    </View>
  );
}
