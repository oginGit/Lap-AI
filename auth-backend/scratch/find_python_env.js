const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('.history')) {
        results = results.concat(walk(file));
      }
    } else {
      results.push(file);
    }
  });
  return results;
}

const backendDir = path.join(__dirname, '..', '..', 'backend');
const files = walk(backendDir);
files.forEach(f => {
  try {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('gemini') || line.toLowerCase().includes('vite')) {
        console.log(`Found on line ${index + 1} of ${f}: ${line.trim()}`);
      }
    });
  } catch (e) {
    // Ignore
  }
});
