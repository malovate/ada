import os
import chromadb
import asyncio
import aiosqlite

DB_PATH = os.path.join(os.path.dirname(__file__), "ada_memory.db")

# create chromadb client
chroma_client = chromadb.PersistentClient(
    path = os.path.join(
        os.path.dirname(__file__), ".chroma"
    )
)
# create chroma collection
memory_collection = chroma_client.get_or_create_collection(
    name = "ada_memories",
    metadata = {"hnsw:space": "cosine"}
)

# ---- SQL setup -----
INIT_SQL = """
CREATE TABLE IF NOT EXISTS conversations(
    id  INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    emotional_context TEXT
);
CREATE TABLE IF NOT EXISTS ada_state(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    current_mood TEXT DEFAULT "curious",
    paul_facts TEXT DEFAULT "{}",
    current_thought TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ada_thoughts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thought TEXT NOT NULL,
    topic TEXT, -- E.G. SUT, consciousness,
    was_shared BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
"""

# ------ Database initialization ------
async def init_database():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(INIT_SQL)
        # check if ada_state already contains a row (it should contain only one row)
        cursor = await db.execute("SELECT COUNT(*) FROM ada_state")
        count = (await cursor.fetchone())[0]

        # if no row in ada_state we insert her first state
        if count == 0:
            await db.execute(
                """
                INSERT INTO ada_state
                (current_mood, paul_facts, current_thought)
                values (?, ?, ?)
                """,
                ("curious and a little restless", "{}", "I wonder who I'm about to meet")
            )
        await db.commit()
    print("✅ Database successfully initialized")

def get_db():
    return aiosqlite.connect(DB_PATH)
    # this is a helper that other files will be using to access the database
