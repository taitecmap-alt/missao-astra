import fs from 'node:fs';
import path from 'node:path';

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full.split(path.sep).join('/'));
  }
  return acc;
}

const files = walk('site').map((file) => `./${file.slice('site/'.length)}`);
const skip = new Set(['./sw.js', './.nojekyll']);
const needed = files.filter((file) => !skip.has(file));
const sw = fs.readFileSync('site/sw.js', 'utf8');
const listed = [...sw.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
const missing = needed.filter((file) => !listed.includes(file));
const extra = listed.filter((file) => file !== './' && !needed.includes(file));
if (missing.length || extra.length) {
  console.error('missing from sw', missing);
  console.error('extra in sw', extra);
  process.exit(1);
}
console.log(`service worker lists ${needed.length} files`);
