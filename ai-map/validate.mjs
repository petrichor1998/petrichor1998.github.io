// Run with Node before publishing an edited course dataset.
import { readFile } from 'node:fs/promises';
import { validateContent } from './model.js';
const content = JSON.parse(await readFile(new URL('./content.json', import.meta.url), 'utf8'));
const progress = JSON.parse(await readFile(new URL('./progress.json', import.meta.url), 'utf8'));
const errors = validateContent(content, progress);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Atlas content valid: ${content.topics.length} topics; published through ${progress.unlockedThrough}.`);
