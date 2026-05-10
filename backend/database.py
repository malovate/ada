# ============================================================
# database.py — Ada's Filing Cabinet
# ============================================================
# Ada has two types of storage working together:
#
# 1. SQLite (via aiosqlite)
#    A database that lives in a single file on disk.
#    Like a structured diary — every message stored in rows,
#    searchable by ID, role, timestamp.
#    Best for: recent history, Ada's state, ordered lookups.
#
# 2. ChromaDB (PersistentClient)
#    A "vector database" — finds memories by MEANING, not by ID.
#    When Paul says "I feel invisible", ChromaDB can surface a
#    memory from weeks ago where Paul said "nobody notices me."
#    Same feeling, different words — ChromaDB catches this.
#    Best for: semantic recall, surfacing relevant past moments.
#
# WHY PersistentClient and NOT HttpClient?
#    HttpClient connects to a separate ChromaDB server process.
#    That's useful for large-scale apps with dedicated infrastructure.
#    For Ada — a personal project — PersistentClient is the right
#    choice. It writes files directly to disk (our Railway volume),
#    requires no extra service, no extra cost, and no extra complexity.
#    Ada's memory is just files in a folder that never gets deleted.
#
# PERSISTENCE STRATEGY (local vs Railway):
#    Locally:   files go in the backend/ folder (dev convenience)
#    On Railway: files go in /data (a mounted volume that survives restarts)
#    The DATA_DIR environment variable switches between the two.
#    If DATA_DIR is not set → local mode. If it is set → production mode.
#    The code is identical in both cases.
# ============================================================

import os
import aiosqlite
import chromadb

# ── Storage paths ─────────────────────────────────────────────
#
# os.getenv("DATA_DIR") reads the DATA_DIR environment variable.
# On Railway: you set DATA_DIR=/data (your mounted persistent volume).
# Locally: DATA_DIR is not set, so getenv returns None.
# The 'or' operator means: if the left side is None/empty, use the right.
# So locally we fall back to the folder where database.py lives.
#
# Result:
#   Local:    DATA_DIR = /path/to/ada/backend/
#   Railway:  DATA_DIR = /data
DATA_DIR = os.getenv("DATA_DIR") or os.path.dirname(os.path.abspath(__file__))
# os.path.abspath ensures we get the full absolute path,
# not a relative one. Safer across different operating systems.

# Create the directory if it doesn't already exist.
# exist_ok=True → no error if it already exists. Safe to call every boot.
os.makedirs(DATA_DIR, exist_ok=True)

# Full path to our SQLite database file.
# os.path.join() builds a path correctly for any OS:
#   Windows: C:\data\ada_memory.db
#   Linux:   /data/ada_memory.db
DB_PATH = os.path.join(DATA_DIR, "ada_memory.db")

# Full path to the ChromaDB data folder.
# ChromaDB creates several files inside this folder.
# As long as this folder survives restarts, Ada's semantic memory is intact.
CHROMA_PATH = os.path.join(DATA_DIR, "ada_chroma")
# Named "ada_chroma" (not ".chroma") so it's visible in file explorers.
# Hidden folders (starting with ".") can be easy to accidentally skip
# when uploading/backing up.

# Ensure the ChromaDB folder also exists before ChromaDB tries to use it.
os.makedirs(CHROMA_PATH, exist_ok=True)

print(f"📂 Storage path: {DATA_DIR}")
# This print helps you verify the correct path is being used
# when Ada starts up — visible in Railway logs.


# ── ChromaDB setup ────────────────────────────────────────────
#
# chromadb.PersistentClient(path=CHROMA_PATH) tells ChromaDB:
#   "Save all your data to files inside CHROMA_PATH."
# On every restart, ChromaDB reads those files and Ada's
# semantic memory is fully restored — she remembers everything.
#
# This is created once at module load time (when Python imports this file).
# The same client instance is shared across the entire app.
# Creating multiple clients pointing at the same path causes lock errors.
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

# A ChromaDB "collection" is like a named folder of embeddings.
# get_or_create_collection is safe to call every startup:
#   - First run: creates the collection
#   - Subsequent runs: finds and returns the existing one
memory_collection = chroma_client.get_or_create_collection(
    name="ada_memories",

    metadata={
        # "hnsw:space": "cosine" tells ChromaDB which mathematical
        # method to use when comparing memories.
        #
        # "cosine" measures the ANGLE between two vectors.
        # Two sentences with similar meaning point in similar directions
        # in vector space, so their angle is small → high similarity.
        # This works better than raw distance for text meaning comparison.
        "hnsw:space": "cosine"
    }
)


