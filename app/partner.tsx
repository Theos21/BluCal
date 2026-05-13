import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { radius, space, type as typo, useTheme, type Theme } from '../lib/theme';
import Toast from '../components/Toast';
import { useToast } from '../lib/useToast';

// TODO: replace with real data from Supabase
const PARTNER_NAME = 'Alex Johnson';
const PARTNER_INITIALS = 'AJ';
const NUDGES = ['Keep going!', 'Great week!', 'Check in'];
const STEPS = [
  'Invite a friend using a link or their BluCal username.',
  'They accept and you are connected as partners.',
  "Each week you both see a summary of the other's progress: calories, weight trend, and momentum score. No individual meals, no exact weights.",
];

// ── Subcomponents ────────────────────────────────────────────────────────────
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
        },
      ]}
    >
      {children}
    </Text>
  );
}

function StatRow({
  label,
  value,
  t,
}: {
  label: string;
  value: string;
  t: Theme;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
      }}
    >
      <Text style={[typo.subhead, { color: t.textSec }]}>{label}</Text>
      <Text style={[typo.subhead, { color: t.text }]}>{value}</Text>
    </View>
  );
}

function Separator({ t }: { t: Theme }) {
  return (
    <View
      style={{
        height: 0.5,
        backgroundColor: t.hairline,
        marginVertical: space.md,
      }}
    />
  );
}

function PrivacyNote({ t }: { t: Theme }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: t.surface2,
        borderRadius: radius.lg,
        padding: space.md,
        marginHorizontal: space.lg,
        marginTop: space.xl,
      }}
    >
      <Ionicons
        name="shield-checkmark-outline"
        size={16}
        color={t.textTer}
        style={{ marginTop: 2 }}
      />
      <Text style={[typo.footnote, { color: t.textTer, flex: 1 }]}>
        Your individual meals and exact weight are never shared.
      </Text>
    </View>
  );
}

// ── How it works bottom sheet ────────────────────────────────────────────────
function HowItWorksSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

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
            padding: space.xl,
            paddingBottom: insets.bottom + space.lg,
          }}
        >
          <Text style={[typo.title3, { color: t.text }]}>How it works</Text>

          <View style={{ marginTop: space.lg }}>
            {STEPS.map((step, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: space.md,
                  marginBottom: space.md,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: t.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={[
                      typo.subheadEm,
                      { color: t.primary },
                    ]}
                  >
                    {i + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    typo.subhead,
                    { color: t.text, flex: 1 },
                  ]}
                >
                  {step}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              marginTop: space.md,
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: t.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={[typo.headline, { color: t.textOnPrim }]}>
              Got it
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function Partner() {
  const t = useTheme();
  // TODO: replace with real data from Supabase
  const [hasPartner, setHasPartner] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [nudgeCooldown, setNudgeCooldown] = useState(false);
  const toast = useToast();

  const sendNudge = () => {
    if (nudgeCooldown) return;
    toast.show('Nudge sent to Alex!');
    setNudgeCooldown(true);
    setTimeout(() => setNudgeCooldown(false), 3000);
  };

  const handleInvite = () => {
    Alert.alert(
      'Coming soon',
      'Partner invites will be available once your account is set up.',
    );
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect partner?',
      `${PARTNER_NAME} will no longer see your weekly summary.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => setHasPartner(false),
        },
      ],
    );
  };

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
            Accountability partner
          </Text>
          <Text
            style={[typo.subhead, { color: t.textSec, marginTop: 2 }]}
          >
            Train together.
          </Text>
        </View>

        {hasPartner ? (
          // ── State 2 — partner connected ─────────────────────────────────
          <>
            <View
              style={{
                marginHorizontal: space.lg,
                marginTop: space.xl,
                backgroundColor: t.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: t.hairline,
                padding: space.lg,
              }}
            >
              {/* Avatar / name / badge row */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: t.teal,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={[typo.headline, { color: t.textOnPrim }]}
                  >
                    {PARTNER_INITIALS}
                  </Text>
                </View>
                <Text
                  style={[
                    typo.headline,
                    { color: t.text, flex: 1 },
                  ]}
                  numberOfLines={1}
                >
                  {PARTNER_NAME}
                </Text>
                <View
                  style={{
                    backgroundColor: t.successSoft,
                    borderRadius: radius.pill,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={[
                      typo.caption2,
                      { color: t.success, fontWeight: '700' },
                    ]}
                  >
                    Connected
                  </Text>
                </View>
              </View>

              <Separator t={t} />

              <SectionLabel>Their week</SectionLabel>
              <View style={{ marginTop: space.xs }}>
                <StatRow label="Momentum score" value="78" t={t} />
                <StatRow label="Calorie avg" value="2,100 kcal" t={t} />
                <StatRow label="Weight trend" value="Stable" t={t} />
              </View>

              <Separator t={t} />

              <Text style={[typo.subhead, { color: t.text }]}>
                Send a nudge
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: space.sm,
                  marginTop: space.sm,
                }}
              >
                {NUDGES.map((label) => (
                  <Pressable
                    key={label}
                    onPress={sendNudge}
                    disabled={nudgeCooldown}
                    style={({ pressed }) => ({
                      backgroundColor: t.surface2,
                      borderRadius: radius.pill,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      opacity: nudgeCooldown ? 0.4 : pressed ? 0.6 : 1,
                    })}
                  >
                    <Text
                      style={[
                        typo.footnote,
                        { color: t.textSec },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Disconnect button */}
            <Pressable
              onPress={handleDisconnect}
              style={({ pressed }) => ({
                marginHorizontal: space.lg,
                marginTop: space.md,
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
              <Ionicons name="trash-outline" size={18} color={t.danger} />
              <Text style={[typo.subheadEm, { color: t.danger }]}>
                Disconnect partner
              </Text>
            </Pressable>
          </>
        ) : (
          // ── State 1 — no partner ────────────────────────────────────────
          <View
            style={{
              alignItems: 'center',
              paddingHorizontal: space.xl,
              marginTop: space.xxxl,
            }}
          >
            <View
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: t.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="people-outline" size={56} color={t.textTer} />
            </View>
            <Text
              style={[
                typo.title2,
                {
                  color: t.text,
                  marginTop: space.xl,
                  textAlign: 'center',
                },
              ]}
            >
              Train together
            </Text>
            <Text
              style={[
                typo.subhead,
                {
                  color: t.textSec,
                  textAlign: 'center',
                  marginTop: space.sm,
                },
              ]}
            >
              Invite a friend to see your weekly progress. They see your
              summary, not your individual meals.
            </Text>
            <Pressable
              onPress={handleInvite}
              style={({ pressed }) => ({
                alignSelf: 'stretch',
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
                Invite a partner
              </Text>
            </Pressable>
            <Pressable
              hitSlop={6}
              onPress={() => setInfoOpen(true)}
              style={({ pressed }) => ({
                marginTop: space.lg,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[typo.subhead, { color: t.primary }]}>
                How does it work?
              </Text>
            </Pressable>
          </View>
        )}

        <PrivacyNote t={t} />
      </ScrollView>

      <HowItWorksSheet
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />

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
