import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import {
  generateAdScript,
  addSceneTiming,
  validateClaims,
  validateSceneTiming,
  validateVoiceoverBudget,
} from '../lib/llm.js';
import { generateVoiceover } from '../lib/tts.js';
import { uploadAudioToShotstack } from '../lib/storage.js';
import { buildTimeline, submitRender, pollRender } from '../lib/shotstack.js';

const brief = JSON.parse(
  await readFile(new URL('sample-brief.json', import.meta.url), 'utf8'),
);

console.time('total');

console.time('1-script');
const rawScript = await generateAdScript(brief);
const script = addSceneTiming(rawScript);
console.timeEnd('1-script');
console.log('Headline:', script.headline);

console.time('2-validate');
validateClaims(script, brief);
validateSceneTiming(script);
validateVoiceoverBudget(script, 30);
console.timeEnd('2-validate');

console.log('Voiceover characters:', script.voiceover.length);

console.time('3-tts');
const audioBuffer = await generateVoiceover(script.voiceover);
console.timeEnd('3-tts');

console.time('4-upload');
const voiceoverUrl = await uploadAudioToShotstack(audioBuffer);
console.timeEnd('4-upload');

const edit = buildTimeline({
  script,
  voiceoverUrl,
  visualAssets: brief.visualAssets,
  musicUrl: brief.musicUrl,
});

console.time('5-render');
const renderId = await submitRender(edit);
console.log('Render ID:', renderId);
const result = await pollRender(renderId);
console.timeEnd('5-render');

if (result.status === 'failed') {
  throw new Error(`Render failed: ${result.error || 'Unknown error'}`);
}

if (result.status === 'timeout') {
  throw new Error(`Render timed out. Check render ID: ${result.renderId}`);
}

console.timeEnd('total');
console.log(result);
