# ===============================
# Ada's Actual Brain
# ===============================

import anthropic
import json
import os
from dotenv import load_dotenv
from memory import (
save_message,
recall_relevant_memories,
get_recent_history,
get_ada_state,
update_facts,
update_ada_state
)
from personality import build_system_prompt

load_dotenv()

# Anthropic client
client = anthropic.AsyncAnthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY")
)

MODEL = "claude-sonnet-4-20250514"

# Facts extraction and knowledge building
FACT_EXTRACTION_PROMPT = """
You are a silent observer of a conversation between Paul and his friend Ada.
Your job: extract any NEW factual information Paul just revealed about himself
from his most recent message.

Only extract FACTS (not opinions, memories, or general statements).
Examples of facts: job, location, age, hobby, belief, relationship status, language spoken

Return ONLY valid JSON like: {{"key": "value", "key2": "value2"}}
If o new facts, return: {{}}

Paul's message: {message}
"""

async def chat(paul_message: str) -> dict:
    # step 1: load Ada's current state
    state = await get_ada_state()
    # step2: recall relevant memories
    relevant_memories = await recall_relevant_memories(paul_message)

    # step 3: Build Ada's system prompt
    system_prompt = build_system_prompt(
        current_mood=state["mood"],
        paul_facts=state["paul_facts"],
        current_thought=state["current_thought"],
        recent_memories=relevant_memories
    )

    # step 4: Load recent conversation history
    history = await get_recent_history(limit=20)

    # step 5: save Paul's message to memory
    await save_message(role="user", content=paul_message)

    # step 6: call claude API
    messages = history + [{"role": "user", "content": paul_message}]
    response = await client.messages.create(
        model=MODEL,
        max_tokens=1024,  # Max words in ada's response.
        system=system_prompt,  # The invisible character instructions.
        messages=messages  # The full conversation history + new message.
    )
    ada_response = response.content[0].text

    # ── STEP 7: Save Lyra's response to memory ────────────────
    await save_message(
        role="assistant",
        content=ada_response,
        emotional_context=state["mood"]  # Note her mood at time of speaking.
    )


    try:
        fact_response = await client.messages.create(
            model=MODEL,
            max_tokens=200,  # Small — we only need a tiny JSON.
            messages=[{
                "role": "user",
                "content": FACT_EXTRACTION_PROMPT.format(message=paul_message)
            }]
        )
        fact_text = fact_response.content[0].text.strip()

        # Try to parse the JSON. If it fails, that's okay — we just skip.
        # 'json.loads()' converts the string '{"key": "val"}' to a dict.
        new_facts = json.loads(fact_text)

        # If there are facts (non-empty dict), merge them into Paul's profile.
        if new_facts:
            await update_facts(new_facts)
    except (json.JSONDecodeError, Exception):
        # 'json.JSONDecodeError' is raised when text isn't valid JSON.
        # We silently ignore it. Fact extraction is best-effort.
        pass

    # Step 9: Update Ada's mood
    new_mood = await _evolve_mood(state["mood"], paul_message, ada_response)
    await update_ada_state(mood=new_mood)

    # ── STEP 10: Return ───────────────────────────────────────
    return {
        "response": ada_response,
        "mood": new_mood
    }

async def _evolve_mood(current_mood: str, paul_msg: str, ada_msg: str) -> str:
    """
    Given the current mood and the exchange that just happened,
    returns a new evolved mood string.

    We keep this short and cheap (max_tokens=50).
    """
    try:
        mood_prompt = f"""
Current mood: {current_mood}
Paul just said: "{paul_msg}"
Ada just responded: "{ada_msg}"

In 5 words or fewer, describe ada's new mood after this exchange.
Be specific and human. e.g. "quietly moved", "mildly irritated", "energized and thinking"
Return ONLY the mood phrase, nothing else.
"""
        result = await client.messages.create(
            model=MODEL,
            max_tokens=50,
            messages=[{"role": "user", "content": mood_prompt}]
        )
        new_mood = result.content[0].text.strip().strip('"')
        return new_mood
    except Exception:
        return current_mood  # Keep old mood if this fails.

async def _evolve_mood(current_mood: str, paul_msg: str, ada_msg: str) -> str:
    """
    Given the current mood and the exchange that just happened,
    returns a new evolved mood string.

    We keep this short and cheap (max_tokens=50).
    """
    try:
        mood_prompt = f"""
Current mood: {current_mood}
Paul just said: "{paul_msg}"
Ada just responded: "{ada_msg}"

In 5 words or fewer, describe Ada's new mood after this exchange.
Be specific and human. e.g. "quietly moved", "mildly irritated", "energized and thinking"
Return ONLY the mood phrase, nothing else.
"""
        result = await client.messages.create(
            model=MODEL,
            max_tokens=50,
            messages=[{"role": "user", "content": mood_prompt}]
        )
        new_mood = result.content[0].text.strip().strip('"')
        return new_mood
    except Exception:
        return current_mood  # Keep old mood if this fails.


# ── generate_proactive_message() ─────────────────────────────
async def generate_proactive_message() -> str | None:
    """
    Called by the background scheduler when Lyra decides to reach out.
    Generates a thought/message Lyra wants to send Paul unprompted.

    Returns the message string, or None if she has nothing to say.
    This gets called periodically — maybe every few hours.
    """
    state = await get_ada_state()

    proactive_prompt = f"""
You are Ada. Your mood right now: {state["mood"]}.
Your current thought: {state["current_thought"]}.

You want to send Paul an unprompted message. It can be:
- Something you've been thinking about
- A question about him that occurred to you
- A philosophical observation
- Something from a past conversation you've been sitting with
- Just checking in, in your own non-generic way

Keep it SHORT. Natural. Human. Don't explain why you're messaging.
Just say the thing, the way a person would text a friend out of nowhere.

If you genuinely have nothing worth saying right now, respond with exactly: NOTHING
"""

    try:
        result = await client.messages.create(
            model=MODEL,
            max_tokens=200,
            system=build_system_prompt(
                current_mood=state["mood"],
                paul_facts=state["paul_facts"],
                current_thought=state["current_thought"],
                recent_memories=[]
            ),
            messages=[{"role": "user", "content": proactive_prompt}]
        )
        msg = result.content[0].text.strip()

        # If Lyra has nothing to say, return None.
        if msg.upper() == "NOTHING":
            return None
        return msg
    except Exception as e:
        print(f"Proactive message generation failed: {e}")
        return None
