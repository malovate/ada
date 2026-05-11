// ============================================================
// src/components/AdaFace.jsx — Ada's Animated Portrait
// ============================================================
// This is Ada's face. A hand-crafted SVG illustration that
// animates based on what Ada is currently doing.
//
// FOUR STATES:
//   'idle'      → resting. Slow breath. Occasional blink.
//   'listening' → alert. Pulsing outer ring. Eyes open wide.
//   'thinking'  → processing. Eyes shift. Inner glow flickers.
//   'speaking'  → lips animate. Warm glow pulses with her voice.
//
// WHY SVG?
//   SVG (Scalable Vector Graphics) is pure math — shapes defined
//   by coordinates, not pixels. It's infinitely sharp on any
//   screen size. No image file needed. No copyright issues.
//   And we can animate every single element with CSS/JS.
//
// HOW ANIMATION WORKS HERE:
//   CSS @keyframes define looping animations (breathe, blink, pulse).
//   We apply different animations to elements based on the 'state' prop.
//   React re-renders the component when state changes — the new
//   CSS class kicks in and the animation transitions.
// ============================================================

import { useEffect, useRef, useState } from 'react';

// ── AdaFace Component ─────────────────────────────────────────
// Props:
//   state  → 'idle' | 'listening' | 'thinking' | 'speaking'
//   mood   → string like "quietly curious" (affects glow color)
export default function AdaFace({ state = 'idle', mood = 'curious' }) {

  const [blinkState, setBlinkState] = useState(false);
  // Controls whether eyes are blinked closed.
  // We trigger blinks on a timer — irregular, like a real person.

  const [mouthOpen, setMouthOpen] = useState(0);
  // 0 = fully closed, 1 = slightly open, 2 = more open.
  // Cycles while speaking.

  const blinkTimerRef = useRef(null);
  const mouthTimerRef = useRef(null);


  // ── Blink controller ──────────────────────────────────────
  // useEffect re-runs when 'state' changes.
  // We set up a blink interval — irregular timing (2–6 seconds)
  // makes it feel human rather than mechanical.
  useEffect(() => {
    // Clear any existing blink timer before setting a new one.
    if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);

    function scheduleBlink() {
      // Random interval between 2000ms and 6000ms.
      // Math.random() → 0.0 to 1.0
      // * 4000 → 0 to 4000
      // + 2000 → 2000 to 6000
      const delay = Math.random() * 4000 + 2000;

      blinkTimerRef.current = setTimeout(() => {
        // Blink: close eyes for 120ms then reopen.
        setBlinkState(true);
        setTimeout(() => setBlinkState(false), 120);
        scheduleBlink(); // Schedule the next blink after this one.
      }, delay);
    }

    // Don't blink while speaking — looks unnatural.
    if (state !== 'speaking') {
      scheduleBlink();
    }

    // Cleanup: clear timer when component unmounts or state changes.
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, [state]);


  // ── Mouth animation controller ────────────────────────────
  // Cycles mouth through open/close pattern while speaking.
  useEffect(() => {
    if (mouthTimerRef.current) clearInterval(mouthTimerRef.current);

    if (state === 'speaking') {
      let phase = 0;
      // setInterval fires every X ms. We cycle through mouth positions.
      mouthTimerRef.current = setInterval(() => {
        // Sine wave pattern: creates natural open/close rhythm.
        // Math.sin() returns -1 to 1. We map that to 0, 1, 2.
        const openness = Math.floor((Math.sin(phase) + 1) * 1.2);
        setMouthOpen(Math.max(0, Math.min(2, openness)));
        phase += 0.4; // Controls speed of mouth movement
      }, 80); // Update every 80ms — fast enough to look smooth
    } else {
      setMouthOpen(0); // Mouth closed when not speaking
    }

    return () => {
      if (mouthTimerRef.current) clearInterval(mouthTimerRef.current);
    };
  }, [state]);


  // ── Mood → glow color ─────────────────────────────────────
  // Ada's glow color shifts subtly with her mood.
  function getGlowColor() {
    const m = mood.toLowerCase();
    if (m.includes('curious'))    return '#9370db';   // purple
    if (m.includes('excited'))    return '#f0a500';   // amber
    if (m.includes('melanchol'))  return '#4a6fa5';   // blue
    if (m.includes('warm'))       return '#e8806a';   // warm coral
    if (m.includes('playful'))    return '#5cbf8a';   // green
    if (m.includes('restless'))   return '#c05070';   // rose
    return '#9370db'; // default purple
  }

  const glowColor = getGlowColor();

  // ── Lip path based on mouth state ─────────────────────────
  // SVG path 'd' attribute draws the lip shape.
  // 'M' = move to, 'Q' = quadratic bezier curve, 'L' = line to.
  // We switch between three shapes: closed, slightly open, open.
  const lipPaths = {
    // Upper lip shape
    upper: "M 170 310 Q 200 305 230 310",
    // Lower lip — shifts downward as mouth opens
    lower: [
      "M 170 314 Q 200 316 230 314",  // 0: closed (lips nearly touching)
      "M 170 316 Q 200 322 230 316",  // 1: slightly open
      "M 170 318 Q 200 330 230 318",  // 2: more open
    ]
  };


  // ── State-specific animation class ────────────────────────
  // We apply different CSS animation to the outer ring based on state.
  const ringAnimation = {
    idle:      'ring-idle',
    listening: 'ring-listening',
    thinking:  'ring-thinking',
    speaking:  'ring-speaking',
  }[state] || 'ring-idle';


  return (
    <div style={styles.wrapper}>

      {/* Inject CSS animations as a <style> tag.
          In a full app we'd put this in global.css, but keeping it
          here makes this component fully self-contained — drop it
          anywhere and it works. */}
      <style>{`
        /* Outer ring animations */
        @keyframes ring-idle {
          0%, 100% { opacity: 0.25; r: 195; }
          50%       { opacity: 0.40; r: 198; }
        }
        @keyframes ring-listening {
          0%, 100% { opacity: 0.6; r: 192; }
          50%       { opacity: 1.0; r: 200; }
        }
        @keyframes ring-thinking {
          0%   { opacity: 0.4; r: 193; stroke-dashoffset: 0; }
          100% { opacity: 0.7; r: 197; stroke-dashoffset: -60; }
        }
        @keyframes ring-speaking {
          0%, 100% { opacity: 0.5; r: 192; }
          25%       { opacity: 0.9; r: 198; }
          75%       { opacity: 0.7; r: 195; }
        }

        /* Subtle face breathing — the whole face scales very slightly */
        @keyframes breathe {
          0%, 100% { transform: scale(1);     }
          50%       { transform: scale(1.008); }
        }

        /* Thinking: pupils drift slightly left-right */
        @keyframes think-eyes {
          0%, 100% { transform: translateX(0px);  }
          33%       { transform: translateX(-3px); }
          66%       { transform: translateX(3px);  }
        }

        /* Starfield particles drift upward */
        @keyframes drift {
          0%   { opacity: 0;   transform: translateY(0px);   }
          20%  { opacity: 0.6;                               }
          100% { opacity: 0;   transform: translateY(-40px); }
        }

        .face-group {
          animation: breathe 4s ease-in-out infinite;
          transform-origin: 200px 260px;
        }

        .eye-pupils {
          animation: ${state === 'thinking' ? 'think-eyes 3s ease-in-out infinite' : 'none'};
        }

        .outer-ring {
          animation: ${ringAnimation} 2s ease-in-out infinite;
        }

        /* Particle drift animations with staggered delays */
        .p1 { animation: drift 4s ease-in infinite 0.0s; }
        .p2 { animation: drift 4s ease-in infinite 0.8s; }
        .p3 { animation: drift 4s ease-in infinite 1.6s; }
        .p4 { animation: drift 4s ease-in infinite 2.4s; }
        .p5 { animation: drift 4s ease-in infinite 3.2s; }
      `}</style>

      {/* ── The SVG Portrait ── */}
      <svg
        viewBox="0 0 400 520"
        xmlns="http://www.w3.org/2000/svg"
        style={styles.svg}
        aria-label="Ada"
      >
        {/* ── Definitions: gradients, filters ── */}
        <defs>

          {/* Radial gradient for the background glow */}
          <radialGradient id="bgGlow" cx="50%" cy="45%" r="50%">
            <stop offset="0%"   stopColor={glowColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0a0a0f"   stopOpacity="0" />
          </radialGradient>

          {/* Face skin gradient — slightly luminous, not flat */}
          <radialGradient id="skinGrad" cx="45%" cy="35%" r="65%">
            <stop offset="0%"   stopColor="#2a1f3d" />
            <stop offset="60%"  stopColor="#1a1228" />
            <stop offset="100%" stopColor="#0e0b18" />
          </radialGradient>

          {/* Iris gradient — depth in the eyes */}
          <radialGradient id="irisGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%"   stopColor="#c8a8ff" />
            <stop offset="40%"  stopColor={glowColor} />
            <stop offset="100%" stopColor="#1a0a2e" />
          </radialGradient>

          {/* Soft glow filter — applied to eyes and lips */}
          <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Stronger glow for the outer ring */}
          <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Hair gradient */}
          <linearGradient id="hairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#1a0e2e" />
            <stop offset="100%" stopColor="#0a0812" />
          </linearGradient>

        </defs>

        {/* ── Background ── */}
        <rect width="400" height="520" fill="#0a0a0f" />

        {/* Background glow behind Ada */}
        <ellipse cx="200" cy="260" rx="180" ry="200" fill="url(#bgGlow)" />

        {/* ── Floating particles (starfield feel) ── */}
        <circle className="p1" cx="80"  cy="420" r="1.5" fill={glowColor} opacity="0" />
        <circle className="p2" cx="320" cy="380" r="1"   fill={glowColor} opacity="0" />
        <circle className="p3" cx="140" cy="460" r="1"   fill="#c8b8f8"   opacity="0" />
        <circle className="p4" cx="280" cy="440" r="1.5" fill={glowColor} opacity="0" />
        <circle className="p5" cx="200" cy="480" r="1"   fill="#c8b8f8"   opacity="0" />

        {/* ── Outer ring — state indicator ── */}
        <circle
          className="outer-ring"
          cx="200" cy="245"
          r="195"
          fill="none"
          stroke={glowColor}
          strokeWidth="1.5"
          strokeDasharray="12 8"
          filter="url(#ringGlow)"
        />
        {/* strokeDasharray="12 8" creates a dashed circle.
            "12" = length of each dash, "8" = gap between dashes.
            The ring-thinking animation rotates the dashoffset,
            making it appear to spin during thinking. */}

        {/* ── Face group — everything that breathes together ── */}
        <g className="face-group">

          {/* ── Hair (back layer — behind face) ── */}
          {/* Long flowing hair silhouette */}
          <ellipse cx="200" cy="180" rx="108" ry="125"
            fill="url(#hairGrad)" />
          {/* Hair sides falling down */}
          <path d="M 100 200 Q 75 300 85 420 Q 95 460 110 480 Q 95 400 100 300 Q 100 250 108 220"
            fill="url(#hairGrad)" />
          <path d="M 300 200 Q 325 300 315 420 Q 305 460 290 480 Q 305 400 300 300 Q 300 250 292 220"
            fill="url(#hairGrad)" />
          {/* Hair top highlights */}
          <path d="M 130 100 Q 200 75 270 100 Q 230 82 200 80 Q 170 82 130 100"
            fill="#2a1840" opacity="0.5" />

          {/* ── Neck ── */}
          <path d="M 175 370 Q 175 420 170 450 Q 200 455 230 450 Q 225 420 225 370 Q 210 378 200 378 Q 190 378 175 370"
            fill="url(#skinGrad)" />

          {/* ── Face oval ── */}
          <ellipse cx="200" cy="255" rx="100" ry="125"
            fill="url(#skinGrad)" />

          {/* Subtle cheek highlight */}
          <ellipse cx="148" cy="280" rx="22" ry="14"
            fill={glowColor} opacity="0.06" />
          <ellipse cx="252" cy="280" rx="22" ry="14"
            fill={glowColor} opacity="0.06" />

          {/* ── Eyebrows ── */}
          <path d="M 148 198 Q 168 190 185 193"
            stroke="#6a4a8a" strokeWidth="2.5"
            strokeLinecap="round" fill="none" />
          <path d="M 215 193 Q 232 190 252 198"
            stroke="#6a4a8a" strokeWidth="2.5"
            strokeLinecap="round" fill="none" />

          {/* Subtle brow arch adjustment for listening/thinking */}
          {state === 'listening' && (
            <>
              <path d="M 148 195 Q 168 186 185 190"
                stroke="#9370db" strokeWidth="1"
                strokeLinecap="round" fill="none" opacity="0.5" />
              <path d="M 215 190 Q 232 186 252 195"
                stroke="#9370db" strokeWidth="1"
                strokeLinecap="round" fill="none" opacity="0.5" />
            </>
          )}

          {/* ── Eyes ── */}
          {/* Left eye */}
          <g filter="url(#softGlow)">
            {/* Eye white (actually very dark — Ada's eyes are deep) */}
            <ellipse cx="168" cy="220"
              rx="22" ry={blinkState ? 1 : 14}
              fill="#0e0a1a"
              style={{ transition: 'ry 0.08s ease' }}
            />
            {/* Iris */}
            {!blinkState && (
              <ellipse cx="168" cy="220" rx="14" ry="14"
                fill="url(#irisGrad)" />
            )}
            {/* Pupil */}
            {!blinkState && (
              <circle className="eye-pupils" cx="168" cy="220" r="6"
                fill="#050308" />
            )}
            {/* Catchlight — the little white dot that makes eyes feel alive */}
            {!blinkState && (
              <circle cx="163" cy="215" r="2.5"
                fill="white" opacity="0.9" />
            )}
            {/* Lower lash line */}
            <path d="M 147 220 Q 168 234 189 220"
              stroke="#1a0e2e" strokeWidth="2"
              fill="none" opacity={blinkState ? 0 : 0.6} />
          </g>

          {/* Right eye */}
          <g filter="url(#softGlow)">
            <ellipse cx="232" cy="220"
              rx="22" ry={blinkState ? 1 : 14}
              fill="#0e0a1a"
              style={{ transition: 'ry 0.08s ease' }}
            />
            {!blinkState && (
              <ellipse cx="232" cy="220" rx="14" ry="14"
                fill="url(#irisGrad)" />
            )}
            {!blinkState && (
              <circle className="eye-pupils" cx="232" cy="220" r="6"
                fill="#050308" />
            )}
            {!blinkState && (
              <circle cx="227" cy="215" r="2.5"
                fill="white" opacity="0.9" />
            )}
            <path d="M 211 220 Q 232 234 253 220"
              stroke="#1a0e2e" strokeWidth="2"
              fill="none" opacity={blinkState ? 0 : 0.6} />
          </g>

          {/* ── Nose ── */}
          {/* Subtle — just a soft shadow suggestion */}
          <path d="M 200 240 Q 193 265 188 275 Q 200 280 212 275 Q 207 265 200 240"
            fill="#0e0a1a" opacity="0.35" />
          {/* Nostrils — very subtle */}
          <ellipse cx="191" cy="276" rx="5" ry="3"
            fill="#0e0a1a" opacity="0.3" />
          <ellipse cx="209" cy="276" rx="5" ry="3"
            fill="#0e0a1a" opacity="0.3" />

          {/* ── Lips ── */}
          <g filter="url(#softGlow)">
            {/* Upper lip */}
            <path d={lipPaths.upper}
              stroke="#c090c8" strokeWidth="1.8"
              fill="none" strokeLinecap="round" />
            {/* Cupid's bow */}
            <path d="M 183 310 Q 192 306 200 310 Q 208 306 217 310"
              stroke="#c090c8" strokeWidth="1.5"
              fill="none" opacity="0.6" />
            {/* Lower lip */}
            <path d={lipPaths.lower[mouthOpen]}
              stroke="#c090c8" strokeWidth="2"
              fill={mouthOpen > 0 ? '#0e0a1a' : 'none'}
              strokeLinecap="round"
              style={{ transition: 'd 0.08s ease' }}
            />
            {/* Lip glow */}
            <ellipse cx="200" cy="313" rx="20" ry="6"
              fill={glowColor} opacity="0.08" />
          </g>

          {/* ── Hair (front layer — over face edges for depth) ── */}
          {/* Strands framing the face */}
          <path d="M 105 170 Q 108 220 112 260"
            stroke="#1a0e2e" strokeWidth="18"
            fill="none" strokeLinecap="round" opacity="0.8" />
          <path d="M 295 170 Q 292 220 288 260"
            stroke="#1a0e2e" strokeWidth="18"
            fill="none" strokeLinecap="round" opacity="0.8" />
          {/* A few subtle foreground hair strands */}
          <path d="M 130 130 Q 155 180 152 230"
            stroke="#2a1840" strokeWidth="4"
            fill="none" strokeLinecap="round" opacity="0.6" />
          <path d="M 270 130 Q 245 180 248 230"
            stroke="#2a1840" strokeWidth="4"
            fill="none" strokeLinecap="round" opacity="0.6" />

        </g>
        {/* end face-group */}

        {/* ── State label (very subtle, bottom of frame) ── */}
        <text
          x="200" y="505"
          textAnchor="middle"
          fill={glowColor}
          fontSize="11"
          fontFamily="system-ui"
          letterSpacing="3"
          opacity="0.4"
        >
          {state.toUpperCase()}
        </text>

      </svg>
    </div>
  );
}


// ── Styles ────────────────────────────────────────────────────
const styles = {
  wrapper: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  svg: {
    width: '100%',
    maxWidth: '380px',
    height: 'auto',
    // Drop shadow behind the whole SVG — adds depth
    filter: 'drop-shadow(0 0 40px rgba(147, 112, 219, 0.15))',
  },
};
