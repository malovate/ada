// ============================================================
// src/components/ChatBubble.jsx — One Message on Screen
// ============================================================
// Renders a single message bubble.
// Paul's messages → right-aligned bubble
// Ada's messages  → left-aligned plain text (more human)
// ============================================================

// ── ChatBubble Component ──────────────────────────────────────
// Props:
//   message  → { role, content, timestamp }
//   onPlayAudio(text) → callback to play Ada's voice for this message
export default function ChatBubble({ message, onPlayAudio }) {
  const isPaul = message.role === 'user';

  // Format timestamp as "9:45 PM"
  const time = new Date(message.timestamp || Date.now())
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ── Ada's message ─────────────────────────────────────────
  if (!isPaul) {
    return (
      // CSS classes reference styles defined below in the <style> tag
      // approach. Here we use inline styles for full control.
      <div style={styles.adaRow}>

        {/* Name label above message */}
        <span style={styles.adaLabel}>Ada</span>

        {/* Message text — selectable so Paul can copy it */}
        <p style={styles.adaText} className="selectable">
          {message.content}
        </p>

        {/* Bottom row: timestamp + speaker button */}
        <div style={styles.adaMeta}>
          <span style={styles.timestamp}>{time}</span>

          {/* Speaker icon — tap to hear Ada say this message */}
          {onPlayAudio && (
            <button
              style={styles.speakerBtn}
              onClick={() => onPlayAudio(message.content)}
              title="Hear Ada say this"
              // 'title' shows a tooltip on hover (desktop)
            >
              🔈
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Paul's message ────────────────────────────────────────
  return (
    <div style={styles.paulRow}>
      <div style={styles.paulBubble}>
        <p style={styles.paulText} className="selectable">
          {message.content}
        </p>
      </div>
      <span style={{ ...styles.timestamp, textAlign: 'right' }}>{time}</span>
      {/* '...styles.timestamp' spreads all timestamp styles,
          then we override textAlign specifically for Paul's side.
          This is called the "spread operator" — copies all properties
          from one object into a new one. Like Python's **kwargs. */}
    </div>
  );
}


// ── Styles as a JavaScript object ────────────────────────────
// We define styles this way (object of objects) because:
// 1. They live next to the component — easy to find and change
// 2. We can reference them by name: styles.adaRow
// 3. JavaScript can compute values (like mixing in variables)
//
// This pattern is called "CSS-in-JS" (styles written in JavaScript).
const styles = {

  adaRow: {
    display: 'flex',
    flexDirection: 'column',  // Stack children vertically
    alignItems: 'flex-start', // Align to the left
    maxWidth: '80%',
    padding: '4px 16px',
    animation: 'fadeInUp 0.2s ease-out',
    // fadeInUp is defined in global.css — message slides up on appear
  },

  adaLabel: {
    color: 'var(--purple)',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },

  adaText: {
    color: 'var(--lavender)',
    fontSize: '16px',
    lineHeight: '1.6',
    fontStyle: 'italic',
    margin: 0,
  },

  adaMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
  },

  paulRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',   // Align to the right
    maxWidth: '80%',
    alignSelf: 'flex-end',    // Push the whole row to the right
    padding: '4px 16px',
    animation: 'fadeInUp 0.2s ease-out',
  },

  paulBubble: {
    backgroundColor: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    borderRadius: '18px',
    borderBottomRightRadius: '4px',  // "tail" effect
    padding: '10px 14px',
  },

  paulText: {
    color: 'var(--text)',
    fontSize: '16px',
    lineHeight: '1.6',
    margin: 0,
  },

  timestamp: {
    color: 'var(--text-muted)',
    fontSize: '11px',
    marginTop: '3px',
  },

  speakerBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 4px',
    borderRadius: '4px',
    // ':hover' pseudo-classes don't work in inline styles.
    // For hover effects on this button, we'd use a CSS class.
    // For now, the emoji itself is enough feedback.
    opacity: 0.6,
  },
};
