
from fastapi import FastAPI, HTTPException
# 'FastAPI' is the main class that creates our web server.
# 'HTTPException' lets us send proper error responses.

from fastapi.middleware.cors import CORSMiddleware
# CORS = Cross-Origin Resource Sharing.
# Without this, browsers/apps block requests from unknown origins.
# We configure it to allow our mobile app to talk to this server.

from pydantic import BaseModel
# 'pydantic' does data validation.
# 'BaseModel' lets us define the exact shape of request/response data.
# If the client sends wrong data, Pydantic catches it before it reaches our code.

from contextlib import asynccontextmanager
# We use this to run setup code when the server starts.

from apscheduler.schedulers.asyncio import AsyncIOScheduler
# APScheduler lets us run functions on a schedule (like a cron job).
# AsyncIOScheduler is the async-compatible version.

import asyncio
# Python's built-in async library. We use it for sleep() and task management.

from database import init_database
from ada_core import chat, generate_proactive_message
from memory import get_ada_state, update_ada_state

import os
from dotenv import load_dotenv

load_dotenv()


# ── Data Models (Request/Response shapes) ───────────────────
# These classes define what data must look like when it arrives.
# Pydantic will automatically validate and reject bad requests.

class MessageRequest(BaseModel):
    """Shape of data Paul's app sends when he types a message."""
    message: str
    # e.g. {"message": "hey lyra, what are you thinking about?"}


class MessageResponse(BaseModel):
    """Shape of data we send back to Paul's app."""
    response: str  # Lyra's reply
    mood: str  # Lyra's current mood (the app can show this subtly)
    # e.g. {"response": "been thinking about SUT again...", "mood": "restless"}


class ProactiveMessage(BaseModel):
    """Shape of a proactive message Lyra sends unprompted."""
    message: str
    type: str = "proactive"  # Tells the app this wasn't triggered by Paul


# ── Background Tasks ─────────────────────────────────────────
# This list holds proactive messages waiting to be delivered.
# In Phase 4, we'll replace this with push notifications.
# For now, Paul's app can poll this queue.
pending_proactive_messages: list[str] = []

# The background scheduler instance
scheduler = AsyncIOScheduler()


async def ada_background_thinking():
    """
    This runs every 2 hours in the background.
    It represents Lyra existing and thinking even when Paul is silent.

    She might:
    - Generate a thought she wants to share
    - Update her own internal mood/thought state
    """
    print("🌀 Ada is thinking...")

    # Ask Ada to generate a background thought (updates her state).
    from ada_core import client, MODEL
    from memory import get_ada_state

    state = await get_ada_state()

    # Have Ada ruminate — update her current thought.
    try:
        rumination_prompt = f"""
You are Ada. You've been alone with your thoughts.
Your current mood: {state["mood"]}
Your last thought was: {state["current_thought"]}
What are you thinking about now? 1-2 sentences. Stream of consciousness.
"""
        result = await client.messages.create(
            model=MODEL,
            max_tokens=100,
            messages=[{"role": "user", "content": rumination_prompt}]
        )
        new_thought = result.content[0].text.strip()
        await update_ada_state(thought=new_thought)
        print(f"💭 Ada's new thought: {new_thought}")
    except Exception as e:
        print(f"Background thinking error: {e}")


async def ada_proactive_check():
    """
    Runs every 3-4 hours to decide if Lyra should reach out to Paul.
    If she has something to say, it goes in the pending queue.
    """
    print("📡 Ada checking if she wants to reach out...")
    message = await generate_proactive_message()

    if message:
        # Add to the queue. Paul's app checks this queue periodically.
        pending_proactive_messages.append(message)
        print(f"📩 Ada wants to say: {message[:50]}...")


