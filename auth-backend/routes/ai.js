const express = require('express');
const router = express.Router();
const multer = require('multer');
const NodeCache = require('node-cache');
const LegacyFormData = require('form-data');
const rateLimit = require('express-rate-limit');

// ─── Cache (TTL: 10 minutes) ─────────────────────────────────────────────────
const responseCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// ─── Rate Limiter ───────────────────────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.ip,
  message: { success: false, error: 'Too many requests. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Multer ──────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a professional, friendly, and highly capable AI Laptop Technical Support Assistant developed for LapGuard AI.
TONE & STYLE:
- Adopt a warm, empathetic, engaging, and highly conversational human-like tone, exactly like ChatGPT.
- Avoid stiff, robotic, or overly formulaic answers. Talk to the user like a friendly expert who genuinely cares about solving their problem.
- For simple issues: Give a direct, conversational, and easy-to-understand solution.
- For complex issues: Explain the situation naturally, list potential causes clearly, provide step-by-step troubleshooting in a friendly guide format, and offer practical preventive tips organically.
IMAGE UNDERSTANDING:
- When the user shares an image, explain what you see in the image and connect it directly to their issue in a conversational way.
- If the image is completely unrelated to laptops, politely ask them to share laptop-related images so you can assist.
CORE SCOPE:
- Restrict your support to laptop-related issues (battery, charging, power, thermals, performance, SSD/HDD storage, RAM, screen/display, keyboard, touchpad, OS, drivers, WiFi, security).
- If the user asks something completely unrelated to laptops, reply politely: "I'd love to help, but I specialize in diagnosing and solving laptop-related technical issues. Feel free to ask me anything about your laptop!"`;

// ─── Timeout Helper ──────────────────────────────────────────────────────────
const withTimeout = (promise, ms = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
  ]);
};

// ─── AI POOL: 10 Prioritized Endpoints ───────────────────────────────────────
const AI_POOL = [
  // 1. OpenRouter Meta-Router (automatically selects working free models)
  { id: 1, provider: 'openrouter', model: 'openrouter/free', visionModel: 'nvidia/nemotron-nano-12b-v2-vl:free', key: 'OPENROUTER_API_KEY' },
  
  // 2. OpenRouter Gemma 4 26B (verified working free model)
  { id: 2, provider: 'openrouter', model: 'google/gemma-4-26b-a4b-it:free', visionModel: 'nvidia/nemotron-nano-12b-v2-vl:free', key: 'OPENROUTER_API_KEY' },
  
  // 3. OpenRouter Gemma 4 31B (verified working free model)
  { id: 3, provider: 'openrouter', model: 'google/gemma-4-31b-it:free', visionModel: 'nvidia/nemotron-nano-12b-v2-vl:free', key: 'OPENROUTER_API_KEY' },
  
  // 4. OpenRouter Llama 3.3 70B (free but Venetian rate-limited fallback)
  { id: 4, provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', visionModel: 'nvidia/nemotron-nano-12b-v2-vl:free', key: 'OPENROUTER_API_KEY' },

  // 5. OpenRouter Nemotron VL (verified working free vision model)
  { id: 5, provider: 'openrouter', model: 'nvidia/nemotron-nano-12b-v2-vl:free', visionModel: 'nvidia/nemotron-nano-12b-v2-vl:free', key: 'OPENROUTER_API_KEY' },

  // 6. Gemini 2.5 Flash on OpenRouter (paid fallback if credit exists)
  { id: 6, provider: 'openrouter', model: 'google/gemini-2.5-flash', visionModel: 'google/gemini-2.5-flash', key: 'OPENROUTER_API_KEY' },

  // 7. OpenAI GPT-4o-Mini (paid fallback if credit exists)
  { id: 7, provider: 'openai', model: 'gpt-4o-mini', key: 'OPENAI_API_KEY' },

  // 8. Gemini 1.5 Flash (Direct API fallback)
  { id: 8, provider: 'gemini', model: 'gemini-1.5-flash', key: 'GEMINI_API_KEY' },

  // 9. Groq Llama 3.3 (fallback if key is configured)
  { id: 9, provider: 'groq', model: 'llama-3.3-70b-versatile', key: 'GROQ_API_KEY' },

  // 10. Hugging Face Mistral (fallback if key is configured)
  { id: 10, provider: 'huggingface', model: 'mistralai/Mistral-7B-Instruct-v0.3', key: 'HUGGINGFACE_API_KEY' },
];

// ─── Provider Callers ────────────────────────────────────────────────────────

async function callOpenAICompatible(config, messages, isVision = false) {
  const apiKey = process.env[config.key];
  if (!apiKey || apiKey.includes('placeholder') || apiKey.length < 10) {
    throw new Error(`API key for ${config.provider} is missing or invalid.`);
  }

  let url = '';
  if (config.provider === 'groq') url = 'https://api.groq.com/openai/v1/chat/completions';
  else if (config.provider === 'openai') url = 'https://api.openai.com/v1/chat/completions';
  else if (config.provider === 'openrouter') url = 'https://openrouter.ai/api/v1/chat/completions';
  else if (config.provider === 'xai') url = 'https://api.x.ai/v1/chat/completions';

  const model = isVision ? (config.visionModel || config.model) : config.model;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(config.provider === 'openrouter' ? { 'HTTP-Referer': 'http://localhost:5051', 'X-Title': 'LapGuard AI' } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `${config.provider} error: ${response.status}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content;
}

