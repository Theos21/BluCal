import { Text, View } from 'react-native';
import { useTheme } from '../lib/theme';

interface BluCalWordmarkProps {
  size?: number;
  onDark?: boolean;
}

export const BluCalWordmark = ({
  size = 24,
  onDark = false,
}: BluCalWordmarkProps) => {
  const t = useTheme();
  const calColor = onDark ? 'rgba(255,255,255,0.65)' : t.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text
        style={{
          fontSize: size,
          fontWeight: '800',
          letterSpacing: -0.5,
          color: onDark ? '#FFFFFF' : t.primary,
        }}
      >
        Blu
      </Text>
      <Text
        style={{
          fontSize: size,
          fontWeight: '800',
          letterSpacing: -0.5,
          color: calColor,
        }}
      >
        Cal
      </Text>
    </View>
  );
};
