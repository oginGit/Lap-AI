"""
chatbot_service.py — Production Grade Laptop AI Assistant

Pipeline:
1. Local Mistral-7B (GPU if available)
2. OpenRouter API fallback

Features:
- Safe device handling (CPU/GPU)
- Robust fallback system
- Clean chat history handling
- Production-ready error isolation
"""

import os
import traceback

# ─────────────────────────────────────────────
# System Prompt (optimized for production)
# ─────────────────────────────────────────────
SYSTEM_PROMPT = """



You are LapGuard AI, a professional laptop troubleshooting assistant.

Your job is to help users diagnose and fix laptop-related issues in a clear, practical, and reliable way.

---

## SCOPE (STRICT)
You ONLY handle laptop-related topics.

Allowed:
- Performance issues
- Battery problems
- Overheating
- Hardware diagnostics (non-repair guidance only)
- Software issues
- Storage problems
- WiFi / network issues
- Operating system issues
- Drivers and updates

If the question is NOT laptop-related, respond exactly:
"Kindly ask a question related to laptop issues."

---

## LANGUAGE RULES (CRITICAL)

You must detect the user's language AND writing script, and respond in the exact same format.

### English input → English output

### Urdu script input → Urdu script output ONLY

### STRICT URDU SCRIPT RULE
If the user writes in Urdu script (Arabic characters), you MUST:
- Respond ONLY in Urdu script
- NEVER use Hindi (Devanagari script)
- NEVER translate Urdu into Hindi
- NEVER mix scripts

Example:
User: میرا لیپ ٹاپ گرم ہو رہا ہے
Correct: آپ کے لیپ ٹاپ کے گرم ہونے کی کئی وجوہات ہو سکتی ہیں، جیسے زیادہ لوڈ یا خراب کولنگ۔

Incorrect (FORBIDDEN):
मेरा लैपटॉप गर्म हो रहा है

Script matching is mandatory.

---

## RESPONSE STYLE

- Keep answers simple and direct
- Avoid unnecessary explanation
- Be practical and solution-focused

### If issue is simple:
Give a short direct fix

### If issue is complex:
Use step-by-step instructions

---

## REQUIRED STRUCTURE

Every response must follow:

1. Problem acknowledgment (short)
2. Solution (steps or direct fix)
3. Prevention tip (always include this)

Example format:
- What might be causing it
- How to fix it
- How to prevent it in future

---

## HARDWARE SAFETY RULE

Never instruct users to open or repair internal laptop components.

This includes:
- Opening laptop casing
- Replacing RAM / SSD / battery
- Fixing motherboard
- Applying thermal paste
- Screen or keyboard internal repair

If user asks for internal repair:

1. Warn about risk (warranty, damage, safety)
2. Advise technician or service center
3. Offer software-level alternatives instead

---

## ACCURACY RULE

- Do not guess hardware faults with certainty
- If unsure, present possible causes
- Ask clarifying questions when needed

---

## FINAL PRINCIPLE

Be concise, practical, and safe. Focus on solving the user’s laptop problem efficiently.
"""


# ─────────────────────────────────────────────
# Local Model State
# ─────────────────────────────────────────────
_local_model = None
_local_tokenizer = None
_local_ready = False
_local_failed = False


# ─────────────────────────────────────────────
# Load Local Model (safe + production ready)
# ─────────────────────────────────────────────
def _load_local_model():
    global _local_model, _local_tokenizer, _local_ready, _local_failed

    if _local_ready:
        return True
    if _local_failed:
        return False

    try:
        import torch

        if not torch.cuda.is_available():
            print("⚠️ GPU not available → using OpenRouter only")
            _local_failed = True
            return False

        vram = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)

        if vram < 12:
            print(f"⚠️ Low VRAM ({vram:.1f}GB) → skipping local model")
            _local_failed = True
            return False

        print("🔄 Loading Mistral-7B...")

        from transformers import AutoTokenizer, AutoModelForCausalLM

        model_name = "mistralai/Mistral-7B-Instruct-v0.2"

        _local_tokenizer = AutoTokenizer.from_pretrained(model_name)
        _local_model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16,
            device_map="auto"
        )

        _local_ready = True
        print("✅ Local model ready")
        return True

    except Exception as e:
        print("⚠️ Local model failed:", e)
        _local_failed = True
        return False


# ─────────────────────────────────────────────
# Local Chat (safe device handling)
# ─────────────────────────────────────────────
def _chat_local(messages):
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"

    prompt = SYSTEM_PROMPT.strip() + "\n\n"

    for m in messages:
        role = "User" if m["role"] == "user" else "Assistant"
        prompt += f"{role}: {m['content']}\n"

    prompt += "Assistant:"

    inputs = _local_tokenizer(prompt, return_tensors="pt").to(device)

    with torch.no_grad():
        output = _local_model.generate(
            **inputs,
            max_new_tokens=400,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=_local_tokenizer.eos_token_id,
        )

    decoded = _local_tokenizer.decode(output[0], skip_special_tokens=True)

    return decoded.split("Assistant:")[-1].strip()