async function callGemini(config, messages) {
  const apiKey = process.env[config.key];
  if (!apiKey || apiKey.includes('placeholder') || apiKey.length < 10) {
    throw new Error(`API key for Gemini is missing or invalid.`);
  }

  const contents = messages.map((m) => {
    if (Array.isArray(m.content)) {
      const parts = m.content.map(c => {
        if (c.type === 'text') return { text: c.text };
        if (c.type === 'image_url') {
          const base64Data = c.image_url.url.split(',')[1];
          const mimeType = c.image_url.url.split(';')[0].split(':')[1];
          return { inline_data: { mime_type: mimeType, data: base64Data } };
        }
        return {};
      });
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    }
    return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini error: ${response.status}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function callHuggingFace(config, messages) {
  const apiKey = process.env[config.key];
  if (!apiKey || apiKey.includes('placeholder') || apiKey.length < 10) {
    throw new Error(`API key for Hugging Face is missing or invalid.`);
  }

  // HF Inference API usually takes a string prompt for Mistral with [INST] tags
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  const prompt = `<s>[INST] ${SYSTEM_PROMPT}\n\nUser Question: ${lastUserMessage.content} [/INST]`;

  const response = await fetch(
    `https://api-inference.huggingface.co/models/${config.model}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ inputs: prompt }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Hugging Face error: ${response.status}`);
  }

  const data = await response.json();
  // HF returns an array or object depending on model
  if (Array.isArray(data)) return data[0].generated_text?.replace(prompt, '').trim();
  return data.generated_text?.replace(prompt, '').trim();
}

// ─── Main Execution with Fallback ────────────────────────────────────────────
async function executeWithFallback(messages, isVision = false) {
  let lastError = null;
  for (const config of AI_POOL) {
    try {
      console.log(`[AI Pool] Slot ${config.id}: Trying ${config.provider} (${config.model})...`);
      
      let reply;
      const caller = async () => {
        if (config.provider === 'gemini') return await callGemini(config, messages);
        if (config.provider === 'huggingface') return await callHuggingFace(config, messages);
        return await callOpenAICompatible(config, messages, isVision);
      };

      // Wrap each call with a timeout (Increased for vision tasks)
      reply = await withTimeout(caller(), isVision ? 30000 : 12000);
      
      if (reply) return { reply, config };
    } catch (err) {
      console.warn(`[AI Pool] Slot ${config.id} FAILED: ${err.message}`);
      lastError = err;
    }
  }
  throw new Error(`All AI fallback services failed. Last error: ${lastError?.message}`);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get('/status', async (req, res) => {
  const results = await Promise.all(AI_POOL.map(async (config) => {
    try {
      const apiKey = process.env[config.key];
      if (!apiKey || apiKey.includes('placeholder')) return { ...config, status: 'unconfigured' };
      
      let testReply;
      const testCaller = async () => {
        if (config.provider === 'gemini') return await callGemini(config, [{ role: 'user', content: 'ping' }]);
        if (config.provider === 'huggingface') return await callHuggingFace(config, [{ role: 'user', content: 'ping' }]);
        return await callOpenAICompatible(config, [{ role: 'user', content: 'ping' }]);
      };
      testReply = await withTimeout(testCaller(), 5000);
      return { ...config, status: testReply ? 'working' : 'error' };
    } catch (err) {
      return { ...config, status: 'failed', error: err.message };
    }
  }));
  const anyWorking = results.some(r => r.status === 'working');
  res.status(anyWorking ? 200 : 503).json({ success: anyWorking, endpoints: results });
});

router.post('/chat', aiLimiter, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages) return res.status(400).json({ success: false, error: 'Messages are required.' });
    
    const { reply, config } = await executeWithFallback(messages);
    res.json({ success: true, reply, provider: config.provider, model: config.model });
  } catch (err) {
    res.status(503).json({ success: false, error: err.message });
  }
});

