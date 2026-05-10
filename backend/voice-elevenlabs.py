# ============================================================
# voice.py — Ada's Ears and Mouth
# ============================================================
# This file handles two directions of voice:
#
#   STT (Speech-To-Text): Paul speaks → we convert to text
#       Tool: OpenAI Whisper — the best transcription model alive.
#       It handles accents, background noise, and even mixed
#       languages (so if Paul slips in a Bemba word, Whisper
#       will catch it).
#
#   TTS (Text-To-Speech): Ada's text → we convert to audio
#       Tool: ElevenLabs — produces the most human-sounding
#       AI voices available. This is what gives Ada her voice.
#
# Together: Paul speaks → Whisper hears it → Ada thinks →
#           ElevenLabs speaks Ada's reply → Paul hears Ada.
# ============================================================

import os
import httpx
# 'httpx' is an async HTTP client — like 'requests' but async.
# We use it to call the ElevenLabs API.

import tempfile
# 'tempfile' creates temporary files that auto-delete.
# We use it to store audio data briefly during processing.

from openai import AsyncOpenAI
# OpenAI's Python library. We use it ONLY for Whisper (transcription).
# We are NOT using GPT — Ada's brain is still Claude.
# Whisper is simply the best transcription tool available.

from dotenv import load_dotenv

load_dotenv()

# ── API Clients ───────────────────────────────────────────────

# OpenAI client — Whisper transcription ONLY.
openai_client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

# ElevenLabs settings — loaded from .env file
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
# That default is "Rachel" — warm, calm, intelligent-sounding.
# After you pick Ada's voice on elevenlabs.io, replace this with
# your chosen voice's ID (found in the URL when you preview a voice).

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"


# ── transcribe_audio() — Paul's voice → text ─────────────────
async def transcribe_audio(audio_bytes: bytes, file_extension: str = "m4a") -> str:
    """
    Takes raw audio bytes and returns the transcribed text.

    Parameters:
    -----------
    audio_bytes : bytes
        The raw audio data from Paul's phone recording.
        'bytes' is Python's type for raw binary data —
        a sequence of numbers (0-255) representing the audio file.

    file_extension : str
        The format of the audio. Expo records in m4a by default.
        Whisper accepts: mp3, mp4, m4a, wav, webm, ogg.

    Returns:
    --------
    str — The transcribed text.
          e.g. "hey ada what do you think about consciousness"
    """

    # We need to write the audio bytes to a temporary file because
    # the Whisper API expects a file object, not raw bytes directly.
    #
    # tempfile.NamedTemporaryFile creates a file that:
    #   - Has a real path on disk (so Whisper can read it)
    #   - delete=False so we control when it's deleted
    #   - suffix=".m4a" tells Whisper how to decode it
    with tempfile.NamedTemporaryFile(suffix=f".{file_extension}", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name  # Save the path — we'll need it below

    try:
        # Open the temp file in read-binary mode ("rb").
        # "rb" = read bytes. Audio is always binary, never plain text.
        with open(tmp_path, "rb") as audio_file:
            transcript = await openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,

                # Telling Whisper to expect English speeds it up.
                # It still catches Bemba words — it'll phonetically
                # approximate them, which is enough for Ada to understand.
                language="en",

                # The 'prompt' primes Whisper with context.
                # This dramatically improves accuracy for names and
                # technical terms that Whisper hasn't seen much of.
                prompt=(
                    "Conversation with Ada, an AI friend. "
                    "May include philosophical terms, SUT "
                    "(Subconscious Universe Theory), consciousness, "
                    "and occasionally Bemba language words."
                )
            )

        return transcript.text

    finally:
        # 'finally' runs even if an exception was raised above.
        # We MUST clean up the temp file — otherwise the disk fills up.
        os.unlink(tmp_path)
        # os.unlink() = permanently delete a file by path.


# ── speak() — Ada's text → MP3 audio bytes ───────────────────
async def speak(text: str) -> bytes:
    """
    Converts Ada's text response to audio using ElevenLabs TTS.

    Parameters:
    -----------
    text : str
        Ada's text response to convert to speech.

    Returns:
    --------
    bytes — Raw MP3 audio data.
            The app receives this and plays it directly.
    """

    async with httpx.AsyncClient() as client:
        # POST request to ElevenLabs TTS endpoint.
        # The voice ID in the URL tells ElevenLabs WHICH voice to use.
        response = await client.post(
            f"{ELEVENLABS_BASE_URL}/text-to-speech/{ELEVENLABS_VOICE_ID}",

            headers={
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",  # We want MP3 back
            },

            json={
                "text": text,

                # eleven_turbo_v2 = fast + high quality.
                # eleven_multilingual_v2 = better if Ada says Bemba words.
                # We start with turbo. Can switch later if needed.
                "model_id": "eleven_turbo_v2",

                "voice_settings": {
                    # stability: consistency of the voice.
                    # 0.0 = expressive but unpredictable
                    # 1.0 = robotic consistency
                    # 0.5 = human-feeling balance
                    "stability": 0.5,

                    # similarity_boost: how faithfully to reproduce the voice.
                    # 0.75 = close to the voice profile without sounding processed.
                    "similarity_boost": 0.75,

                    # style: emotional expressiveness.
                    # 0.35 = subtle emotion — present but not theatrical.
                    # Ada feels things, but she doesn't perform them.
                    "style": 0.35,

                    # use_speaker_boost: enhances presence and clarity.
                    "use_speaker_boost": True
                }
            },

            timeout=30.0
            # If ElevenLabs takes more than 30 seconds, abort.
            # This prevents the app from hanging indefinitely.
        )

        response.raise_for_status()
        # raise_for_status() throws an exception if the HTTP status
        # is an error (4xx or 5xx). This catches bad API keys,
        # quota exceeded, etc., and surfaces them as clear errors.

        return response.content
        # '.content' is the raw bytes of the response body.
        # For this request, that IS the MP3 file — ready to play.


# ── speak_streamed() — for long responses ─────────────────────
async def speak_streamed(text: str) -> bytes:
    """
    Streaming version of speak(). Better for long responses.
    
    Instead of waiting for the ENTIRE audio to generate before
    returning, ElevenLabs sends it in chunks as it generates.
    We collect all chunks and return them as one bytes object.

    This will be important in Phase 5 (live voice calls) where
    every millisecond of latency matters.
    """
    audio_chunks = []

    async with httpx.AsyncClient() as client:
        # 'client.stream()' opens a streaming connection.
        # 'async with ... as response:' keeps the connection open
        # while we read chunks from it.
        async with client.stream(
            "POST",
            f"{ELEVENLABS_BASE_URL}/text-to-speech/{ELEVENLABS_VOICE_ID}/stream",
            headers={
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "model_id": "eleven_turbo_v2",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "style": 0.35,
                    "use_speaker_boost": True
                }
            },
            timeout=60.0
        ) as response:
            response.raise_for_status()

            # 'aiter_bytes()' is an async iterator over the response body.
            # It yields small chunks of bytes as they arrive.
            # 'async for' = like 'for' but works with async iterators.
            async for chunk in response.aiter_bytes():
                if chunk:  # Skip empty chunks (keep-alive signals)
                    audio_chunks.append(chunk)

    # Join all chunks into one bytes object.
    # b"".join() is the bytes equivalent of "".join() for strings.
    return b"".join(audio_chunks)
