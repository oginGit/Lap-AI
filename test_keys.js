const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load env from auth-backend/.env
const envPath = path.join(__dirname, 'auth-backend', '.env');
dotenv.config({ path: envPath });

console.log('Testing GEMINI_API_KEY...');
const geminiKey = process.env.GEMINI_API_KEY;
console.log('Gemini Key:', geminiKey ? geminiKey.substring(0, 10) + '...' : 'none');

async function testGemini() {
  if (!geminiKey) return console.log('No Gemini Key');
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] })
    });
    const data = await response.json();
    console.log('Gemini Response Status:', response.status);
    console.log('Gemini Response Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Gemini Test Error:', err);
  }
}

async function testOpenAI() {
  const openaiKey = process.env.OPENAI_API_KEY;
  console.log('Testing OPENAI_API_KEY...');
  console.log('OpenAI Key:', openaiKey ? openaiKey.substring(0, 15) + '...' : 'none');
  if (!openaiKey) return;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    });
    const data = await response.json();
    console.log('OpenAI Response Status:', response.status);
    console.log('OpenAI Response Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('OpenAI Test Error:', err);
  }
}

async function testOpenRouter() {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  console.log('Testing OPENROUTER_API_KEY...');
  console.log('OpenRouter Key:', openrouterKey ? openrouterKey.substring(0, 15) + '...' : 'none');
  if (!openrouterKey) return;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openrouterKey}`,
        'HTTP-Referer': 'http://localhost:5051',
        'X-Title': 'LapGuard AI'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    });
    const data = await response.json();
    console.log('OpenRouter Response Status:', response.status);
    console.log('OpenRouter Response Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('OpenRouter Test Error:', err);
  }
}

async function run() {
  await testGemini();
  console.log('-----------------------------------');
  await testOpenAI();
  console.log('-----------------------------------');
  await testOpenRouter();
}

run();