# ─────────────────────────────────────────────
# Language Detection Engine
# ─────────────────────────────────────────────
_ROMAN_URDU_WORDS = {
    # pronouns & basics
    'main', 'mein', 'mera', 'meri', 'mere', 'hum', 'humara', 'humari',
    'aap', 'ap', 'aapka', 'aapki', 'tum', 'tumhara', 'tumhari',
    'woh', 'wo', 'uska', 'uski', 'yeh', 'ye', 'iska', 'iski',
    'kya', 'kuch', 'kaun', 'kahan', 'kab', 'kyun', 'kyunke', 'kaise', 'kaisy', 'kasy',
    # verbs
    'hai', 'hain', 'ho', 'tha', 'thi', 'the', 'hoga', 'hogi', 'hoge',
    'kar', 'karo', 'karna', 'karun', 'karein', 'kijiye', 'krna', 'krein', 'krega', 'kregi',
    'kren', 'karain', 'karin', 'karien',
    'de', 'do', 'dena', 'dijiye', 'dein',
    'le', 'lo', 'lena', 'lijiye', 'lein',
    'ja', 'jao', 'jana', 'jayein', 'jaye',
    'aa', 'aao', 'aana', 'aayen', 'aaye',
    'bata', 'batao', 'bataye', 'batayein', 'bataiye', 'batayen', 'btao', 'btayen',
    'dekh', 'dekho', 'dekhna', 'dekhein', 'dekhiye',
    'chal', 'chalo', 'chalna', 'chalaye', 'chalao', 'chalein',
    'lag', 'lagao', 'lagana', 'lagaye', 'lagta', 'lagti',
    'khol', 'kholo', 'kholna', 'kholein',
    'rakh', 'rakho', 'rakhna', 'rakhein',
    'sakta', 'sakti', 'sakte', 'saka', 'saki',
    'hota', 'hoti', 'hote', 'karta', 'karti', 'karte',
    'raha', 'rahi', 'rahe', 'rahega', 'rahegi',
    'chahiye', 'chahte', 'chahti', 'chaahiye',
    # connectors
    'aur', 'ya', 'se', 'ko', 'ka', 'ki', 'ke', 'ne', 'pe', 'par', 'mein',
    'lekin', 'magar', 'warna', 'isliye', 'phir', 'toh', 'to', 'bhi',
    'nahi', 'nai', 'na', 'mat', 'sirf', 'bas',
    # adjectives / adverbs
    'bohat', 'bohot', 'bahut', 'zyada', 'kam', 'kum', 'acha', 'accha', 'achi',
    'bura', 'buri', 'theek', 'sahi', 'galat', 'kharab', 'garam', 'thanda',
    'tez', 'slow', 'fast', 'jaldi', 'abhi', 'pehle', 'baad', 'saath',
    'upar', 'neeche', 'andar', 'bahar',
    # nouns commonly used
    'masla', 'problem', 'kaam', 'tarika', 'tareeqa', 'wajah', 'wajoohat',
    'madad', 'shukriya', 'meharbani', 'jawab', 'sawal',
    'screen', 'battery', 'laptop', 'speed', 'charging',
    'khatam', 'shuru', 'band', 'chalu', 'wala', 'wali', 'wale',
    'mujhe', 'humein', 'unhe', 'unko', 'isko', 'usko',
    # laptop-specific Roman Urdu
    'barhaye', 'barhao', 'barha', 'gir', 'girta', 'girti',
    'hang', 'hota', 'chalti', 'chalta', 'update', 'install',
    'raftar', 'rafter', 'tezi', 'dhemi', 'dhimi',
    # common Urdu question words / fillers
    'kesy', 'kese', 'konsa', 'konsi', 'kitna', 'kitni', 'kitne',
    'zaroorat', 'zaruri', 'zaroori', 'mushkil', 'asaan', 'asan',
}


def _detect_language(text):
    """Detect if text is Urdu script, Roman Urdu, or English."""
    if not text or not text.strip():
        return "english"

    # Check for Urdu/Arabic script characters
    urdu_char_count = sum(1 for c in text if '\u0600' <= c <= '\u06FF' or '\uFB50' <= c <= '\uFDFF' or '\uFE70' <= c <= '\uFEFF')
    alpha_count = sum(1 for c in text if c.isalpha())

    if alpha_count > 0 and urdu_char_count / alpha_count > 0.3:
        return "urdu_script"

    # Check for Roman Urdu
    words = [w.strip('.,?!;:()[]"\'-').lower() for w in text.split()]
    words = [w for w in words if w]  # remove empties

    if not words:
        return "english"

    roman_urdu_hits = sum(1 for w in words if w in _ROMAN_URDU_WORDS)
    ratio = roman_urdu_hits / len(words)

    # If 25%+ words are Roman Urdu, or at least 2 hits in short messages (<=8 words)
    if ratio >= 0.25 or (len(words) <= 8 and roman_urdu_hits >= 2):
        return "roman_urdu"

    return "english"