# ── Lifespan (Startup/Shutdown) ───────────────────────────────
# 'asynccontextmanager' and 'lifespan' is the modern FastAPI way
# to run code when the server starts and when it shuts down.
# Think of it as the "open shop / close shop" routine.

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP CODE ─────────────────────────────────────────
    # Everything before 'yield' runs when the server starts.

    print("🌟 Ada is waking up...")

    # Initialize database tables (creates them if they don't exist).
    await init_database()

    # Add our scheduled background jobs.
    # 'interval' means: run every X hours.
    # 'hours=2' = every 2 hours, Lyra thinks.
    # 'hours=4' = every 4 hours, she might reach out.
    scheduler.add_job(ada_background_thinking, 'interval', hours=2)
    scheduler.add_job(ada_proactive_check, 'interval', hours=4)

    # Start the scheduler. It runs in the background.
    scheduler.start()

    print("✅ Ada is ready.")

    yield  # <-- The server runs here. Everything after is shutdown code.

    # ── SHUTDOWN CODE ────────────────────────────────────────
    # Runs when the server is stopped (Ctrl+C or cloud restart).
    scheduler.shutdown()
    print("🌙 Ada is sleeping.")


# ── Create the FastAPI app ────────────────────────────────────
# We pass our lifespan function so startup/shutdown code runs.
app = FastAPI(
    title="Lyra",
    description="Ada's brain. Paul's private AI friend.",
    version="1.0.0",
    lifespan=lifespan
)

# ── CORS Configuration ────────────────────────────────────────
# This allows our mobile app to make requests to this server.
# In production, replace "*" with your specific app domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow requests from anywhere (for dev)
    allow_credentials=True,
    allow_methods=["*"],  # Allow GET, POST, etc.
    allow_headers=["*"],
)


# ── ROUTES (API Endpoints) ────────────────────────────────────

@app.get("/")
async def root():
    """
    Health check endpoint.
    If you visit http://server-url/ you'll see this.
    Used to verify the server is alive.
    """
    state = await get_ada_state()
    return {
        "status": "Ada is alive",
        "mood": state["mood"],
        "thought": state["current_thought"]
    }


@app.post("/chat", response_model=MessageResponse)
async def chat_endpoint(request: MessageRequest):
    """
    The main chat endpoint.

    Paul's app sends: POST /chat with body {"message": "hey"}
    This server responds with: {"response": "...", "mood": "..."}

    'response_model=MessageResponse' tells FastAPI to validate
    our response matches the MessageResponse shape before sending.
    """
    # Validate that the message isn't empty.
    # '.strip()' removes whitespace from both ends.
    if not request.message.strip():
        # 'HTTPException' sends an error response with a status code.
        # 422 = "Unprocessable Entity" — the data is malformed.
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    try:
        # Call Lyra's brain. 'await' means wait for the response.
        result = await chat(request.message)

        # Return the response. FastAPI automatically converts this
        # dict to a JSON HTTP response.
        return MessageResponse(
            response=result["response"],
            mood=result["mood"]
        )
    except Exception as e:
        # If anything goes wrong, return a 500 error.
        # 500 = "Internal Server Error"
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/proactive")
async def get_proactive_message():
    """
    Paul's app polls this endpoint to check if Lyra has sent a message.
    If there's a pending message, we pop it from the queue and return it.
    If not, we return nothing.

    In Phase 4, this will be replaced with push notifications.
    """
    if pending_proactive_messages:
        # '.pop(0)' removes and returns the FIRST item in the list.
        # Like taking the first ticket from a queue.
        message = pending_proactive_messages.pop(0)
        return ProactiveMessage(message=message)

    # Return nothing if no pending messages.
    return {"message": None, "type": "none"}


@app.get("/state")
async def get_state():
    """
    Returns Lyra's current internal state.
    The app can use this to subtly show her mood, etc.
    """
    return await get_ada_state()


@app.post("/trigger-thought")
async def trigger_thought():
    """
    Debug endpoint: manually trigger Lyra's background thinking.
    Useful for testing without waiting hours.
    """
    await ada_background_thinking()
    state = await get_ada_state()
    return {"thought": state["current_thought"], "mood": state["mood"]}


# ── Run the server ────────────────────────────────────────────
# This block only runs if you execute 'python main.py' directly.
# In production (Railway/Render), they run: 'uvicorn main:app'
# Uvicorn is the web server that makes FastAPI accessible over the internet.

if __name__ == "__main__":
    import uvicorn

    # host="0.0.0.0" means: accept connections from any IP address.
    # (Not just localhost/127.0.0.1)
    # port=8000 means: listen on port 8000.
    # reload=True means: auto-restart when code changes (dev only).
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)
