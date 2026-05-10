# ============================================================
# voice.py — Ada's Ears and Mouth
# ============================================================
# STT (Speech-To-Text): Paul speaks -> we convert to text
#     Tool: OpenAI Whisper — best transcription model available.
#     Handles accents, background noise, mixed language (Bemba).
#
# TTS (Text-To-Speech): Ada's text -> we convert to audio
#     Tool: edge-tts (Microsoft Edge Neural TTS)
#     FREE. No API key. No account. Runs by connecting to the
#     same servers the Edge browser uses for "Read Aloud".
#     Voice: en-US-JennyNeural — warm, clear, natural.
#
# UPGRADING TO ELEVENLABS LATER:
#     Only speak() and speak_streamed() need to change.
#     Everything else stays identical.
# ============================================================

import os
import tempfile
import io

# 'io' gives us BytesIO — an in-memory file object.
# Think of it as a file that lives in RAM instead of on disk.
# We use it to collect audio bytes without writing to disk.

import edge_tts
# Microsoft Edge Neural TTS — completely free, no API key needed.
# Install: pip install edge-tts
# edge_tts.Communicate(text, voice) creates a TTS session.
# .stream() yields audio chunks as they're generated.

from openai import AsyncOpenAI
# Used ONLY for Whisper transcription. Ada's brain is still Claude.

from dotenv import load_dotenv

load_dotenv()

# ── OpenAI client (Whisper only) ──────────────────────────────
openai_client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

# ── Ada's voice ───────────────────────────────────────────────
# Full list of available voices: run 'edge-tts --list-voices' in terminal.
#
# Good options for Ada:
#   en-US-JennyNeural      warm, clear, natural          <-- our choice
#   en-US-AriaNeural       expressive, slightly warmer
#   en-US-MichelleNeural   softer, more intimate
#   en-GB-SoniaNeural      British, composed, intelligent
#
# Change ADA_VOICE here to try different ones.
ADA_VOICE = "en-US-JennyNeural"


# ============================================================
# SPEECH TO TEXT
# ============================================================

async def transcribe_audio(audio_bytes: bytes, file_extension: str = "webm") -> str:
    """
    Converts Paul's recorded audio into text using OpenAI Whisper.

    Parameters:
    -----------
    audio_bytes : bytes
        Raw audio data from the browser's MediaRecorder API.
        'bytes' is Python's type for binary data — a sequence of
        numbers (0-255) that represent the audio file.

    file_extension : str
        Format of the audio. Browser MediaRecorder produces 'webm'.
        Whisper accepts: mp3, mp4, m4a, wav, webm, ogg.

    Returns:
    --------
    str — The transcribed text.
          e.g. "hey ada what do you think about consciousness"
    """

    # We must save the audio bytes to a real file on disk because
    # the Whisper API expects a file object, not raw bytes.
    #
    # tempfile.NamedTemporaryFile:
    #   - Creates a real file with a random name
    #   - delete=False means WE control when to delete it
    #   - suffix sets the file extension so Whisper knows the format
    with tempfile.NamedTemporaryFile(suffix=f".{file_extension}", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name   # Save the path: e.g. C:\Temp\tmpXYZ.webm

    try:
        # Open the saved file in "read binary" mode.
        # "rb" = read bytes (not text). Audio is always binary.
        with open(tmp_path, "rb") as audio_file:
            transcript = await openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,

                # Telling Whisper to expect English speeds it up.
                # Bemba words will be phonetically approximated —
                # good enough for Ada to recognise them in context.
                language="en",

                # 'prompt' primes Whisper with context.
                # This dramatically improves accuracy for names and
                # technical terms Whisper rarely sees.
                prompt=(
                    "Conversation with Ada, an AI friend. "
                    "May include philosophical terms, SUT "
                    "(Subconscious Universe Theory), consciousness, "
                    "and occasionally Bemba language words."
                )
            )

        return transcript.text

    finally:
        # 'finally' runs whether or not an exception occurred.
        # We must always delete the temp file — never leave it on disk.
        os.unlink(tmp_path)
        # os.unlink() = delete a file permanently by path.


# ============================================================
# TEXT TO SPEECH
# ============================================================

async def speak(text: str) -> bytes:
    """
    Converts Ada's text response to audio using edge-tts (free).

    HOW edge-tts WORKS:
    edge_tts.Communicate(text, voice) prepares a TTS request.
    .stream() is an async generator that yields audio chunks.
    Each chunk is a dict with a 'type' key:
      - type "audio": contains actual audio bytes in chunk["data"]
      - type "WordBoundary": metadata about word timing (we skip this)

    We collect all audio chunks and join them into one MP3 bytes object.

    Parameters:
    -----------
    text : str
        Ada's response text to convert to speech.

    Returns:
    --------
    bytes — Raw MP3 audio data ready to send to the browser.
    """

    # edge_tts.Communicate creates a TTS session.
    # First arg: the text to speak.
    # Second arg: the voice name (our constant ADA_VOICE above).
    communicate = edge_tts.Communicate(text, ADA_VOICE)

    # We use BytesIO as an in-memory buffer.
    # Think of it as a file that lives in RAM — no disk writes.
    # io.BytesIO() creates an empty byte buffer.
    audio_buffer = io.BytesIO()

    # .stream() is an async generator.
    # 'async for' iterates over it chunk by chunk as they arrive.
    # This is the async equivalent of a regular 'for' loop.
    async for chunk in communicate.stream():
        # Each chunk is a dict. We only want audio chunks.
        # 'WordBoundary' chunks are timing metadata — skip them.
        if chunk["type"] == "audio":
            # chunk["data"] is a bytes object — a small piece of MP3.
            # .write() appends it to our in-memory buffer.
            audio_buffer.write(chunk["data"])

    # .getvalue() returns everything written to the buffer as one bytes object.
    # This is the complete MP3 file — all chunks joined together.
    return audio_buffer.getvalue()


async def speak_streamed(text: str) -> bytes:
    """
    Streaming version of speak() — same result, same method for edge-tts.

    For edge-tts, speak() already streams internally (it uses .stream()).
    This function exists as a named alias so the rest of the codebase
    can call speak_streamed() when we eventually upgrade to ElevenLabs,
    where streaming is a meaningfully different code path.
    """
    return await speak(text)
