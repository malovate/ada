from database import get_db, memory_collection
from datetime import datetime
import aiosqlite
import json

# ===========================
# Ada has two memory types:
# 1. Episodic memory (SQlite)
#    Like a diary, stores every memory, in order, with timestamps.
#    It's important for recalling something I said exactly
#
# 2. Semantic memory (ChromaDB)
#    This is like a feelings-based memory. ada finds memories related by meaning
# ==========================

async def save_message(role: str, content: str, emotional_context: str = None):
    # save one message to both memories simultaneously

    # ==== step 1: save to episodic memory ====
    async with get_db() as db:
        await db.execute(
            """INSERT INTO conversations (role, content, emotional_context)
            VALUES (?, ?, ?)""",
            (role, content, emotional_context)
        )
        await db.commit()

    # ==== save to Semantic memory ====
    # we need to give a unique ID for a particular memory
    memory_id = f"{role}_{str(datetime.now()).replace(' ', '_').replace(':', '-')}"

    memory_collection.add(
        documents=[content],   # Must be a list
        ids=[memory_id], # Also a list
        metadatas=[{            # a list of dictionaries
            "role": role,
            "timestamp": str(datetime.now()),
            "emotional_context": emotional_context or ""

        }]
    )

async def get_recent_history(limit: int = 20) -> list[dict]: # gets the last 'limit' messages from SQLite
    async with get_db() as db:
        # Select role and content ordered by id DESC (newest firs)
        # then apply the limit
        cursor = await db.execute(
            """SELECT role, content FROM conversations
            ORDER BY id DESC LIMIT ?""",
            (limit,)
        )
        rows = await cursor.fetchall()

    # The query returns newest first, but claude needs oldest first.
    # So we reverse the list
    rows = rows[::-1]

    # convert each tuple to a dict the Anthropic API understands
    return [{"role": row[0], "content": row[1]} for row in rows]

async def recall_relevant_memories(query: str, n_results: int = 5) -> list[str]:
    try:
        results = memory_collection.query(
            query_texts=[query],
            n_results=n_results
        )
        documents = results["documents"][0]
        metadatas = results["metadatas"][0]

        # format each memory as "Paul said..." or "Ada said..."
        # so Ada knows the source when reading her memories.
        memories = []
        for doc, meta in zip(documents, metadatas):
            role_label = "Paul said" if meta["role"] == "user" else "Ada said"
            memories.append(f'{role_label}: "{doc}"')
            return memories
    except Exception as e:
        # ChromaDB may fail for example if there are not enough memories yet
        print(f"Memory recall failed:  {e}")
        return []

async  def get_ada_state() -> dict:
    """
    Reads Ada's current state from ada_state table and
    returns: mood, paul_facts dict and current_thought.
    """
    async with get_db() as db:
        cursor = await db.execute(
            "SELECT current_mood, paul_facts, current_thought FROM ada_state WHERE id = 1"
        )
        row = await cursor.fetchone()
    if row:
        return{
            "mood": row[0],
            "paul_facts": json.loads(row[1]),
            "current_thought": row[2]
        }
    # Fallback
    return {"mood": "curious", "paul_facts": {}, "current_thought": "..."}

async def update_ada_state(mood: str = None, paul_facts: dict = None, thought: str = None):
    # Update Ada's internal state after each conversation.
    # Only update the fields I pass, others stay unchangesd.
    async with get_db() as db:
        if mood:
            await db.execute(
                "UPDATE ada_state SET current_mood = ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1",
                (mood,)
            )
        if paul_facts is not None:
            await db.execute(
                "UPDATE ada_state SET paul_facts = ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1",
                (json.dumps(paul_facts),)
            )
        if thought:
            await db.execute(
                "UPDATE ada_state SET current_thought = ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1",
                (thought,)
            )
            await db.commit()


async def update_facts(new_facts: dict):
    state = await get_ada_state()
    existing_facts = state["paul_facts"]
    existing_facts.update(new_facts)

    await update_ada_state(paul_facts=existing_facts)
