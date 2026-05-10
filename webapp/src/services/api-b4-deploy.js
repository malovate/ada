// ============================================================
// src/services/api.js — All Backend Communication
// ============================================================
// Identical in purpose to the mobile version.
// The only difference: we use the browser's built-in fetch()
// (same as the mobile version) so the code is nearly identical.
//
// One key web-specific thing: microphone access uses the
// browser's MediaRecorder API instead of expo-av.
// That's handled in VoiceButton.jsx, not here.
// ============================================================

// ── Backend URL ───────────────────────────────────────────────
// During development: your Python server running locally.
// During production: your Railway/Render cloud URL.
//
// Because both Vite (port 5173) and the backend (port 5000)
// run on the SAME computer during development, we can use
// localhost instead of finding your IP address.
// This is much simpler than the mobile setup.
const BACKEND_URL = 'http://localhost:5000';
// When you deploy, change this to: 'https://your-app.railway.app'


// ── sendMessage() ─────────────────────────────────────────────
// Sends Paul's typed message to Ada's backend.
// Returns {response, mood}.
export async function sendMessage(message) {
  try {
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Server error');
    }

    return await response.json();
    // Returns: { response: "...", mood: "..." }

  } catch (error) {
    console.error('sendMessage:', error);
    return {
      response: "I'm having trouble connecting. Give me a moment.",
      mood: 'disconnected'
    };
  }
}


// ── sendVoiceNote() ───────────────────────────────────────────
// Sends an audio Blob to the backend for transcription + response.
//
// The browser's MediaRecorder gives us a Blob (binary large object)
// — essentially a file in memory.
// We wrap it in FormData (the standard way to upload files over HTTP).
//
// 'audioBlob' is a Blob object from MediaRecorder.
// 'mimeType' is the audio format — browser-dependent.
export async function sendVoiceNote(audioBlob, mimeType = 'audio/webm') {
  try {
    // FormData wraps the blob as a file upload.
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice_note.webm');
    // append(fieldName, value, filename)
    // fieldName must match what the backend expects: 'audio'
    // filename is just a label — the server uses it for the extension.

    const response = await fetch(`${BACKEND_URL}/voice/message`, {
      method: 'POST',
      // Do NOT set Content-Type manually with FormData.
      // The browser sets it automatically with the correct boundary string.
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Voice error');
    }

    return await response.json();
    // Returns: { transcription, response, mood, has_audio }

  } catch (error) {
    console.error('sendVoiceNote:', error);
    return {
      transcription: '[could not transcribe]',
      response: "I didn't catch that. Try again?",
      mood: 'uncertain'
    };
  }
}


// ── fetchAdaAudio() ───────────────────────────────────────────
// Asks the backend to convert text into Ada's voice (MP3).
// Returns a URL we can feed to an <audio> element for playback.
//
// HOW URL.createObjectURL() works:
// The browser downloads the MP3 bytes → stores them in memory →
// creates a temporary "blob URL" like: blob://localhost/abc123
// We point an <audio> element at that URL → it plays instantly.
export async function fetchAdaAudio(text) {
  try {
    const response = await fetch(`${BACKEND_URL}/voice/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });

    if (!response.ok) throw new Error('TTS failed');

    // response.blob() reads the response body as a Blob.
    // A Blob is raw binary data — the MP3 file content.
    const audioBlob = await response.blob();

    // URL.createObjectURL() creates a temporary local URL for the blob.
    // The browser can play this URL directly.
    // We call URL.revokeObjectURL() later to free the memory.
    return URL.createObjectURL(audioBlob);

  } catch (error) {
    console.error('fetchAdaAudio:', error);
    return null;
  }
}


// ── checkProactiveMessage() ───────────────────────────────────
// Polls the backend to see if Ada has sent an unprompted message.
export async function checkProactiveMessage() {
  try {
    const response = await fetch(`${BACKEND_URL}/proactive`);
    const data = await response.json();
    if (data.message && data.type !== 'none') return data.message;
    return null;
  } catch {
    return null;
  }
}


// ── getAdaState() ─────────────────────────────────────────────
// Fetches Ada's current mood and thought.
export async function getAdaState() {
  try {
    const response = await fetch(`${BACKEND_URL}/state`);
    return await response.json();
  } catch {
    return { mood: 'somewhere out there', current_thought: '...' };
  }
}
