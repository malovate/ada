// ============================================================
// src/components/ChatBubble.jsx — Human Inbox Style Bubbles
// ============================================================
// This renders one message in the conversation.
//
// LAYOUT:
//   Ada's messages  → LEFT side. Small avatar + distinct bubble.
//   Paul's messages → RIGHT side. Plain bubble, no avatar.
//
// The goal: open this app and it should feel like iMessage or
// WhatsApp — a real inbox with a real person, not a chatbot UI.
// ============================================================

// ── Avatar path ───────────────────────────────────────────────
// Ada's photo lives in /public/ — Vite serves public/ as the
// root of the site. So '/ada-avatar.png' resolves to the file
// we placed at webapp/public/ada-avatar.png.
const ADA_AVATAR = '/ada-avatar.png';

// ── Colors ────────────────────────────────────────────────────
const COLORS = {
  // Ada's bubble — distinctly different from the background.
  // A deep warm purple, clearly not the page background (#0a0a0f).
  adaBubble:    '#1e1530',
  adaBubbleBorder: '#3a2a5a',
  adaText:      '#e8e0f8',     // near-white with a lavender tint

  // Paul's bubble — dark neutral
  paulBubble:   '#1a2035',
  paulBubbleBorder: '#2a3550',
  paulText:     '#dde8ff',

  // Shared
  timestamp:    '#555570',
  speakerBtn:   '#9370db',
};


// ── ChatBubble Component ──────────────────────────────────────
// Props:
//   message        → { id, role, content, timestamp }
//   onPlayAudio(text) → called when speaker icon is tapped
export default function ChatBubble({ message, onPlayAudio }) {
  const isAda = message.role === 'assistant';

  // Format timestamp as "9:45 PM"
  const time = new Date(message.timestamp || Date.now())
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });


  // ── Ada's message ─────────────────────────────────────────
  if (isAda) {
    return (
      <div style={styles.adaRow}>

        {/* ── Small circular avatar ── */}
        {/* Shows Ada's photo to the left of her bubble.
            'border-radius: 50%' turns a square image into a circle.
            object-fit: cover scales the image to fill the circle
            without distortion — same as CSS background-size: cover */}
        <img
          src={ADA_AVATAR}
          alt="Ada"
          style={styles.avatar}
        />

        {/* ── Bubble + meta column ── */}
        <div style={styles.adaColumn}>

          {/* Name label above the first bubble */}
          <span style={styles.adaName}>Ada</span>

          {/* The bubble itself */}
          <div style={styles.adaBubble}>
            <p style={styles.adaText} className="selectable">
              {message.content}
            </p>
          </div>

          {/* Row below bubble: timestamp + optional speaker button */}
          <div style={styles.metaRow}>
            <span style={styles.timestamp}>{time}</span>

            {/* Speaker button — tap to hear Ada say this */}
            {onPlayAudio && (
              <button
                style={styles.speakerBtn}
                onClick={() => onPlayAudio(message.content)}
                title="Hear Ada say this"
              >
                {/* Simple speaker SVG — cleaner than an emoji */}
                <svg width="13" height="13" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </button>
            )}
          </div>

        </div>
      </div>
    );
  }


  // ── Paul's message ────────────────────────────────────────
  return (
    <div style={styles.paulRow}>
      <div style={styles.paulColumn}>
        <div style={styles.paulBubble}>
          <p style={styles.paulText} className="selectable">
            {message.content}
          </p>
        </div>
        <span style={{ ...styles.timestamp, textAlign: 'right' }}>
          {time}
        </span>
      </div>
    </div>
  );
}


// ── Styles ────────────────────────────────────────────────────
const styles = {

  // ── Ada row: avatar + bubble side by side ─────────────────
  adaRow: {
    display: 'flex',
    flexDirection: 'row',     // horizontal layout
    alignItems: 'flex-end',   // avatar sits at the bottom of the bubble
    gap: '8px',
    padding: '2px 12px',
    maxWidth: '88%',
    // 'animation' references fadeInUp from global.css
    animation: 'fadeInUp 0.2s ease-out',
  },

  avatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',      // circle
    objectFit: 'cover',       // fill circle without distortion
    objectPosition: 'top',    // show the face (top of image), not lower body
    flexShrink: 0,            // don't let it compress if space is tight
    border: '1.5px solid #3a2a5a',
    // subtle border matches Ada's bubble border color
  },

  adaColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    maxWidth: 'calc(100% - 44px)',
    // 44px = avatar width (34) + gap (8) + a little breathing room
  },

  adaName: {
    color: '#9370db',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.8px',
    paddingLeft: '4px',
  },

  adaBubble: {
    backgroundColor: COLORS.adaBubble,
    border: `1px solid ${COLORS.adaBubbleBorder}`,
    borderRadius: '18px',
    borderBottomLeftRadius: '4px',
    // The flat corner creates the "tail" pointing toward the avatar.
    // This is the standard chat bubble convention — the tail shows
    // who the message belongs to.
    padding: '10px 14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },

  adaText: {
    color: COLORS.adaText,
    fontSize: '15px',
    lineHeight: '1.55',
    margin: 0,
    // fontStyle: 'italic' removed — in a real inbox feel,
    // the bubble itself signals it's Ada. No need for italic.
  },

  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    paddingLeft: '4px',
  },

  speakerBtn: {
    background: 'none',
    border: 'none',
    color: COLORS.speakerBtn,
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    opacity: 0.6,
  },

  // ── Paul row: bubble on the right ─────────────────────────
  paulRow: {
    display: 'flex',
    justifyContent: 'flex-end',    // push to right side
    padding: '2px 12px',
    animation: 'fadeInUp 0.2s ease-out',
    maxWidth: '100%',
  },

  paulColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    maxWidth: '80%',
    alignItems: 'flex-end',
  },

  paulBubble: {
    backgroundColor: COLORS.paulBubble,
    border: `1px solid ${COLORS.paulBubbleBorder}`,
    borderRadius: '18px',
    borderBottomRightRadius: '4px',  // tail on the right
    padding: '10px 14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },

  paulText: {
    color: COLORS.paulText,
    fontSize: '15px',
    lineHeight: '1.55',
    margin: 0,
  },

  timestamp: {
    color: COLORS.timestamp,
    fontSize: '11px',
  },
};