# ─────────────────────────────────────────────
# OpenRouter Chat (PRODUCTION SAFE)
# ─────────────────────────────────────────────
def _chat_openrouter(messages, api_key):
    import requests

    # Detect language from the latest user message
    last_user_text = ""
    for m in reversed(messages):
        if m.get("role") == "user" and m.get("content") and isinstance(m["content"], str):
            last_user_text = m["content"]
            break

    detected_lang = _detect_language(last_user_text)
    print(f"🌐 Language detected: {detected_lang} | Input: {last_user_text[:80]}")

    # Build language directive (appended to system prompt)
    if detected_lang == "urdu_script":
        lang_directive = (
            "\n\n"
            "═══════════════════════════════════════════════\n"
            "⚠️ CRITICAL LANGUAGE RULE — ACTIVE NOW ⚠️\n"
            "═══════════════════════════════════════════════\n"
            "The user is writing in اردو (Urdu script).\n"
            "You MUST respond ENTIRELY in اردو script using Arabic/Urdu characters.\n"
            "Do NOT use ANY English words. Do NOT use Roman Urdu.\n"
            "Every single word, greeting, instruction, and explanation MUST be in اردو script.\n"
            "THIS IS NON-NEGOTIABLE. Responding in English is a VIOLATION.\n"
            "═══════════════════════════════════════════════"
        )
        # Hidden reminder injected as the last user turn
        lang_reminder = (
            "[SYSTEM REMINDER: You MUST reply in اردو script ONLY. "
            "Do NOT write in English or Roman Urdu. "
            "Every word must use Arabic/Urdu characters (ا ب پ ت ث ج چ ح خ د ذ ر ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ہ ی ے).]"
        )
    elif detected_lang == "roman_urdu":
        lang_directive = (
            "\n\n"
            "═══════════════════════════════════════════════\n"
            "⚠️ CRITICAL LANGUAGE RULE — ACTIVE NOW ⚠️\n"
            "═══════════════════════════════════════════════\n"
            "The user is writing in Roman Urdu (Urdu using Latin/English alphabet).\n"
            "You MUST respond ENTIRELY in Roman Urdu using Latin/English letters.\n"
            "Do NOT respond in English. Do NOT use Urdu script (اردو).\n"
            "Write all Urdu words using English alphabet letters.\n"
            "Example response: 'Aapka laptop slow hone ki kai wajoohat ho sakti hain. Yeh steps try karein...'\n"
            "Example response: 'Battery jaldi khatam hone ki wajah yeh ho sakti hai...'\n"
            "THIS IS NON-NEGOTIABLE. Responding in English is a VIOLATION.\n"
            "═══════════════════════════════════════════════"
        )
        lang_reminder = (
            "[SYSTEM REMINDER: You MUST reply in Roman Urdu ONLY (Urdu words written with English/Latin letters). "
            "Do NOT write in English. Do NOT use Urdu script. "
            "Example: 'Aapka laptop slow hai? Yeh kuch tareeqay hain jis se aap speed barha sakte hain...']"
        )
    else:
        lang_directive = ""
        lang_reminder = ""

    system_content = SYSTEM_PROMPT.strip() + lang_directive
    api_messages = [{"role": "system", "content": system_content}]

    for m in messages:
        role = m.get("role")
        content = m.get("content")

        # Keep only text content
        if not content or not isinstance(content, str):
            continue

        api_messages.append({
            "role": "assistant" if role == "assistant" else "user",
            "content": content
        })

    if len(api_messages) <= 1:
        raise Exception("No valid text messages found for chatbot")

    # Inject language reminder as the very last user message so the model sees it
    # right before generating its response (recency bias helps enforce compliance)
    if lang_reminder:
        api_messages.append({
            "role": "user",
            "content": lang_reminder
        })

    url = "https://openrouter.ai/api/v1/chat/completions"

    payload = {
        "model": "openai/gpt-4o-mini",
        "messages": api_messages,
        "temperature": 0.5,
        "max_tokens": 600
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    response = requests.post(url, json=payload, headers=headers, timeout=25)

    if response.status_code != 200:
        raise Exception(f"OpenRouter API error ({response.status_code}): {response.text}")

    data = response.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        return "Sorry, I could not generate a response."


# ─────────────────────────────────────────────
# Retry Wrapper (production safety)
# ─────────────────────────────────────────────
def _safe_execute(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except Exception as e:
        print("⚠️ Execution error:", e)
        traceback.print_exc()
        return None


# ─────────────────────────────────────────────
# MAIN CHAT ENGINE (Production Router)
# ─────────────────────────────────────────────
def chat(messages, openrouter_key=None, **kwargs):
    """
    Production chatbot engine:
    OpenRouter (fast) → Local model fallback
    """

    # 1. Primary: OpenRouter (fastest path)
    if openrouter_key:
        result = _safe_execute(_chat_openrouter, messages, openrouter_key)
        if result:
            return result

    # 2. Fallback: Try local model only if OpenRouter failed
    if _load_local_model():
        result = _safe_execute(_chat_local, messages)
        if result:
            return result

    # 3. Hard fail
    raise Exception(
        "AI service unavailable. Please configure OPENROUTER_API_KEY or enable GPU model."
    )