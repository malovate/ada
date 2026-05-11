// ============================================================
// src/screens/VoiceScreen.jsx — Ada's Face Mode
// ============================================================
// This is the full-screen voice interface.
// Ada's face takes up most of the screen.
// Paul holds the mic button at the bottom to speak.
// Ada's face animates through: idle → listening → thinking → speaking.
//
// The screen also shows:
//   - Ada's current mood (top)
//   - The last thing said (subtitles, bottom of face)
//   - A back arrow to return to chat
// ============================================================

import { useState, useRef, useCallback } from 'react';
import AdaFace from '../components/AdaFace';
import { sendVoiceNote, fetchAdaAudio } from '../services/api';

// ── VoiceScreen Component ─────────────────────────────────────
// Props:
//   adaMood   → current mood string for face glow color
//   onBack()  → called when user taps back arrow → returns to chat
//   onNewMessage(paul, ada) → called when exchange completes,
//                             so App.jsx can save it to chat history
export default function VoiceScreen({ adaMood, onBack, onNewMessage }) {

  // ── Face state machine ────────────────────────────────────
  // Four states Ada's face cycles through during a voice exchange.
  const [faceState, setFaceState] = useState('idle');
  // 'idle'      → waiting for Paul
  // 'listening' → Paul is recording
  // 'thinking'  → backend is processing
  // 'speaking'  → Ada's audio is playing

  const [subtitle, setSubtitle] = useState('');
  // Shows the last spoken text at the bottom of the face.
  // When Paul speaks: shows his transcription.
  // When Ada speaks: shows her response text.

  const [isRecording, setIsRecording] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // ── Refs ──────────────────────────────────────────────────
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);


  // ── startListening() ──────────────────────────────────────
  // Paul presses the mic button. We request microphone access
  // and start recording. Face transitions to 'listening'.
  async function startListening() {
    if (faceState !== 'idle') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Recording complete. Build the audio blob.
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType
        });
        stream.getTracks().forEach(t => t.stop());
        // Process the recording — this transitions the face forward.
        await processVoiceNote(blob);
      };

      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setFaceState('listening');
      setSubtitle('listening...');

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setPermissionDenied(true);
      }
      console.error('Mic error:', err);
    }
  }


  // ── stopListening() ───────────────────────────────────────
  // Paul releases the button. Recording stops.
  // The 'onstop' handler fires automatically after this.
  function stopListening() {
    if (!isRecording || !mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setFaceState('thinking');
    setSubtitle('thinking...');
  }


  // ── processVoiceNote() ────────────────────────────────────
  // Called with the audio blob after Paul finishes speaking.
  // Sends to backend → gets Ada's response → plays her voice.
  async function processVoiceNote(blob) {
    try {
      // ── Step 1: Send to backend ───────────────────────────
      // sendVoiceNote() transcribes Paul's audio and gets Ada's text reply.
      const result = await sendVoiceNote(blob, blob.type);

      // Show Paul's transcription briefly as a subtitle.
      setSubtitle(`"${result.transcription}"`);

      // Small pause so Paul can read his own words.
      await sleep(800);

      // ── Step 2: Fetch Ada's voice audio ───────────────────
      // fetchAdaAudio() calls /voice/speak and returns a blob URL.
      setFaceState('thinking');
      setSubtitle('...');

      const audioUrl = await fetchAdaAudio(result.response);

      if (!audioUrl) {
        // No audio available — show text fallback.
        setSubtitle(result.response);
        setFaceState('idle');
        return;
      }

      // ── Step 3: Play Ada's voice ──────────────────────────
      setFaceState('speaking');
      setSubtitle(result.response);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // When audio ends, return face to idle.
      audio.onended = () => {
        setFaceState('idle');
        setSubtitle('');
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();

      // ── Step 4: Notify App.jsx of the exchange ────────────
      // So the chat history records this conversation too.
      if (onNewMessage) {
        onNewMessage(
          `🎤 ${result.transcription}`,  // Paul's transcribed message
          result.response                  // Ada's reply
        );
      }

    } catch (err) {
      console.error('processVoiceNote error:', err);
      setFaceState('idle');
      setSubtitle('something went wrong');
      setTimeout(() => setSubtitle(''), 2000);
    }
  }


  // ── sleep() — utility ─────────────────────────────────────
  // Creates an awaitable pause.
  // 'new Promise(resolve => setTimeout(resolve, ms))' creates a
  // promise that resolves (completes) after 'ms' milliseconds.
  // 'await sleep(800)' pauses the function for 800ms.
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  // ── Render ────────────────────────────────────────────────
  return (
    <div style={styles.screen}>

      {/* ── Top bar ── */}
      <div style={styles.topBar}>
        {/* Back button → returns to chat */}
        <button style={styles.backBtn} onClick={onBack}>
          {/* SVG left arrow */}
          <svg width="20" height="20" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <span style={styles.topTitle}>ADA</span>

        {/* Mood indicator — just the dot, no text in voice mode */}
        <div style={{
          ...styles.moodDot,
          backgroundColor: getMoodColor(adaMood),
        }} />
      </div>

      {/* ── Ada's Face — takes up most of the screen ── */}
      <div style={styles.faceArea}>
        <AdaFace state={faceState} mood={adaMood} />
      </div>

      {/* ── Subtitle — what was just said ── */}
      <div style={styles.subtitleArea}>
        {subtitle ? (
          <p style={styles.subtitleText}>{subtitle}</p>
        ) : (
          // Default prompt when idle
          <p style={styles.subtitleHint}>
            {permissionDenied
              ? 'microphone access denied — check browser settings'
              : 'hold to speak'
            }
          </p>
        )}
      </div>

      {/* ── Mic button ── */}
      <div style={styles.micArea}>
        <button
          style={{
            ...styles.micBtn,
            ...(isRecording ? styles.micBtnActive : {}),
            ...(faceState === 'thinking' || faceState === 'speaking'
              ? styles.micBtnDisabled : {}),
          }}
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onMouseLeave={stopListening}
          onTouchStart={(e) => { e.preventDefault(); startListening(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopListening(); }}
          disabled={faceState === 'thinking' || faceState === 'speaking'}
        >
          {/* Microphone SVG */}
          <svg width="28" height="28" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>

          {/* Pulsing ring behind the button when recording */}
          {isRecording && <div style={styles.micRing} />}
        </button>

        <span style={styles.micLabel}>
          {isRecording     ? 'release to send'  :
           faceState === 'thinking' ? 'thinking...'      :
           faceState === 'speaking' ? 'ada is speaking'  :
           'hold to speak'}
        </span>
      </div>

    </div>
  );
}


// ── getMoodColor() ────────────────────────────────────────────
function getMoodColor(mood = '') {
  const m = mood.toLowerCase();
  if (m.includes('curious'))   return '#9370db';
  if (m.includes('excited'))   return '#f0a500';
  if (m.includes('melanchol')) return '#4a6fa5';
  if (m.includes('warm'))      return '#e8806a';
  if (m.includes('playful'))   return '#5cbf8a';
  if (m.includes('restless'))  return '#c05070';
  return '#9370db';
}


// ── Styles ────────────────────────────────────────────────────
const styles = {
  screen: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
  },

  topBar: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    flexShrink: 0,
  },

  backBtn: {
    background: 'none',
    border: 'none',
    color: '#666680',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '8px',
  },

  topTitle: {
    color: '#c8b8f8',
    fontSize: '14px',
    fontWeight: '300',
    letterSpacing: '5px',
  },

  moodDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    opacity: 0.7,
  },

  faceArea: {
    flex: 1,
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px',
    minHeight: 0,   // allows flex child to shrink below content size
  },

  subtitleArea: {
    width: '100%',
    maxWidth: '360px',
    minHeight: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 24px',
    flexShrink: 0,
  },

  subtitleText: {
    color: '#c8b8f8',
    fontSize: '15px',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: '1.5',
    margin: 0,
    // Two-line max — cut off with ellipsis if Ada gives a very long reply
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },

  subtitleHint: {
    color: '#3a3a5a',
    fontSize: '13px',
    textAlign: 'center',
    margin: 0,
  },

  micArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    paddingBottom: '36px',
    paddingTop: '16px',
    flexShrink: 0,
  },

  micBtn: {
    position: 'relative',
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    border: '2px solid #2a2a3f',
    backgroundColor: '#12121f',
    color: '#9370db',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
    transition: 'all 0.15s ease',
  },

  micBtnActive: {
    backgroundColor: 'rgba(224, 92, 92, 0.15)',
    borderColor: '#e05c5c',
    color: '#e05c5c',
    transform: 'scale(1.05)',
  },

  micBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },

  micRing: {
    position: 'absolute',
    width: '88px',
    height: '88px',
    borderRadius: '50%',
    border: '2px solid #e05c5c',
    opacity: 0.4,
    animation: 'pulse 1s ease-in-out infinite',
    // 'pulse' keyframe is defined in global.css
    pointerEvents: 'none',
    // pointerEvents: none means clicks pass through this ring
    // to the button underneath — it's purely visual.
  },

  micLabel: {
    color: '#555570',
    fontSize: '12px',
    letterSpacing: '0.5px',
  },
};
