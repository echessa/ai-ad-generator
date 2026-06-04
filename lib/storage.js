const INGEST_HOST = `https://api.shotstack.io/ingest/${process.env.SHOTSTACK_ENV || 'stage'}`;
const API_KEY = process.env.SHOTSTACK_API_KEY;

export async function uploadAudioToShotstack(audioBuffer) {
  const uploadRes = await fetch(`${INGEST_HOST}/upload`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'x-api-key': API_KEY },
  });

  if (!uploadRes.ok) {
    throw new Error(
      `Upload request failed: ${uploadRes.status} ${await uploadRes.text()}`,
    );
  }

  const { data } = await uploadRes.json();
  const signedUrl = data.attributes.url;
  const sourceId = data.id;

  const putRes = await fetch(signedUrl, { method: 'PUT', body: audioBuffer });

  if (!putRes.ok) {
    throw new Error(`S3 upload failed: ${putRes.status}`);
  }

  return pollSourceUntilReady(sourceId);
}

async function pollSourceUntilReady(sourceId) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await sleep(3000);

    const res = await fetch(`${INGEST_HOST}/sources/${sourceId}`, {
      headers: { Accept: 'application/json', 'x-api-key': API_KEY },
    });

    if (!res.ok) throw new Error(`Source poll failed: ${res.status}`);

    const { data } = await res.json();
    const { status, source } = data.attributes;

    if (status === 'ready') return source;
    if (status === 'failed') {
      throw new Error(`Ingest failed for source ${sourceId}`);
    }
  }

  throw new Error(`Timed out waiting for source ${sourceId}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
