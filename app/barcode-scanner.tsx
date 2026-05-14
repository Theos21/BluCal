import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { radius, space, type as typo, useTheme, type Theme } from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';
import { useAuth } from '../lib/AuthContext';
import { addFoodEntry } from '../lib/db';
import { lookupBarcode, type FoodSearchResult } from '../lib/foodSearch';
import { sessionState } from '../lib/sessionState';

const FRAME_W = 260;
const FRAME_H = 180;
const CORNER_LEN = 24;
const CORNER_STROKE = 3;
const CONTROL_SIZE = 40;

// Camera-overlay specific colors. These sit on top of a live camera feed and
// are independent of the app theme — no theme tokens exist for them.
const OVERLAY_COLOR = 'rgba(0,0,0,0.6)';
const CONTROL_BG = 'rgba(0,0,0,0.5)';

const formatFoodName = (name: string): string => {
  if (!name) return '';
  if (name === name.toUpperCase()) {
    return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatBrandName = (brand: string | null | undefined): string | null => {
  if (!brand) return null;
  const first = brand.split(',')[0].trim();
  if (!first) return null;
  if (first === first.toUpperCase()) {
    return first.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return first.replace(/\b\w/g, (c) => c.toUpperCase());
};

type FoodIconKind = 'protein' | 'fat' | 'carb' | 'default';

const getFoodIconKind = (
  cal: number,
  p: number,
  c: number,
  f: number,
): FoodIconKind => {
  if (p > 15 && p * 4 > cal * 0.3) return 'protein';
  if (f > 15 || cal > 400) return 'fat';
  if (c > 30) return 'carb';
  return 'default';
};

const getFoodIcon = (
  kind: FoodIconKind,
  t: Theme,
): { name: keyof typeof Ionicons.glyphMap; color: string; bg: string } => {
  switch (kind) {
    case 'protein':
      return { name: 'barbell-outline', color: t.primary, bg: t.primarySoft };
    case 'fat':
      return { name: 'flame-outline', color: t.warn, bg: t.warnSoft };
    case 'carb':
      return { name: 'leaf-outline', color: t.teal, bg: t.tealSoft };
    default:
      return {
        name: 'nutrition-outline',
        color: t.primary,
        bg: t.primarySoft,
      };
  }
};

type ServingUnit = 'serving' | 'g' | 'oz';

type AddPayload = {
  unit: ServingUnit;
  qty: number;
  scaled: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
  };
};

function Corner({
  corner,
  color,
}: {
  corner: 'tl' | 'tr' | 'bl' | 'br';
  color: string;
}) {
  const isTop = corner === 'tl' || corner === 'tr';
  const isLeft = corner === 'tl' || corner === 'bl';
  const base = {
    position: 'absolute' as const,
    top: isTop ? 0 : undefined,
    bottom: !isTop ? 0 : undefined,
    left: isLeft ? 0 : undefined,
    right: !isLeft ? 0 : undefined,
    backgroundColor: color,
    borderRadius: 3,
  };
  return (
    <>
      <View style={{ ...base, width: CORNER_LEN, height: CORNER_STROKE }} />
      <View style={{ ...base, width: CORNER_STROKE, height: CORNER_LEN }} />
    </>
  );
}

function MacroPill({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Text style={[typo.caption2, { color, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

function StepperBtn({
  icon,
  onPress,
}: {
  icon: 'remove' | 'add';
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: t.surface2,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={t.textSec} />
    </Pressable>
  );
}

function DragHandle() {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 36,
          height: 4,
          borderRadius: 999,
          backgroundColor: t.surface3,
        }}
      />
    </View>
  );
}

function FoundSheetContent({
  product,
  onAdd,
  onWrongProduct,
  saving,
}: {
  product: FoodSearchResult;
  onAdd: (payload: AddPayload) => void;
  onWrongProduct: () => void;
  saving: boolean;
}) {
  const t = useTheme();
  const [quantity, setQuantity] = useState(1);
  const [servingUnit, setServingUnit] = useState<ServingUnit>('serving');
  const [customGrams, setCustomGrams] = useState('');

  const getScaledMacros = (qty: number, unit: ServingUnit) => {
    if (unit === 'serving') {
      return {
        calories: Math.round(product.calories * qty),
        protein: Math.round(product.protein_g * qty * 10) / 10,
        carbs: Math.round(product.carbs_g * qty * 10) / 10,
        fat: Math.round(product.fat_g * qty * 10) / 10,
        fiber: Math.round(product.fiber_g * qty * 10) / 10,
        sugar: Math.round(product.sugar_g * qty * 10) / 10,
        sodium: Math.round(product.sodium_mg * qty),
      };
    }
    const grams = unit === 'oz' ? qty * 28.3495 : qty;
    const factor = grams / product.serving_size;
    return {
      calories: Math.round(product.calories * factor),
      protein: Math.round(product.protein_g * factor * 10) / 10,
      carbs: Math.round(product.carbs_g * factor * 10) / 10,
      fat: Math.round(product.fat_g * factor * 10) / 10,
      fiber: Math.round(product.fiber_g * factor * 10) / 10,
      sugar: Math.round(product.sugar_g * factor * 10) / 10,
      sodium: Math.round(product.sodium_mg * factor),
    };
  };

  const qty =
    servingUnit === 'serving' ? quantity : Number(customGrams) || 100;
  const scaled = getScaledMacros(qty, servingUnit);

  const displayName = formatFoodName(product.name);
  const displayBrand = formatBrandName(product.brand);
  const cleanName =
    displayBrand &&
    displayName.toLowerCase().startsWith(displayBrand.toLowerCase())
      ? displayName.slice(displayBrand.length).trim()
      : displayName;
  const finalName = cleanName || displayName;

  const iconKind = getFoodIconKind(
    product.calories,
    product.protein_g,
    product.carbs_g,
    product.fat_g,
  );
  const icon = getFoodIcon(iconKind, t);

  const quantityLabel =
    quantity % 1 === 0 ? String(quantity) : quantity.toFixed(1);

  return (
    <View>
      <DragHandle />

      {/* Header: icon bubble + name + brand */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginTop: space.lg,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: icon.bg,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Ionicons name={icon.name} size={28} color={icon.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typo.title3, { color: t.text }]} numberOfLines={2}>
            {finalName}
          </Text>
          {displayBrand && (
            <Text
              style={[typo.subhead, { color: t.textSec, marginTop: 2 }]}
              numberOfLines={1}
            >
              {displayBrand}
            </Text>
          )}
        </View>
      </View>

      {/* Macro pills */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: space.lg,
        }}
      >
        <MacroPill
          label={`${scaled.calories} cal`}
          bg={t.surface2}
          color={t.textSec}
        />
        <MacroPill
          label={`${Math.round(scaled.protein)}g P`}
          bg={t.primarySoft}
          color={t.primary}
        />
        <MacroPill
          label={`${Math.round(scaled.carbs)}g C`}
          bg={t.warnSoft}
          color={t.warn}
        />
        <MacroPill
          label={`${Math.round(scaled.fat)}g F`}
          bg={t.tealSoft}
          color={t.teal}
        />
      </View>

      {/* Per-serving info */}
      <Text
        style={[typo.caption1, { color: t.textTer, marginTop: space.md }]}
      >
        Per serving ({product.serving_size}
        {product.serving_unit})
      </Text>

      {/* Unit selector */}
      <View
        style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}
      >
        {(['serving', 'g', 'oz'] as const).map((unit) => (
          <Pressable
            key={unit}
            onPress={() => setServingUnit(unit)}
            style={({ pressed }) => ({
              paddingHorizontal: space.md,
              paddingVertical: space.xs,
              borderRadius: radius.pill,
              backgroundColor:
                servingUnit === unit ? t.primary : t.surface2,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={[
                typo.caption1,
                {
                  color: servingUnit === unit ? t.textOnPrim : t.textSec,
                  fontWeight: '600',
                },
              ]}
            >
              {unit === 'serving' ? 'serving' : unit}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Quantity control */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: space.lg,
        }}
      >
        <Text style={[typo.body, { color: t.text }]}>
          {servingUnit === 'serving' ? 'Servings' : `Amount (${servingUnit})`}
        </Text>
        {servingUnit === 'serving' ? (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <StepperBtn
              icon="remove"
              onPress={() =>
                setQuantity((q) => Math.max(0.5, +(q - 0.5).toFixed(1)))
              }
            />
            <Text
              style={[
                typo.headline,
                {
                  color: t.text,
                  minWidth: 32,
                  textAlign: 'center',
                  fontVariant: ['tabular-nums'],
                },
              ]}
            >
              {quantityLabel}
            </Text>
            <StepperBtn
              icon="add"
              onPress={() =>
                setQuantity((q) => Math.min(10, +(q + 0.5).toFixed(1)))
              }
            />
          </View>
        ) : (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
          >
            <TextInput
              style={[
                typo.title2,
                {
                  color: t.text,
                  backgroundColor: t.surface2,
                  borderRadius: radius.md,
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  minWidth: 90,
                  textAlign: 'center',
                },
              ]}
              keyboardType="numeric"
              value={customGrams}
              onChangeText={setCustomGrams}
              placeholder="100"
              placeholderTextColor={t.textTer}
            />
            <Text style={[typo.subhead, { color: t.textSec }]}>
              {servingUnit}
            </Text>
          </View>
        )}
      </View>

      <Pressable
        onPress={() => onAdd({ unit: servingUnit, qty, scaled })}
        disabled={saving}
        style={({ pressed }) => ({
          marginTop: space.xl,
          height: 52,
          borderRadius: radius.lg,
          backgroundColor: t.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: saving ? 0.6 : pressed ? 0.85 : 1,
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
      <Pressable
        onPress={onWrongProduct}
        style={({ pressed }) => ({
          marginTop: space.md,
          alignItems: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={[typo.footnote, { color: t.textSec }]}>
          Wrong product?
        </Text>
      </Pressable>
    </View>
  );
}

function NotFoundSheetContent({
  barcode,
  onRetry,
}: {
  barcode: string;
  onRetry: () => void;
}) {
  const t = useTheme();
  return (
    <View>
      <DragHandle />
      <Text style={[typo.headline, { color: t.text, marginTop: space.lg }]}>
        Product not found
      </Text>
      <Text style={[typo.caption1, { color: t.textTer, marginTop: 2 }]}>
        {barcode}
      </Text>
      <Pressable
        onPress={() => router.replace('/custom-food')}
        style={({ pressed }) => ({
          marginTop: space.xl,
          height: 48,
          borderRadius: radius.lg,
          backgroundColor: t.surface2,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={[typo.headline, { color: t.text }]}>Add it manually</Text>
      </Pressable>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => ({
          marginTop: space.md,
          alignItems: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={[typo.footnote, { color: t.primary }]}>
          Try scanning again
        </Text>
      </Pressable>
    </View>
  );
}

export default function BarcodeScanner() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const toast = useToast();
  const { user } = useAuth();

  const [torchOn, setTorchOn] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<FoodSearchResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [lastBarcode, setLastBarcode] = useState<string>('');
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);

  const sheetY = useRef(new Animated.Value(screenH)).current;
  const sheetVisible = scannedProduct !== null || notFound;

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    Animated.spring(sheetY, {
      toValue: sheetVisible ? 0 : screenH,
      useNativeDriver: true,
      friction: 9,
      tension: 60,
    }).start();
  }, [sheetVisible, sheetY, screenH]);

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    const { data } = result;
    if (lookingUp || scannedProduct || notFound) return;
    setLookingUp(true);
    setLastBarcode(data);
    try {
      const product = await lookupBarcode(data);
      if (product) {
        setScannedProduct(product);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLookingUp(false);
    }
  };

  const handleRetry = () => {
    setNotFound(false);
    setScannedProduct(null);
    setLookingUp(false);
    setLastBarcode('');
  };

  const handleWrongProduct = () => {
    setScannedProduct(null);
    setNotFound(false);
    setLookingUp(false);
  };

  const handleAddToLog = async (payload: AddPayload) => {
    if (!user || !scannedProduct || saving) return;
    setSaving(true);
    try {
      const { unit, qty, scaled } = payload;
      const grams = unit === 'oz' ? Math.round(qty * 28.3495) : qty;
      const portion =
        unit === 'serving'
          ? `${qty} serving${qty !== 1 ? 's' : ''} (${qty * scannedProduct.serving_size}${scannedProduct.serving_unit})`
          : unit === 'g'
            ? `${qty}g`
            : `${qty}oz (${grams}g)`;
      await addFoodEntry({
        user_id: user.id,
        logged_at: new Date().toISOString(),
        name: scannedProduct.name,
        portion_description: portion,
        quantity: qty,
        unit,
        calories: scaled.calories,
        protein_g: scaled.protein,
        carbs_g: scaled.carbs,
        fat_g: scaled.fat,
        fiber_g: scaled.fiber,
        sugar_g: scaled.sugar,
        sodium_mg: scaled.sodium,
        saturated_fat_g: 0,
        cholesterol_mg: 0,
        food_database_id: scannedProduct.id,
        barcode: scannedProduct.barcode,
        source: 'barcode',
      });
      sessionState.setJustLoggedFood(scannedProduct.name);
      toast.show(`Added: ${scannedProduct.name}`, 'success');
      setTimeout(() => router.back(), 1200);
    } catch {
      toast.show('Could not add food. Try again.', 'error');
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
          Camera access is needed to scan barcodes
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

  const frameTop = (screenH - FRAME_H) / 2;
  const frameLeft = (screenW - FRAME_W) / 2;
  const sideStripW = (screenW - FRAME_W) / 2;
  const verticalStripH = (screenH - FRAME_H) / 2;

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13',
            'ean8',
            'upc_a',
            'upc_e',
            'code128',
            'code39',
            'qr',
          ],
        }}
        onBarcodeScanned={sheetVisible || lookingUp ? undefined : handleBarcodeScanned}
      />

      {/* dark overlay strips around the frame */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: verticalStripH,
          backgroundColor: OVERLAY_COLOR,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: verticalStripH,
          backgroundColor: OVERLAY_COLOR,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: verticalStripH,
          left: 0,
          width: sideStripW,
          height: FRAME_H,
          backgroundColor: OVERLAY_COLOR,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: verticalStripH,
          right: 0,
          width: sideStripW,
          height: FRAME_H,
          backgroundColor: OVERLAY_COLOR,
        }}
      />

      {/* scan frame corner brackets */}
      <View
        style={{
          position: 'absolute',
          top: frameTop,
          left: frameLeft,
          width: FRAME_W,
          height: FRAME_H,
        }}
      >
        <Corner corner="tl" color={t.textOnPrim} />
        <Corner corner="tr" color={t.textOnPrim} />
        <Corner corner="bl" color={t.textOnPrim} />
        <Corner corner="br" color={t.textOnPrim} />
      </View>

      {/* instruction text */}
      <Text
        style={[
          typo.subhead,
          {
            position: 'absolute',
            top: frameTop + FRAME_H + 24,
            left: 0,
            right: 0,
            textAlign: 'center',
            color: t.textOnPrim,
          },
        ]}
      >
        Point at any barcode
      </Text>

      {/* close button (top-left) */}
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => ({
          position: 'absolute',
          top: insets.top + space.sm,
          left: space.lg,
          width: CONTROL_SIZE,
          height: CONTROL_SIZE,
          borderRadius: CONTROL_SIZE / 2,
          backgroundColor: CONTROL_BG,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons name="close" size={22} color={t.textOnPrim} />
      </Pressable>

      {/* torch button (top-right) */}
      <Pressable
        onPress={() => setTorchOn((v) => !v)}
        style={({ pressed }) => ({
          position: 'absolute',
          top: insets.top + space.sm,
          right: space.lg,
          width: CONTROL_SIZE,
          height: CONTROL_SIZE,
          borderRadius: CONTROL_SIZE / 2,
          backgroundColor: CONTROL_BG,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Ionicons
          name={torchOn ? 'flashlight' : 'flashlight-outline'}
          size={22}
          color={t.textOnPrim}
        />
      </Pressable>

      {/* lookup overlay */}
      {lookingUp && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: CONTROL_BG,
              borderRadius: radius.lg,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
            }}
          >
            <ActivityIndicator color={t.textOnPrim} />
            <Text style={[typo.subhead, { color: t.textOnPrim }]}>
              Looking up barcode…
            </Text>
          </View>
        </View>
      )}

      {/* bottom sheet */}
      <Animated.View
        pointerEvents={sheetVisible ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: t.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 20,
          paddingBottom: insets.bottom + 20,
          transform: [{ translateY: sheetY }],
        }}
      >
        {scannedProduct && (
          <FoundSheetContent
            product={scannedProduct}
            onAdd={handleAddToLog}
            onWrongProduct={handleWrongProduct}
            saving={saving}
          />
        )}
        {!scannedProduct && notFound && (
          <NotFoundSheetContent barcode={lastBarcode} onRetry={handleRetry} />
        )}
      </Animated.View>

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