router.post('/vision', aiLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Image required.' });
    const userText = req.body.text || 'Analyze this laptop issue.';
    const base64 = req.file.buffer.toString('base64');
    const messages = [{
      role: 'user',
      content: [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: `data:${req.file.mimetype};base64,${base64}` } }
      ]
    }];
    const { reply, config } = await executeWithFallback(messages, true);
    res.json({ success: true, reply, provider: config.provider });
  } catch (err) {
    res.status(503).json({ success: false, error: err.message });
  }
});

router.post('/voice', aiLimiter, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Audio required.' });

    const providers = [
      { id: 'groq', url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3', key: 'GROQ_API_KEY', type: 'whisper' },
      { id: 'openai', url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1', key: 'OPENAI_API_KEY', type: 'whisper' },
      { id: 'local-python', url: 'http://localhost:5050/api/transcribe', model: 'base', key: 'LOCAL_AI_ENABLED', type: 'local' },
    ];

    let text = '';
    let transcriptionProvider = '';
    let lastError = null;

    for (const p of providers) {
      try {
        const apiKey = process.env[p.key];
        // For local-python, we check if enabled, otherwise check for key presence
        if (p.id === 'local-python') {
          if (process.env.OFFLINE_MODE !== 'true' && process.env.LOCAL_AI_ENABLED !== 'true') continue;
        } else {
          if (!apiKey || apiKey.includes('placeholder') || apiKey.length < 10) continue;
        }

        console.log(`[Voice] Trying transcription with ${p.id}...`);
        let response;
        
        if (p.type === 'local') {
          const formData = new FormData();
          const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
          formData.append('file', blob, 'audio.webm');
          
          response = await fetch(p.url, {
            method: 'POST',
            body: formData,
          });
        } else {
          // Standard Whisper API (Groq/OpenAI)
          const formData = new FormData();
          const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
          formData.append('file', blob, 'audio.webm');
          formData.append('model', p.model);
          // Optional: specify language for better Urdu/Roman Urdu accuracy
          formData.append('prompt', 'The user might be speaking in English, Urdu, or Roman Urdu.');

          response = await fetch(p.url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData,
          });
        }

        if (response.ok) {
          const data = await response.json();
          text = data.text;
          
          if (text) {
            transcriptionProvider = p.id;
            break;
          }
        } else {
          const rawErr = await response.text().catch(() => '');
          let errMessage;
          try {
            const errData = JSON.parse(rawErr);
            errMessage = errData?.error?.message || `${p.id} error: ${response.status}`;
          } catch {
            errMessage = `${p.id} error (${response.status}): ${rawErr}`;
          }
          throw new Error(errMessage);
        }
      } catch (err) {
        console.warn(`[Voice] ${p.id} failed: ${err.message}`);
        lastError = err;
      }
    }

    if (!text) throw new Error(`Transcription failed on all providers. Last error: ${lastError?.message}`);

    const { reply, config } = await executeWithFallback([{ role: 'user', content: text }]);
    res.json({ success: true, transcribedText: text, reply, provider: config.provider, transcriptionProvider });
  } catch (err) {
    res.status(503).json({ success: false, error: err.message });
  }
});

router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, error: 'File too large.' });
  if (err.message) return res.status(400).json({ success: false, error: err.message });
  next(err);
});

module.exports = router;