# ── SQL Table Definitions ─────────────────────────────────────
# SQL = Structured Query Language. It's how we talk to SQLite.
# We define our three tables here as one big string.
# CREATE TABLE IF NOT EXISTS = create only if it doesn't already exist.
# Safe to run every time Ada boots.

INIT_SQL = """

CREATE TABLE IF NOT EXISTS conversations (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    -- AUTOINCREMENT: each new row gets the next number automatically.
    -- Like a receipt number that never repeats.

    role      TEXT NOT NULL,
    -- 'user' = Paul, 'assistant' = Ada.
    -- NOT NULL means this column can never be empty.

    content   TEXT NOT NULL,
    -- The actual text of the message.

    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- When the message was sent.
    -- DEFAULT CURRENT_TIMESTAMP = filled in automatically by SQLite.

    emotional_context TEXT
    -- Ada's mood at the time she sent this message.
    -- Only populated for Ada's messages, NULL for Paul's.
    -- e.g. "quietly moved" or "curious and restless"
);


CREATE TABLE IF NOT EXISTS ada_state (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,

    current_mood  TEXT DEFAULT 'curious',
    -- Ada's current emotional state. e.g. "quietly excited"

    paul_facts    TEXT DEFAULT '{}',
    -- A JSON string of facts Ada has learned about Paul.
    -- Starts empty. Grows as they talk.
    -- e.g. '{"city": "Lusaka", "interest": "philosophy"}'
    -- We store it as TEXT and parse it in Python with json.loads().

    current_thought TEXT,
    -- What Ada is thinking about right now.
    -- Updated by the background thinking engine every 2 hours.

    last_updated  DATETIME DEFAULT CURRENT_TIMESTAMP
    -- When this row was last changed.
);


CREATE TABLE IF NOT EXISTS ada_thoughts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    thought     TEXT NOT NULL,
    -- A thought Ada had while Paul was offline.

    topic       TEXT,
    -- What the thought is about. e.g. "SUT", "consciousness", "Paul"
    -- Used for filtering and categorising later.

    was_shared  BOOLEAN DEFAULT FALSE,
    -- Has Ada told Paul this thought yet?
    -- FALSE = still pending. TRUE = already brought up in conversation.

    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

"""


# ── init_database() ───────────────────────────────────────────
async def init_database():
    """
    Called once when Ada's server starts.
    Creates all tables (if they don't exist) and inserts Ada's
    first state row if she's never run before.
    """

    # 'async with aiosqlite.connect(DB_PATH) as db:' opens the database.
    # If ada_memory.db doesn't exist yet, SQLite creates it automatically.
    # 'async with' is the async version of 'with' — it ensures the
    # connection is closed cleanly even if an error occurs.
    async with aiosqlite.connect(DB_PATH) as db:

        # executescript runs all our CREATE TABLE statements at once.
        await db.executescript(INIT_SQL)

        # Check if ada_state has any rows yet.
        # SELECT COUNT(*) returns one row containing the total row count.
        cursor = await db.execute("SELECT COUNT(*) FROM ada_state")

        # fetchone() returns one result row as a Python tuple.
        # e.g. (0,) if empty, (1,) if one row exists.
        # [0] extracts the first (and only) element of that tuple.
        count = (await cursor.fetchone())[0]

        if count == 0:
            # First ever run — insert Ada's initial state.
            await db.execute(
                """INSERT INTO ada_state
                   (current_mood, paul_facts, current_thought)
                   VALUES (?, ?, ?)""",
                # '?' placeholders are filled by this tuple in order.
                # NEVER build SQL strings by concatenation — that's
                # SQL injection. Always use placeholders.
                (
                    "curious and a little restless",
                    "{}",   # Empty JSON object — no facts about Paul yet
                    "I wonder who I'm about to meet..."
                )
            )

        # commit() saves all changes to disk. Like Ctrl+S.
        # Without commit(), changes live only in memory and are lost.
        await db.commit()

    print("✅ Database initialised.")
    print(f"   SQLite:  {DB_PATH}")
    print(f"   ChromaDB: {CHROMA_PATH}")


# ── get_db() ──────────────────────────────────────────────────
def get_db():
    """
    Returns an async SQLite connection context manager.

    Other files use this instead of repeating aiosqlite.connect(DB_PATH).
    Centralising the connection here means if DB_PATH ever changes,
    we only update it in one place.

    Usage in other files:
        async with get_db() as db:
            await db.execute("SELECT ...")
    """
    return aiosqlite.connect(DB_PATH)
