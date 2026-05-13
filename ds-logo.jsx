// ds-logo.jsx — BluCal locked brand assets.
// These three SVGs are the canonical mark — DO NOT modify the inner geometry.
// Wrappers only adjust outer size and (where the spec allows) stroke color
// for dark-mode / inactive states.

// ─── 1. App icon — full branded icon (splash, onboarding, hero) ─────────
function BluCalAppIcon({ size = 120, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none"
         xmlns="http://www.w3.org/2000/svg"
         style={{ display: 'block', ...style }}>
      <rect width="120" height="120" rx="28" fill="#185FA5"/>
      <circle cx="60" cy="60" r="32" stroke="white" strokeWidth="5.5" strokeLinecap="round" strokeDasharray="167 34" strokeDashoffset="25"/>
      <circle cx="60" cy="60" r="21" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="110 22" strokeDashoffset="17" opacity=".65"/>
      <circle cx="60" cy="60" r="10" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="52 10" strokeDashoffset="8" opacity=".35"/>
      <circle cx="60" cy="60" r="3.5" fill="white"/>
    </svg>
  );
}

// ─── 2. Wordmark — mini icon + "BluCal" (navs, welcome, settings) ───────
function BluCalWordmark({ width = 180, mode = 'light', style }) {
  // Aspect-locked at 180:44; text color flips to white in dark mode.
  const textColor = mode === 'dark' ? '#FFFFFF' : '#185FA5';
  const height = width * (44 / 180);
  return (
    <svg width={width} height={height} viewBox="0 0 180 44" fill="none"
         xmlns="http://www.w3.org/2000/svg"
         style={{ display: 'block', ...style }}>
      <rect width="44" height="44" rx="10" fill="#185FA5"/>
      <circle cx="22" cy="22" r="11.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeDasharray="60 12" strokeDashoffset="9"/>
      <circle cx="22" cy="22" r="7.5" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeDasharray="39 8" strokeDashoffset="6" opacity=".65"/>
      <circle cx="22" cy="22" r="3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="18 4" strokeDashoffset="3" opacity=".35"/>
      <circle cx="22" cy="22" r="1.5" fill="white"/>
      <text x="56" y="30"
            fontFamily="-apple-system, SF Pro Display, sans-serif"
            fontSize="22" fontWeight="500" letterSpacing="-0.5"
            fill={textColor}>BluCal</text>
    </svg>
  );
}

// ─── 3. Icon mark — standalone (tab bar, small) ─────────────────────────
// Default brand blue; pass `color="#8E8E93"` for inactive tab-bar state,
// or `color="#FFFFFF"` for dark-mode tab bar / on-color contexts.
function BluCalMark({ size = 28, color = '#185FA5', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none"
         xmlns="http://www.w3.org/2000/svg"
         style={{ display: 'block', ...style }}>
      <circle cx="30" cy="30" r="16" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray="83 17" strokeDashoffset="12"/>
      <circle cx="30" cy="30" r="10" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="55 11" strokeDashoffset="8" opacity=".6"/>
      <circle cx="30" cy="30" r="2" fill={color}/>
    </svg>
  );
}

// Back-compat alias: existing screens reference <BluCalLogo /> → app icon.
const BluCalLogo = BluCalAppIcon;

Object.assign(window, { BluCalAppIcon, BluCalWordmark, BluCalMark, BluCalLogo });

