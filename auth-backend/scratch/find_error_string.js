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
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('.history') && !file.includes('dist')) {
        results = results.concat(walk(file));
      }
    } else {
      results.push(file);
    }
  });
  return results;
}

const otherDir = 'c:\\Users\\Administrator\\Desktop\\LapGuard-AI';
if (fs.existsSync(otherDir)) {
  const files = walk(otherDir);
  console.log(`Scanning ${files.length} files in other directory...`);
  files.forEach(f => {
    try {
      const content = fs.readFileSync(f, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const lower = line.toLowerCase();
        if (lower.includes('vite_gemini_api_key') || lower.includes('ai service unavailable') || lower.includes('add vite_')) {
          console.log(`Found on line ${index + 1} of ${f}: ${line.trim()}`);
        }
      });
    } catch (e) {
      // Ignore
    }
  });
} else {
  console.log('Other directory does not exist');
}
