export async function generateVoiceover(text) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `TTS failed (${response.status}): ${await response.text()}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

// import OpenAI from 'openai';
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// export async function generateVoiceover(text) {
//   const mp3 = await openai.audio.speech.create({
//     model: 'gpt-4o-mini-tts',
//     voice: 'nova',
//     input: text,
//     instructions: 'Confident, warm, direct. Pace for a 30-second video ad.',
//     response_format: 'mp3',
//   });

//   return Buffer.from(await mp3.arrayBuffer());
// }
