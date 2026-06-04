import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Scenes must sum to 27 seconds, not 30.
// The timeline reserves 3 seconds for the opening headline card.
// 3s headline + 27s scenes = 30s total.
const adScriptSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string' },
    voiceover: { type: 'string' },
    scenes: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          visualPrompt: { type: 'string' },
          caption: { type: 'string' },
        },
        required: ['visualPrompt', 'caption'],
      },
    },
    cta: { type: 'string' },
    claims: { type: 'array', items: { type: 'string' } },
  },
  required: ['headline', 'voiceover', 'scenes', 'cta', 'claims'],
};

export async function generateAdScript(brief) {
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL,
    input: [
      {
        role: 'system',
        content: `You create short, factual video ad scripts.
Never invent product claims not present in the brief.
Return exactly three scenes. Do not include timing; the application assigns scene timing.
Headline must be short: no more than 6 words, and preferably just the product name or tagline.
Voiceover must be no more than 55 words.
Narration should sound natural at roughly 130 words per minute.
Return only schema-valid output.`,
      },
      {
        role: 'user',
        content: `Create a 30-second vertical video ad:\n${JSON.stringify(brief, null, 2)}`,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'ad_script',
        strict: true,
        schema: adScriptSchema,
      },
    },
  });

  const refusal = response.output
    ?.flatMap((item) => item.content ?? [])
    .find((part) => part.type === 'refusal');

  if (refusal) {
    throw new Error(`Model refused: ${refusal.refusal}`);
  }

  if (!response.output_text) {
    throw new Error(
      'Model returned no output. Check your API key, model name, and schema.',
    );
  }

  console.log('LLM usage:', response.usage);

  return JSON.parse(response.output_text);
}

export function validateClaims(script, brief) {
  const { allowedClaims = [], forbiddenClaims = [] } = brief;

  const allText = [
    script.voiceover,
    ...script.scenes.map((s) => s.caption),
    script.headline,
    script.cta,
  ]
    .join(' ')
    .toLowerCase();

  for (const forbidden of forbiddenClaims) {
    if (allText.includes(forbidden.toLowerCase())) {
      throw new Error(`Forbidden phrase in script: "${forbidden}"`);
    }
  }

  const unsupported = script.claims.filter(
    (claim) =>
      !allowedClaims.some((allowed) =>
        claim.toLowerCase().includes(allowed.toLowerCase()),
      ),
  );

  if (unsupported.length > 0) {
    throw new Error(`Unsupported claims: ${unsupported.join('; ')}`);
  }
}

export function validateSceneTiming(script, budgetSeconds = 27) {
  if (script.scenes.length !== 3) {
    throw new Error(`Expected 3 scenes, got ${script.scenes.length}`);
  }

  const sorted = [...script.scenes].sort((a, b) => a.start - b.start);

  if (Math.abs(sorted[0].start) > 0.01) {
    throw new Error(`First scene must start at 0, got ${sorted[0].start}`);
  }

  for (const [i, scene] of sorted.entries()) {
    if (scene.length <= 0) {
      throw new Error(
        `Scene ${i + 1} has non-positive length: ${scene.length}`,
      );
    }

    const expectedStart =
      i === 0 ? 0 : sorted[i - 1].start + sorted[i - 1].length;

    if (Math.abs(scene.start - expectedStart) > 0.01) {
      throw new Error(
        `Scene ${i + 1} starts at ${scene.start}, expected ${expectedStart}`,
      );
    }
  }

  const total = sorted.at(-1).start + sorted.at(-1).length;
  if (Math.abs(total - budgetSeconds) > 0.01) {
    throw new Error(`Scenes total ${total}s, expected ${budgetSeconds}s`);
  }
}

export function validateVoiceoverBudget(script, budgetSeconds = 30) {
  const words = script.voiceover.trim().split(/\s+/).length;
  const estimatedSeconds = (words / 130) * 60;
  const toleranceSeconds = 2;

  if (estimatedSeconds > budgetSeconds + toleranceSeconds) {
    throw new Error(
      `Voiceover likely too long: ~${Math.round(estimatedSeconds)}s for a ${budgetSeconds}s budget. Regenerate with a shorter brief.`,
    );
  }
}

export function addSceneTiming(script, budgetSeconds = 27) {
  if (script.scenes.length !== 3) {
    throw new Error(`Expected 3 scenes, got ${script.scenes.length}`);
  }

  const sceneLength = budgetSeconds / script.scenes.length;

  return {
    ...script,
    scenes: script.scenes.map((scene, index) => ({
      ...scene,
      start: index * sceneLength,
      length: sceneLength,
    })),
  };
}
