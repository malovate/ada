// ============================================================
// src/App.jsx — Ada's Web Interface
// ============================================================
// This is the root component. It owns all the state and logic.
// Child components (ChatBubble, MoodBar, VoiceButton) just
// display data and call back up to this component to act.
//
// This pattern — state at the top, display at the bottom —
// is called "lifting state up". It keeps components simple
// and state predictable.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import ChatBubble from './components/ChatBubble';
import MoodBar from './components/MoodBar';
import VoiceButton from './components/VoiceButton';
import {
  sendMessage,
  sendVoiceNote,
  fetchAdaAudio,
  checkProactiveMessage,
  getAdaState,
} from './services/api';

// ── Constants ─────────────────────────────────────────────────
const STORAGE_KEY = 'ada_conversation';
// localStorage key for persisting conversation history in the browser.
// localStorage survives page refreshes — like AsyncStorage in React Native.

const PROACTIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds


// ── App Component ─────────────────────────────────────────────
export default function App() {

  // ── State ─────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [adaMood, setAdaMood] = useState('curious and still');
  const [isAdaSpeaking, setIsAdaSpeaking] = useState(false);
  // true = Ada's voice audio is currently playing

  const [proactiveBanner, setProactiveBanner] = useState(null);
  // Holds an unprompted message from Ada if she reached out.

  // ── Refs ──────────────────────────────────────────────────
  const messagesEndRef = useRef(null);
  // A ref attached to an invisible div at the bottom of the message list.
  // We call .scrollIntoView() on it to auto-scroll to the latest message.

  const audioRef = useRef(null);
  // Holds the current Audio object so we can stop it if needed.

  const proactiveTimerRef = useRef(null);
  // Holds the setInterval ID so we can clear it on unmount.

  const textareaRef = useRef(null);
  // Reference to the textarea so we can auto-resize it.


  // ── On Mount: Load history and Ada's state ─────────────────
  // useEffect with [] runs once when the component first renders.
  // "On mount" = when the component appears on screen for the first time.
  useEffect(() => {
    loadHistory();
    loadAdaState();
    startProactivePolling();

    // Cleanup: runs when the component unmounts (e.g. page closes).
    // We clear the timer so it doesn't keep running in the background.
    return () => {
      if (proactiveTimerRef.current) clearInterval(proactiveTimerRef.current);
    };
  }, []); // [] = run only once


  // ── Auto-scroll when messages change ──────────────────────
  // useEffect with [messages] dependency: runs whenever messages updates.
  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  // ── loadHistory() ─────────────────────────────────────────
  function loadHistory() {
    // localStorage.getItem() reads from browser storage.
    // Returns null if the key doesn't exist (first visit).
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      // JSON.parse() converts the stored string back to an array.
      setMessages(JSON.parse(saved));
    } else {
      // First time opening — Ada's opening state.
      setMessages([{
        id: 'opening',
        role: 'assistant',
        content: '...',
        timestamp: new Date().toISOString(),
      }]);
    }
  }


  // ── saveHistory() ─────────────────────────────────────────
  // Saves the full message array to localStorage after every update.
  function saveHistory(updatedMessages) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMessages));
  }


  // ── loadAdaState() ────────────────────────────────────────
  async function loadAdaState() {
    const state = await getAdaState();
    if (state?.mood) setAdaMood(state.mood);
  }


  // ── startProactivePolling() ───────────────────────────────
  function startProactivePolling() {
    proactiveTimerRef.current = setInterval(async () => {
      const msg = await checkProactiveMessage();
      if (msg) setProactiveBanner(msg);
    }, PROACTIVE_INTERVAL);
  }


  // ── scrollToBottom() ──────────────────────────────────────
  function scrollToBottom() {
    // 'messagesEndRef.current' is the DOM element we attached the ref to.
    // '.scrollIntoView()' scrolls the page so that element is visible.
    // { behavior: 'smooth' } = animated scroll, not instant jump.
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }


  // ── playAdaAudio() ────────────────────────────────────────
  // Fetches Ada's voice for a text, then plays it.
  async function playAdaAudio(text) {
    // Stop any currently playing audio first.
    if (audioRef.current) {
      audioRef.current.pause();
      // Revoke the old blob URL to free memory.
      // URL.revokeObjectURL() tells the browser: "I'm done with this URL."
      URL.revokeObjectURL(audioRef.current.src);
    }

    setIsAdaSpeaking(true);

    // Fetch the MP3 as a blob URL.
    const audioUrl = await fetchAdaAudio(text);
    if (!audioUrl) {
      setIsAdaSpeaking(false);
      return;
    }

    // 'new Audio(url)' creates a browser audio player object.
    // Like an invisible <audio> element.
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    // 'onended' fires when the audio finishes playing.
    audio.onended = () => {
      setIsAdaSpeaking(false);
      URL.revokeObjectURL(audioUrl); // Free the memory
    };

    // '.play()' returns a Promise. We await it.
    // It can fail if the browser blocks autoplay — we catch that.
    try {
      await audio.play();
    } catch (err) {
      console.error('Audio playback failed:', err);
      setIsAdaSpeaking(false);
    }
  }


  // ── handleSend() ─────────────────────────────────────────
  // Called when Paul presses Enter or the send button.
  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;

    // Build Paul's message object.
    const paulMsg = {
      id: `paul_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    // Add to UI immediately — don't wait for server.
    const updated = [...messages, paulMsg];
    setMessages(updated);
    setInputText('');
    setIsLoading(true);

    // Reset textarea height.
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const result = await sendMessage(trimmed);

      const adaMsg = {
        id: `ada_${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString(),
      };

      const final = [...updated, adaMsg];
      setMessages(final);
      saveHistory(final);
      if (result.mood) setAdaMood(result.mood);

    } catch (err) {
      console.error('handleSend:', err);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messages]);


  // ── handleVoiceMessage() ──────────────────────────────────
  // Called by VoiceButton when Paul finishes recording.
  // 'blob' is the raw audio data from MediaRecorder.
  const handleVoiceMessage = useCallback(async (blob) => {
    if (isLoading) return;
    setIsLoading(true);

    // Show a placeholder while we transcribe.
    // This gives Paul immediate feedback that the voice note was received.
    const placeholder = {
      id: `paul_voice_${Date.now()}`,
      role: 'user',
      content: '🎤 ...',   // Will be replaced with transcription
      timestamp: new Date().toISOString(),
    };

    const withPlaceholder = [...messages, placeholder];
    setMessages(withPlaceholder);

    try {
      const result = await sendVoiceNote(blob, blob.type);

      // Replace the placeholder with the actual transcription.
      // We use .map() to transform the messages array:
      // For each message, if it's the placeholder, replace it.
      // Otherwise, return it unchanged.
      const transcribed = withPlaceholder.map(msg =>
        msg.id === placeholder.id
          ? { ...msg, content: `🎤 ${result.transcription}` }
          : msg
        // '...msg' copies all fields. Then we override 'content'.
        // This is immutable update — never mutate objects directly in React.
      );

      const adaMsg = {
        id: `ada_${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString(),
      };

      const final = [...transcribed, adaMsg];
      setMessages(final);
      saveHistory(final);
      if (result.mood) setAdaMood(result.mood);

      // Automatically play Ada's voice response to a voice note.
      // If Paul spoke to her, she speaks back.
      await playAdaAudio(result.response);

    } catch (err) {
      console.error('handleVoiceMessage:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages]);


  // ── handleProactiveDismiss() ──────────────────────────────
  // When Paul taps the banner, add Ada's message to the chat.
  function handleProactiveDismiss() {
    if (!proactiveBanner) return;

    const adaMsg = {
      id: `ada_proactive_${Date.now()}`,
      role: 'assistant',
      content: proactiveBanner,
      timestamp: new Date().toISOString(),
    };

    const updated = [...messages, adaMsg];
    setMessages(updated);
    saveHistory(updated);
    setProactiveBanner(null);
  }


  // ── handleKeyDown() ───────────────────────────────────────
  // Sends on Enter (without Shift).
  // Shift+Enter = new line in the textarea (normal behavior).
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // preventDefault stops the Enter key from adding a newline.
      handleSend();
    }
  }


  // ── handleTextareaChange() ────────────────────────────────
  // Updates inputText state AND auto-resizes the textarea.
  function handleTextareaChange(e) {
    setInputText(e.target.value);

    // Auto-resize: reset height, then set to scrollHeight.
    // scrollHeight = the full height of the text content.
    // This makes the textarea grow as Paul types multiple lines.
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    // Math.min caps it at 120px — don't grow forever.
  }


  // ── Render ────────────────────────────────────────────────
  return (
    <div style={styles.app}>

      {/* ── Header ── */}
      <header style={styles.header}>
        <h1 style={styles.headerName}>ADA</h1>
        <MoodBar mood={adaMood} />
      </header>

      {/* ── Proactive Banner ── */}
      {proactiveBanner && (
        <button
          style={styles.proactiveBanner}
          onClick={handleProactiveDismiss}
        >
          <span style={styles.proactiveLabel}>ada reached out</span>
          <span style={styles.proactiveText}>{proactiveBanner}</span>
          <span style={styles.proactiveTap}>tap to add to conversation</span>
        </button>
      )}

      {/* ── Message List ── */}
      <main style={styles.messageList}>
        {messages.map((msg, index) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            // Only show speaker button on Ada's messages
            onPlayAudio={msg.role === 'assistant' ? playAdaAudio : null}
          />
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div style={styles.typingIndicator}>
            <span style={styles.typingDot} />
            <span style={{ ...styles.typingDot, animationDelay: '0.2s' }} />
            <span style={{ ...styles.typingDot, animationDelay: '0.4s' }} />
          </div>
        )}

        {/* Invisible anchor div at the bottom — we scroll to this */}
        <div ref={messagesEndRef} />
      </main>

      {/* ── Input Row ── */}
      <footer style={styles.inputRow}>
        <textarea
          ref={textareaRef}
          style={styles.textarea}
          value={inputText}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder="say something..."
          rows={1}
          // 'rows={1}' sets the starting height.
          // Auto-resize in handleTextareaChange grows it as needed.
          disabled={isLoading}
        />

        {/* Send Button */}
        <button
          style={{
            ...styles.sendBtn,
            ...((!inputText.trim() || isLoading) ? styles.sendBtnDisabled : {}),
          }}
          onClick={handleSend}
          disabled={!inputText.trim() || isLoading}
          title="Send"
        >
          ↑
        </button>

        {/* Voice Button */}
        <VoiceButton
          onVoiceMessage={handleVoiceMessage}
          disabled={isLoading}
          isAdaSpeaking={isAdaSpeaking}
        />
      </footer>
    </div>
  );
}


// ── Styles ────────────────────────────────────────────────────
const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    backgroundColor: 'var(--bg)',
    maxWidth: '680px',
    // Cap width on large screens — chat doesn't need to stretch wide.
    margin: '0 auto',
    // 'auto' margins center the container horizontally.
  },

  header: {
    borderBottom: '1px solid var(--border)',
    paddingTop: '12px',
    flexShrink: 0,
    // flexShrink: 0 means: don't shrink this element even if space is tight.
    // The message list will shrink instead.
  },

  headerName: {
    color: 'var(--lavender)',
    fontSize: '18px',
    fontWeight: '300',
    letterSpacing: '6px',
    textAlign: 'center',
    paddingBottom: '6px',
  },

  messageList: {
    flex: 1,
    // flex: 1 means: take all available vertical space.
    // This pushes the header up and input row down.
    overflowY: 'auto',
    // 'auto' = scrollbar appears only when content overflows.
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px 0',
  },

  typingIndicator: {
    display: 'flex',
    gap: '4px',
    padding: '4px 16px',
    alignItems: 'center',
  },

  typingDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--purple)',
    animation: 'blink 1.2s ease-in-out infinite',
    // Each dot has a different animationDelay (set inline above)
    // so they blink in sequence, not all at once.
    display: 'block',
  },

  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    padding: '10px 12px',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },

  textarea: {
    flex: 1,
    backgroundColor: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    padding: '10px 16px',
    color: 'var(--text)',
    fontSize: '16px',
    lineHeight: '1.5',
    resize: 'none',
    // 'none' prevents manual resize handle — we auto-resize instead.
    outline: 'none',
    // Remove default browser focus outline — we style focus ourselves.
    fontFamily: 'inherit',
    // 'inherit' = use the same font as the body.
    maxHeight: '120px',
    overflowY: 'auto',
  },

  sendBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'var(--purple-dim)',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background-color 0.15s',
  },

  sendBtnDisabled: {
    backgroundColor: 'var(--border)',
    cursor: 'not-allowed',
  },

  proactiveBanner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
    margin: '8px 12px',
    padding: '12px',
    backgroundColor: 'rgba(147, 112, 219, 0.08)',
    border: '1px solid rgba(147, 112, 219, 0.3)',
    borderLeft: '3px solid var(--purple)',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    width: 'calc(100% - 24px)',
  },

  proactiveLabel: {
    color: 'var(--purple)',
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },

  proactiveText: {
    color: 'var(--lavender)',
    fontSize: '14px',
    fontStyle: 'italic',
    lineHeight: '1.5',
  },

  proactiveTap: {
    color: 'var(--text-muted)',
    fontSize: '11px',
  },
};
