import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  Text,
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
import { radius, space, type as typo, useTheme } from '../lib/theme';
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

function MacroTile({
  label,
  value,
  color,
  big,
}: {
  label: string;
  value: string;
  color: string;
  big?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.surface2,
        borderRadius: radius.md,
        padding: space.md,
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
        {label}
      </Text>
      <Text
        style={[
          big ? typo.title2 : typo.headline,
          { color, marginTop: space.xs, fontVariant: ['tabular-nums'] },
        ]}
      >
        {value}
      </Text>
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
  saving,
}: {
  product: FoodSearchResult;
  onAdd: (quantity: number) => void;
  saving: boolean;
}) {
  const t = useTheme();
  const [quantity, setQuantity] = useState(1);
  const scaled = {
    cal: Math.round(product.calories * quantity),
    p: Math.round(product.protein_g * quantity),
    c: Math.round(product.carbs_g * quantity),
    f: Math.round(product.fat_g * quantity),
  };
  const quantityLabel = quantity % 1 === 0 ? String(quantity) : quantity.toFixed(1);
  return (
    <View>
      <DragHandle />
      <Text style={[typo.title3, { color: t.text, marginTop: space.lg }]}>
        {product.name}
      </Text>
      {!!product.brand && (
        <Text style={[typo.subhead, { color: t.textSec, marginTop: 2 }]}>
          {product.brand}
        </Text>
      )}

      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <MacroTile label="Calories" value={String(scaled.cal)} color={t.text} big />
          <MacroTile label="Protein" value={`${scaled.p}g`} color={t.protein} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <MacroTile label="Carbs" value={`${scaled.c}g`} color={t.carbs} />
          <MacroTile label="Fat" value={`${scaled.f}g`} color={t.fat} />
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: space.lg,
        }}
      >
        <Text style={[typo.body, { color: t.text }]}>Serving size</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <StepperBtn
            icon="remove"
            onPress={() => setQuantity((q) => Math.max(0.5, +(q - 0.5).toFixed(1)))}
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
            onPress={() => setQuantity((q) => Math.min(10, +(q + 0.5).toFixed(1)))}
          />
        </View>
      </View>

      <Pressable
        onPress={() => onAdd(quantity)}
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
          <Text style={[typo.headline, { color: t.textOnPrim }]}>Add to log</Text>
        )}
      </Pressable>
      <Pressable
        style={({ pressed }) => ({
          marginTop: space.md,
          alignItems: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={[typo.footnote, { color: t.textSec }]}>Wrong product?</Text>
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

  const handleAddToLog = async (quantity: number) => {
    if (!user || !scannedProduct || saving) return;
    setSaving(true);
    try {
      const scaledCalories = Math.round(scannedProduct.calories * quantity);
      await addFoodEntry({
        user_id: user.id,
        logged_at: new Date().toISOString(),
        name: scannedProduct.name,
        portion_description: `${quantity * scannedProduct.serving_size}${scannedProduct.serving_unit}`,
        quantity,
        unit: scannedProduct.serving_unit,
        calories: scaledCalories,
        protein_g: Math.round(scannedProduct.protein_g * quantity * 10) / 10,
        carbs_g: Math.round(scannedProduct.carbs_g * quantity * 10) / 10,
        fat_g: Math.round(scannedProduct.fat_g * quantity * 10) / 10,
        fiber_g: Math.round(scannedProduct.fiber_g * quantity * 10) / 10,
        sugar_g: Math.round(scannedProduct.sugar_g * quantity * 10) / 10,
        sodium_mg: Math.round(scannedProduct.sodium_mg * quantity),
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
