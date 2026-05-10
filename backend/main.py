# ============================================================
# main.py — Ada's Front Door
# ============================================================
# This file is the entry point of our entire backend.
#
# Think of it like a restaurant:
#   - FastAPI is the restaurant building
#   - Each 'route' (@app.get, @app.post) is a menu item
#   - Paul's app (client) places an order (HTTP request)
#   - Our code cooks the meal (processes it) and returns it
#
# HTTP methods:
#   GET  — "give me something" (read-only)
#   POST — "here's data, do something with it" (create/action)
# ============================================================

from fastapi import FastAPI, HTTPException, File, UploadFile
# NEW: 'File' and 'UploadFile' handle incoming file uploads.
# 'UploadFile' wraps Paul's audio recording.
# It has a .read() method that gives us the raw audio bytes.

from fastapi.responses import Response
# NEW: 'Response' lets us send raw bytes back — not just JSON.
# Audio is binary data, not text, so we need this for Ada's voice.

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from database import init_database
from ada_core import chat, generate_proactive_message
from memory import get_ada_state, update_ada_state
from voice import transcribe_audio, speak
# NEW: Import our voice functions from voice.py
# transcribe_audio = Paul's audio → text (Whisper)
# speak            = Ada's text → MP3 audio (edge-tts)

import os
import httpx
from dotenv import load_dotenv
load_dotenv()


# ── Data Models ───────────────────────────────────────────────

class MessageRequest(BaseModel):
    """Shape of data Paul's app sends when he types a message."""
    message: str

class MessageResponse(BaseModel):
    """Shape of data we send back to Paul's app."""
    response: str
    mood: str

class VoiceMessageResponse(BaseModel):
    """
    Response when Paul sends a voice note.
    We return the transcription (what Paul said) AND Ada's text reply.
    Audio is fetched separately via /voice/speak. lyra
    """
    transcription: str   # What Paul said — shown as his message bubble
    response: str        # Ada's reply — shown as her message bubble
    mood: str
    has_audio: bool      # True = app should call /voice/speak for audio

class ProactiveMessage(BaseModel):
    message: str
    type: str = "proactive"


# ── Background Tasks ─────────────────────────────────────────
pending_proactive_messages: list[str] = []
scheduler = AsyncIOScheduler()


async def ada_background_thinking():
    """Runs every 2 hours. Ada thinks even when Paul is offline. lyra"""
    print("🌀 Ada is thinking...")
    from ada_core import client, MODEL
    state = await get_ada_state()
    try:
        result = await client.messages.create(
            model=MODEL,
            max_tokens=100,
            messages=[{"role": "user", "content": f"""
You are Ada. You've been alone with your thoughts.
Mood: {state["mood"]}. Last thought: {state["current_thought"]}.
What are you thinking now? 1-2 sentences. Stream of consciousness.
"""}]
        )
        await update_ada_state(thought=result.content[0].text.strip())
    except Exception as e:
        print(f"Background thinking error: {e}")


async def ada_proactive_check():
    """Runs every 4 hours. Decides if Ada wants to reach out."""
    message = await generate_proactive_message()
    if message:
        pending_proactive_messages.append(message)


# ── Lifespan (startup / shutdown) ────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🌟 Ada is waking up...")
    await init_database()
    scheduler.add_job(ada_background_thinking, 'interval', hours=2)
    scheduler.add_job(ada_proactive_check, 'interval', hours=4)
    scheduler.start()
    print("✅ Ada is ready.")
    yield
    scheduler.shutdown()
    print("🌙 Ada is sleeping.")


