// ============================================================
// src/components/MoodBar.jsx
// ============================================================
// Shows Ada's current mood subtly at the top of the screen.
// A pulsing colored dot + short mood phrase.
// ============================================================

// 'useState' and 'useEffect' are React hooks.
// In React, a "hook" is a function that lets you tap into
// React's internal systems (state, lifecycle) from a component.
//
// Every hook starts with 'use'. That's the convention.
import { useState, useEffect } from 'react';

// ── Mood → color map ─────────────────────────────────────────
// Each mood keyword maps to a CSS color.
// We check if the mood string CONTAINS any of these keywords.
const MOOD_COLORS = {
  curious:      '#9370db',   // purple
  excited:      '#f0a500',   // amber
  melancholic:  '#4a6fa5',   // blue
  restless:     '#e05c5c',   // red
  playful:      '#5cbf8a',   // green
  disconnected: '#555555',   // grey
  moved:        '#c8a0f0',   // light purple
  warm:         '#e8a060',   // warm orange
};

function getMoodColor(mood) {
  if (!mood) return '#7a7a9a';
  const lower = mood.toLowerCase();
  const key = Object.keys(MOOD_COLORS).find(k => lower.includes(k));
  return key ? MOOD_COLORS[key] : '#7a7a9a';
}

// ── MoodBar Component ─────────────────────────────────────────
// Props: mood (string)
export default function MoodBar({ mood }) {
  const color = getMoodColor(mood);

  // ── Inline styles ─────────────────────────────────────────
  // In React, styles can be plain JavaScript objects.
  // camelCase property names match the JS DOM API.
  // This is the equivalent of writing CSS but scoped to one element.
  //
  // We use inline styles here because the dot color is DYNAMIC —
  // it changes based on Ada's mood. CSS can't know this at build time.
  const containerStyle = {
    display: 'flex',         // Flexbox: arrange children in a row
    alignItems: 'center',    // Vertically center the dot and text
    gap: '8px',              // Space between dot and text
    padding: '6px 16px',
  };

  const dotStyle = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',     // Perfect circle (50% of width = radius)
    backgroundColor: color,  // Dynamic color based on mood
    flexShrink: 0,           // Don't let the dot shrink if space is tight
    animation: 'shimmer 2s ease-in-out infinite',
    // 'shimmer' is defined in global.css @keyframes.
    // Animations are best defined in CSS, not inline.
  };

  const textStyle = {
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontStyle: 'italic',
    overflow: 'hidden',
    whiteSpace: 'nowrap',    // Don't wrap to next line
    textOverflow: 'ellipsis',// "..." if it overflows
  };

  return (
    <div style={containerStyle}>
      <div style={dotStyle} />
      <span style={textStyle}>{mood || 'somewhere out there'}</span>
    </div>
  );
}
