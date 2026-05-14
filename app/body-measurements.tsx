import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { radius, space, type as typo, useTheme, type Theme } from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { useAuth } from '../lib/AuthContext';
import {
  addMeasurement,
  addProgressPhoto,
  deleteProgressPhoto,
  getMeasurements,
  getProgressPhotos,
  type ProgressPhotoWithUrl,
} from '../lib/db';
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

  const [photos, setPhotos] = useState<ProgressPhotoWithUrl[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] =
    useState<ProgressPhotoWithUrl | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareBefore, setCompareBefore] =
    useState<ProgressPhotoWithUrl | null>(null);
  const [compareAfter, setCompareAfter] =
    useState<ProgressPhotoWithUrl | null>(null);

  const displayUnit: 'in' | 'cm' = profile?.is_metric ? 'cm' : 'in';

  useEffect(() => {
    if (!user) return;
    getMeasurements(user.id)
      .then(setMeasurements)
      .catch(console.error)
      .finally(() => setLoading(false));
    getProgressPhotos(user.id).then(setPhotos).catch(console.error);
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

  const savePhoto = async (uri: string) => {
    if (!user) return;
    try {
      setUploading(true);
      await addProgressPhoto(user.id, uri, new Date().toISOString());
      const updated = await getProgressPhotos(user.id);
      setPhotos(updated);
      toast.show('Photo saved', 'success');
    } catch (e) {
      console.error(e);
      toast.show('Could not save photo. Try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleAddPhoto = () => {
    if (!user) return;
    Alert.alert('Add progress photo', 'Choose how to add your photo', [
      {
        text: 'Take photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            toast.show('Camera permission required.', 'info');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
            allowsEditing: true,
            aspect: [3, 4],
          });
          if (!result.canceled && result.assets[0]) {
            await savePhoto(result.assets[0].uri);
          }
        },
      },
      {
        text: 'Choose from library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true,
            aspect: [3, 4],
          });
          if (!result.canceled && result.assets[0]) {
            await savePhoto(result.assets[0].uri);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleDeletePhoto = (photo: ProgressPhotoWithUrl) => {
    Alert.alert('Delete photo?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProgressPhoto(photo);
            setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
            if (selectedPhoto?.id === photo.id) setSelectedPhoto(null);
            toast.show('Photo deleted', 'success');
          } catch (e) {
            console.error(e);
            toast.show('Could not delete photo.', 'error');
          }
        },
      },
    ]);
  };

  const handleSharePhoto = async (photo: ProgressPhotoWithUrl) => {
    try {
      await Share.share({ url: photo.signedUrl, message: 'My BluCal progress' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompare = () => {
    if (photos.length < 2) {
      Alert.alert(
        'Add more photos',
        'Add at least 2 photos to compare progress.',
      );
      return;
    }
    setCompareBefore(photos[photos.length - 1] ?? null);
    setCompareAfter(photos[0] ?? null);
    setCompareOpen(true);
  };

  const formatPhotoDate = (iso: string): string =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

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

        {/* Progress photos */}
        <SectionLabel>Progress Photos</SectionLabel>
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
            disabled={uploading}
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
              opacity: uploading ? 0.5 : pressed ? 0.6 : 1,
            })}
          >
            {uploading ? (
              <ActivityIndicator color={t.primary} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={28} color={t.primary} />
                <Text style={[typo.caption2, { color: t.primary }]}>
                  Add photo
                </Text>
              </>
            )}
          </Pressable>
          {photos.map((photo) => (
            <Pressable
              key={photo.id}
              onPress={() => setSelectedPhoto(photo)}
              onLongPress={() => handleDeletePhoto(photo)}
              style={({ pressed }) => ({
                width: tileSize,
                height: tileSize,
                borderRadius: radius.md,
                overflow: 'hidden',
                backgroundColor: t.surface2,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Image
                source={{ uri: photo.signedUrl }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: 4,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: 4,
                  paddingHorizontal: 4,
                  paddingVertical: 2,
                }}
              >
                <Text style={[typo.caption2, { color: '#FFFFFF' }]}>
                  {formatPhotoDate(photo.taken_at)}
                </Text>
              </View>
            </Pressable>
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

      </ScrollView>

      {/* Photo viewer */}
      <Modal
        visible={selectedPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {selectedPhoto && (
            <>
              <Pressable
                onLongPress={() => handleDeletePhoto(selectedPhoto)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Image
                  source={{ uri: selectedPhoto.signedUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              </Pressable>

              {/* Top controls */}
              <View
                style={{
                  position: 'absolute',
                  top: insets.top + space.sm,
                  left: 0,
                  right: 0,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingHorizontal: space.lg,
                }}
              >
                <Pressable
                  onPress={() => handleSharePhoto(selectedPhoto)}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                </Pressable>
                <Pressable
                  onPress={() => setSelectedPhoto(null)}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Ionicons name="close" size={22} color="#FFFFFF" />
                </Pressable>
              </View>

              {/* Bottom date label */}
              <View
                style={{
                  position: 'absolute',
                  bottom: insets.bottom + space.lg,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                }}
              >
                <Text style={[typo.subhead, { color: '#FFFFFF' }]}>
                  {new Date(selectedPhoto.taken_at).toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    },
                  )}
                </Text>
                <Text
                  style={[
                    typo.caption1,
                    { color: 'rgba(255,255,255,0.5)', marginTop: 4 },
                  ]}
                >
                  Long press to delete
                </Text>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Compare photos */}
      <Modal
        visible={compareOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCompareOpen(false)}
      >
        <Pressable
          onPress={() => setCompareOpen(false)}
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
              maxHeight: '90%',
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
              style={[typo.title3, { color: t.text, marginTop: space.lg }]}
            >
              Compare photos
            </Text>
            <Text
              style={[typo.subhead, { color: t.textSec, marginTop: 2 }]}
            >
              Tap a photo below to set it as Before or After.
            </Text>

            {/* Side-by-side slots */}
            <View
              style={{
                flexDirection: 'row',
                gap: space.md,
                marginTop: space.lg,
              }}
            >
              {(['before', 'after'] as const).map((slot) => {
                const photo =
                  slot === 'before' ? compareBefore : compareAfter;
                const setter =
                  slot === 'before' ? setCompareBefore : setCompareAfter;
                return (
                  <View key={slot} style={{ flex: 1 }}>
                    <Text
                      style={[
                        typo.caption2,
                        {
                          color: t.textTer,
                          letterSpacing: 0.06,
                          textTransform: 'uppercase',
                          fontWeight: '700',
                          marginBottom: space.xs,
                        },
                      ]}
                    >
                      {slot === 'before' ? 'Before' : 'After'}
                    </Text>
                    <Pressable
                      onPress={() => setter(null)}
                      style={{
                        aspectRatio: 3 / 4,
                        borderRadius: radius.md,
                        overflow: 'hidden',
                        backgroundColor: t.surface2,
                      }}
                    >
                      {photo ? (
                        <>
                          <Image
                            source={{ uri: photo.signedUrl }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                          <View
                            style={{
                              position: 'absolute',
                              bottom: 4,
                              left: 4,
                              backgroundColor: 'rgba(0,0,0,0.5)',
                              borderRadius: 4,
                              paddingHorizontal: 4,
                              paddingVertical: 2,
                            }}
                          >
                            <Text
                              style={[
                                typo.caption2,
                                { color: '#FFFFFF' },
                              ]}
                            >
                              {formatPhotoDate(photo.taken_at)}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <View
                          style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons
                            name="image-outline"
                            size={32}
                            color={t.textTer}
                          />
                        </View>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <Text
              style={[
                typo.caption2,
                {
                  color: t.textTer,
                  letterSpacing: 0.06,
                  textTransform: 'uppercase',
                  fontWeight: '700',
                  marginTop: space.xl,
                  marginBottom: space.xs,
                },
              ]}
            >
              Pick photos
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.sm }}
            >
              {photos.map((photo) => {
                const isBefore = compareBefore?.id === photo.id;
                const isAfter = compareAfter?.id === photo.id;
                const sel = isBefore || isAfter;
                return (
                  <Pressable
                    key={photo.id}
                    onPress={() => {
                      if (isBefore) {
                        setCompareBefore(null);
                        return;
                      }
                      if (isAfter) {
                        setCompareAfter(null);
                        return;
                      }
                      if (!compareBefore) setCompareBefore(photo);
                      else setCompareAfter(photo);
                    }}
                    style={({ pressed }) => ({
                      width: 80,
                      aspectRatio: 3 / 4,
                      borderRadius: radius.md,
                      overflow: 'hidden',
                      borderWidth: sel ? 2 : 0,
                      borderColor: t.primary,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Image
                      source={{ uri: photo.signedUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                    {sel && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          backgroundColor: t.primary,
                          borderRadius: 999,
                          width: 18,
                          height: 18,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={[
                            typo.caption2,
                            { color: t.textOnPrim, fontWeight: '700' },
                          ]}
                        >
                          {isBefore ? 'B' : 'A'}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={() => setCompareOpen(false)}
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
              <Text style={[typo.headline, { color: t.textOnPrim }]}>
                Done
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={20}
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
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
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
            </ScrollView>
          </Pressable>
          </KeyboardAvoidingView>
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