# ── FastAPI app ───────────────────────────────────────────────
app = FastAPI(
    title="Ada",
    description="Ada's brain. Paul's private AI friend.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════
# TEXT ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.get("/")
async def root():
    """Health check."""
    state = await get_ada_state()
    return {"status": "Ada is alive", "mood": state["mood"], "thought": state["current_thought"]}


@app.post("/chat", response_model=MessageResponse)
async def chat_endpoint(request: MessageRequest):
    """
    Main text chat.
    Paul sends: POST /chat {"message": "hey"}
    Gets back:  {"response": "...", "mood": "..."}
    """
    if not request.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty.")
    try:
        result = await chat(request.message)
        return MessageResponse(response=result["response"], mood=result["mood"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# VOICE ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.post("/voice/message", response_model=VoiceMessageResponse)
async def voice_message_endpoint(audio: UploadFile = File(...)):
    """
    Paul sends a voice note.

    HOW IT WORKS:
    The app records Paul's voice and sends the audio file to this endpoint.
    We transcribe it → pass to Ada's brain → return text.
    The app then calls /voice/speak to get Ada's audio response.

    'UploadFile = File(...)':
    - 'UploadFile' = the type. FastAPI wraps the uploaded file in this.
    - 'File(...)' = tells FastAPI this field is required (the '...' means required).
    - 'audio' = our variable name for the uploaded file.

    This endpoint expects a multipart/form-data request (not JSON).
    The app sends the audio file as a form field named "audio".
    """

    # Read all bytes from the uploaded audio file.
    # This is Paul's voice note as raw binary data.
    audio_bytes = await audio.read()

    if not audio_bytes:
        raise HTTPException(status_code=422, detail="Audio file is empty.")

    # ── Step 1: Speech → Text ─────────────────────────────
    # Transcribe Paul's audio using Whisper.
    # We detect the file extension so Whisper knows the format.
    # Browser MediaRecorder sends webm by default.
    filename = audio.filename or "voice_note.webm"
    extension = filename.rsplit(".", 1)[-1] if "." in filename else "webm"
    transcription = await transcribe_audio(audio_bytes, file_extension=extension)

    if not transcription:
        raise HTTPException(
            status_code=422,
            detail="Couldn't understand the audio. Please try again."
        )

    print(f"🎤 Paul said (voice): '{transcription}'")

    # ── Step 2: Text → Ada's brain ────────────────────────
    # The transcription is treated exactly like a typed message.
    # Ada doesn't know (or care) whether Paul typed or spoke.
    result = await chat(transcription)

    return VoiceMessageResponse(
        transcription=transcription,
        response=result["response"],
        mood=result["mood"],
        has_audio=True
    )


@app.post("/voice/speak")
async def speak_endpoint(request: MessageRequest):
    """
    Converts text to Ada's voice. Returns raw MP3 audio.

    WHY a separate endpoint from /voice/message?

    Because voice is optional and situational:
    - Paul might be in a quiet place (wants audio)
    - Paul might be in a meeting (just reads the text)
    - The app can show text immediately, then fetch audio in parallel

    The app calls this whenever it needs to PLAY something Ada said.
    Works for:
    - Her reply to Paul's voice note
    - Reading aloud a text reply (if Paul taps a speaker icon)
    - Proactive messages she sends him

    Returns: Raw MP3 bytes (binary), not JSON.
    """
    if not request.message.strip():
        raise HTTPException(status_code=422, detail="Nothing to speak.")

    audio_bytes = await speak(request.message)

    if not audio_bytes:
        raise HTTPException(status_code=503, detail="Voice generation unavailable.")

    # 'Response' sends raw content instead of JSON.
    # 'media_type="audio/mpeg"' tells the app: this is an MP3 file.
    # The app's audio player sees this content type and plays the file.
    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=ada_voice.mp3"}
    )


@app.get("/voice/voices")
async def list_voices():
    """
    Lists available edge-tts neural voices (English only).
    Visit: http://localhost:5000/voice/voices to browse.
    To change Ada's voice: copy a 'name' value and update
    ADA_VOICE in voice.py, then restart the backend.
    """
    import edge_tts
    voices = await edge_tts.list_voices()
    english = [v for v in voices if v["Locale"].startswith("en")]
    return [
        {"name": v["ShortName"], "gender": v["Gender"], "locale": v["Locale"]}
        for v in english
    ]

@app.get("/proactive")
async def get_proactive_message():
    """Check if Ada has sent an unprompted message."""
    if pending_proactive_messages:
        message = pending_proactive_messages.pop(0)
        return ProactiveMessage(message=message)
    return {"message": None, "type": "none"}


@app.get("/state")
async def get_state():
    """Ada's current mood and thought."""
    return await get_ada_state()


@app.post("/trigger-thought")
async def trigger_thought():
    """Debug: manually trigger Ada's background thinking."""
    await ada_background_thinking()
    state = await get_ada_state()
    return {"thought": state["current_thought"], "mood": state["mood"]}


# ── Run ───────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)
