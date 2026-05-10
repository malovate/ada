// ============================================================
// src/components/VoiceButton.jsx — Hold to Record
// ============================================================
// This handles microphone recording in the browser.
//
// We use the browser's built-in MediaRecorder API.
// No external library needed — the browser can record audio natively.
//
// HOW MediaRecorder WORKS:
// 1. Ask browser for microphone permission
// 2. Get a "MediaStream" — a live audio feed from the mic
// 3. Feed the stream into a MediaRecorder
// 4. MediaRecorder collects audio chunks as the user speaks
// 5. When recording stops, we assemble chunks into a Blob (audio file)
// 6. Send the Blob to the backend
// ============================================================

import { useState, useRef } from 'react';

// ── VoiceButton Component ─────────────────────────────────────
// Props:
//   onVoiceMessage(blob) → called when recording stops with the audio Blob
//   disabled → bool: disable the button (e.g. while Ada is responding)
//   isAdaSpeaking → bool: shows speaker indicator
export default function VoiceButton({ onVoiceMessage, disabled, isAdaSpeaking }) {

  const [isRecording, setIsRecording] = useState(false);
  // true = Paul is currently holding the button and recording

  const [permissionDenied, setPermissionDenied] = useState(false);
  // true = browser blocked microphone access

  const mediaRecorderRef = useRef(null);
  // Holds the active MediaRecorder instance.
  // useRef (not useState) because we access it in event handlers
  // without needing a re-render when it changes.

  const chunksRef = useRef([]);
  // Accumulates audio data chunks during recording.
  // MediaRecorder fires 'dataavailable' events with small Blobs
  // as you speak. We collect them all, then join at the end.


  // ── startRecording() ──────────────────────────────────────
  async function startRecording() {
    if (disabled || isRecording) return;

    try {
      // navigator.mediaDevices.getUserMedia() — the browser's API
      // to request access to hardware devices.
      // { audio: true } = we want the microphone only (not camera).
      // This shows the browser's "Allow microphone?" permission popup.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create a MediaRecorder attached to the microphone stream.
      // The MediaRecorder will encode audio as it's captured.
      const mediaRecorder = new MediaRecorder(stream);
      // Note: the browser chooses the best supported audio format
      // automatically (usually webm/opus on Chrome, ogg on Firefox).

      // Reset our chunks array for this new recording.
      chunksRef.current = [];

      // 'ondataavailable' fires periodically with audio data.
      // We push each chunk into our array.
      // 'event.data' is a Blob (small audio piece).
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // size > 0 check: sometimes empty chunks arrive — skip them.
          chunksRef.current.push(event.data);
        }
      };

      // 'onstop' fires when .stop() is called.
      // At this point, all chunks have been collected.
      mediaRecorder.onstop = () => {
        // Combine all chunks into one Blob — the complete audio file.
        // 'new Blob(array, {type})' merges an array of Blobs.
        const audioBlob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType
          // mimeType might be 'audio/webm;codecs=opus' — that's fine.
          // The backend will still transcribe it correctly.
        });

        // Stop all microphone tracks to turn off the mic indicator
        // in the browser. Without this, the red "recording" dot
        // stays in the browser tab forever.
        stream.getTracks().forEach(track => track.stop());
        // getTracks() returns all media tracks (we have just audio).
        // forEach loops over them and stops each one.

        // Send the blob to App.jsx via callback.
        onVoiceMessage(audioBlob);

        setIsRecording(false);
      };

      // Start recording.
      // The number (250) is the "timeslice" in milliseconds.
      // It means: fire ondataavailable every 250ms.
      // This keeps chunks small and memory usage low.
      mediaRecorder.start(250);

      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

    } catch (error) {
      if (error.name === 'NotAllowedError') {
        // User blocked microphone in browser settings.
        setPermissionDenied(true);
        console.error('Microphone permission denied');
      } else {
        console.error('Recording error:', error);
      }
    }
  }


  // ── stopRecording() ───────────────────────────────────────
  function stopRecording() {
    if (!isRecording || !mediaRecorderRef.current) return;

    // .stop() triggers the 'onstop' event defined above.
    mediaRecorderRef.current.stop();
    // Note: setIsRecording(false) is called inside onstop,
    // not here — to ensure it only happens after the blob is ready.
  }


  // ── Render ────────────────────────────────────────────────
  if (permissionDenied) {
    return (
      <div style={styles.permissionError} title="Enable microphone in browser settings">
        🎤🚫
      </div>
    );
  }

  return (
    <button
      style={{
        ...styles.button,
        // Conditional styles: change button appearance based on state.
        // JavaScript spread + override is how we do conditional CSS-in-JS.
        ...(isRecording ? styles.buttonRecording : {}),
        ...(disabled ? styles.buttonDisabled : {}),
      }}
      // Mouse events (desktop)
      onMouseDown={startRecording}   // Start when mouse button pressed
      onMouseUp={stopRecording}      // Stop when mouse button released
      onMouseLeave={stopRecording}   // Stop if mouse leaves button

      // Touch events (mobile browser)
      onTouchStart={(e) => {
        e.preventDefault(); // Prevent the mousedown from also firing
        startRecording();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        stopRecording();
      }}

      disabled={disabled && !isRecording}
      title={isRecording ? 'Release to send' : 'Hold to speak'}
    >
      {/* Show different content based on state */}
      {isAdaSpeaking ? (
        // Ada is speaking — show speaker wave icon
        <span style={styles.speakingIcon}>🔊</span>
      ) : isRecording ? (
        // Paul is recording — show pulsing red dot
        <span style={styles.recordingDot} />
      ) : (
        // Default: microphone icon
        <MicIcon />
      )}
    </button>
  );
}


// ── MicIcon — SVG microphone ──────────────────────────────────
// We draw the mic as an SVG so it's crisp at any size.
// SVG = Scalable Vector Graphics. Pure math-based shapes, no pixels.
function MicIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"     // 'currentColor' inherits from CSS color
      strokeWidth="2"
      strokeLinecap="round"
    >
      {/* Microphone capsule */}
      <rect x="9" y="2" width="6" height="11" rx="3" />
      {/* Stand */}
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}


// ── Styles ────────────────────────────────────────────────────
const styles = {
  button: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-raised)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s ease',
    // 'transition' animates property changes smoothly.
    // 'all' = all properties. '0.15s' = duration. 'ease' = timing function.
    touchAction: 'none',
    // touchAction: none prevents the browser from hijacking touch events
    // (like scrolling) while the user holds the mic button.
  },

  buttonRecording: {
    backgroundColor: 'rgba(224, 92, 92, 0.15)',
    borderColor: '#e05c5c',
    color: '#e05c5c',
  },

  buttonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },

  recordingDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#e05c5c',
    animation: 'pulse 1s ease-in-out infinite',
    // 'pulse' defined in global.css
    display: 'block',
  },

  speakingIcon: {
    fontSize: '18px',
    animation: 'pulse 1.5s ease-in-out infinite',
  },

  permissionError: {
    fontSize: '18px',
    cursor: 'help',
    padding: '8px',
  },
};
