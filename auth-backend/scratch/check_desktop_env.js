async function test() {
  const apiKey = 'AIzaSyCfPiSEWfwbz9bgOXKlt4PV9Av2LLd-m0A';
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    const models = data.models || [];
    const geminiModels = models.filter(m => m.name.toLowerCase().includes('gemini'));
    console.log('Gemini Models:', geminiModels.map(m => m.name));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
