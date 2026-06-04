# AI Ad Generator

A small Node.js pipeline that turns a product brief into a rendered video ad using OpenAI, ElevenLabs, and Shotstack.

## What it does

The script:

1. Reads `app/sample-brief.json`
2. Generates a structured ad script with the OpenAI Responses API
3. Validates claims, timing, and voiceover length
4. Generates an MP3 voiceover with ElevenLabs
5. Uploads the MP3 to Shotstack Ingest
6. Builds a Shotstack timeline
7. Renders the final MP4

## Setup

```sh
npm install
```

Create `.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-nano
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
SHOTSTACK_API_KEY=...
SHOTSTACK_ENV=v1
```

Use `SHOTSTACK_ENV=stage` while testing. Use `v1` for production renders.

## Run

```sh
npm start
```

When the render completes, the script prints the final MP4 URL.

## Project structure

```sh
lib/
  llm.js
  tts.js
  storage.js
  shotstack.js
app/
  pipeline.js
  sample-brief.json
```

## Notes

- The demo uses two video assets and one image asset.
- The voiceover starts at second 0.
- Visual clips start after the 3-second title card.
- Shotstack output URLs may expire, so host final demo videos separately if needed.
