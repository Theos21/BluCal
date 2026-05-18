import Svg, { Circle } from 'react-native-svg';

interface LogoMarkProps {
  size: number;
  color: string;
}

// Concentric dashed rings — the BluCal app mark. Shared by the welcome
// screen and the cold-boot loading/splash screen so both render identically.
export function LogoMark({ size, color }: LogoMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Circle
        cx={40}
        cy={40}
        r={32}
        stroke={color}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeDasharray="167 34"
        strokeDashoffset={25}
        fill="none"
      />
      <Circle
        cx={40}
        cy={40}
        r={21}
        stroke={color}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeDasharray="110 22"
        strokeDashoffset={17}
        strokeOpacity={0.65}
        fill="none"
      />
      <Circle
        cx={40}
        cy={40}
        r={10}
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeDasharray="52 10"
        strokeDashoffset={8}
        strokeOpacity={0.35}
        fill="none"
      />
      <Circle cx={40} cy={40} r={3.5} fill={color} />
    </Svg>
  );
}
