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

const workspaceRoot = path.join(__dirname, '..', '..');
const files = walk(workspaceRoot);
files.forEach(f => {
  if (f.includes('.env')) {
    console.log('--- Env File:', f);
    try {
      console.log(fs.readFileSync(f, 'utf8'));
    } catch (e) {
      console.log('Error reading:', e.message);
    }
  }
});
