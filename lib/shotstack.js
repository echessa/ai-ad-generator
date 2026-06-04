const EDIT_HOST = `https://api.shotstack.io/edit/${process.env.SHOTSTACK_ENV || 'stage'}`;
const API_KEY = process.env.SHOTSTACK_API_KEY;

export function buildTimeline({
  script,
  voiceoverUrl,
  visualAssets,
  musicUrl,
}) {
  const HEADLINE_DURATION = 3;

  const textTrack = {
    clips: [
      {
        asset: {
          type: 'rich-text',
          text: script.headline,
          font: {
            family: 'Montserrat',
            size: 40,
            weight: 800,
            color: '#ffffff',
          },
          shadow: {
            offsetX: 2,
            offsetY: 2,
            blur: 8,
            color: '#000000',
            opacity: 0.7,
          },
          align: { horizontal: 'center' },
        },
        start: 0,
        length: HEADLINE_DURATION,
        width: 1000,
        height: 360,
        position: 'center',
        transition: { in: 'fade', out: 'fade' },
      },
      ...script.scenes.map((scene) => ({
        asset: {
          type: 'rich-text',
          text: scene.caption,
          font: {
            family: 'Montserrat',
            size: 32,
            weight: 600,
            color: '#ffffff',
          },
          background: {
            color: '#000000',
            opacity: 0.5,
            borderRadius: 6,
            wrap: true,
          },
          align: { horizontal: 'center' },
        },
        start: HEADLINE_DURATION + scene.start + 0.5,
        length: Math.max(scene.length - 1, 2),
        width: 900,
        height: 100,
        position: 'bottom',
        transition: { in: 'fade', out: 'fade' },
      })),
      {
        asset: {
          type: 'rich-text',
          text: script.cta,
          font: {
            family: 'Montserrat',
            size: 40,
            weight: 800,
            color: '#ffffff',
          },
          shadow: {
            offsetX: 2,
            offsetY: 2,
            blur: 6,
            color: '#000000',
            opacity: 0.7,
          },
          align: { horizontal: 'center' },
        },
        start: HEADLINE_DURATION + 24,
        length: 3,
        width: 900,
        height: 200,
        position: 'center',
        transition: { in: 'fade' },
      },
    ],
  };

  const visualTrack = {
    clips: script.scenes.map((scene, i) => {
      const asset = visualAssets[i] || visualAssets[visualAssets.length - 1];

      return {
        asset: {
          type: asset.type,
          src: asset.src,
          ...(asset.type === 'video' ? { volume: 0 } : {}),
        },
        start: HEADLINE_DURATION + scene.start,
        length: scene.length,
        fit: 'crop',
        transition: {
          ...(i > 0 ? { in: 'fade' } : {}),
          ...(i < script.scenes.length - 1 ? { out: 'fade' } : {}),
        },
      };
    }),
  };

  const audioTrack = {
    clips: [
      {
        asset: { type: 'audio', src: voiceoverUrl, volume: 1 },
        start: 0,
        length: 'auto',
      },
    ],
  };

  return {
    timeline: {
      background: '#000000',
      ...(musicUrl
        ? {
            soundtrack: {
              src: musicUrl,
              effect: 'fadeInFadeOut',
              volume: 0.12,
            },
          }
        : {}),
      tracks: [textTrack, visualTrack, audioTrack],
    },
    output: {
      format: 'mp4',
      resolution: 'hd',
      aspectRatio: '9:16',
      fps: 30,
      destinations: [{ provider: 'shotstack', exclude: false }],
    },
  };
}

export async function submitRender(editPayload) {
  const res = await fetch(`${EDIT_HOST}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(editPayload),
  });

  const body = await res.json();

  if (!res.ok || !body.success) {
    throw new Error(`Render failed: ${JSON.stringify(body)}`);
  }

  return body.response.id;
}

export async function pollRender(renderId) {
  let lastNetworkError = null;

  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(5000);

    try {
      const res = await fetch(`${EDIT_HOST}/render/${renderId}`, {
        headers: { Accept: 'application/json', 'x-api-key': API_KEY },
      });

      const body = await res.json();

      if (!res.ok || !body.success) {
        throw new Error(`Status check failed: ${JSON.stringify(body)}`);
      }

      const { status, url, error } = body.response;

      if (status === 'done') return { status: 'done', url, renderId };
      if (status === 'failed') {
        return { status: 'failed', error: error || 'Unknown', renderId };
      }

      console.log(`Render status: ${status}`);
    } catch (err) {
      lastNetworkError = err;
      console.warn(
        `Render status check failed on attempt ${attempt + 1}; retrying... ${err.message}`,
      );
    }
  }

  return {
    status: 'timeout',
    renderId,
    error: lastNetworkError?.message,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
