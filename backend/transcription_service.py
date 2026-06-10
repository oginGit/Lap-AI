"""
transcription_service.py — Offline-capable Speech-to-Text for LaptopGuard AI
Uses openai-whisper for reliable transcription.
"""

import os
import traceback

# Optional dependencies
_whisper_model = None
_whisper_loaded = False
_whisper_failed = False

def load_whisper():
    """Load the Whisper model (lightweight 'base' model)."""
    global _whisper_model, _whisper_loaded, _whisper_failed
    
    if _whisper_failed:
        return False
    if _whisper_loaded:
        return True
        
    try:
        import whisper
        print("  🔄 Loading local Whisper 'base' model...")
        # 'base' is small (145MB) and good for English/Urdu/Roman Urdu
        _whisper_model = whisper.load_model("base")
        _whisper_loaded = True
        print("  ✅ Local Whisper model loaded!")
        return True
    except Exception as e:
        print(f"  ⚠️  Failed to load local Whisper: {e}")
        print("     (Make sure 'pip install openai-whisper' and 'ffmpeg' are installed for offline mode)")
        _whisper_failed = True
        return False

def transcribe_audio(file_path):
    """Transcribe audio file to text."""
    if not load_whisper():
        raise Exception("Local transcription service is not available. Please install 'openai-whisper' and 'ffmpeg'.")
    
    try:
        # Transcribe with Urdu/English awareness
        result = _whisper_model.transcribe(file_path, task="transcribe")
        return result.get("text", "").strip()
    except Exception as e:
        print(f"  ⚠️  Transcription error: {e}")
        raise e
