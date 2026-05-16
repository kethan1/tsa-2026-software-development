// Client-side Gemini text-to-speech.
//
// The Speech tab calls the Gemini REST API straight from the browser — no
// server, no serverless function. The API key ships in the bundle via
// `VITE_GEMINI_API_KEY` (see .env). Gemini returns raw 16-bit PCM, which we wrap
// in a WAV header so the browser can play it as a natural-sounding voice instead
// of the robotic `speechSynthesis` fallback.

const GEMINI_TTS_MODEL = 'gemini-3.1-flash-tts-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`;

export type Voice = { name: string; tone: string };

// A curated set of Gemini's natural prebuilt voices.
export const NATURAL_VOICES: Voice[] = [
  { name: 'Kore', tone: 'Warm · neutral' },
  { name: 'Puck', tone: 'Upbeat · bright' },
  { name: 'Charon', tone: 'Deep · steady' },
  { name: 'Aoede', tone: 'Soft · breezy' },
  { name: 'Leda', tone: 'Youthful · clear' },
  { name: 'Fenrir', tone: 'Bold · firm' },
];

export const DEFAULT_VOICE = NATURAL_VOICES[0].name;

export function getApiKey(): string | undefined {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

export function hasGeminiKey(): boolean {
  return Boolean(getApiKey());
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Gemini TTS tags PCM like "audio/L16;codec=pcm;rate=24000".
function sampleRateFromMime(mimeType: string | undefined, fallback = 24000): number {
  const match = mimeType ? /rate=(\d+)/i.exec(mimeType) : null;
  return match ? Number(match[1]) : fallback;
}

function pcmToWavBlob(pcm: Uint8Array, sampleRate: number, channels = 1, bitsPerSample = 16): Blob {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, pcm.length, true);

  new Uint8Array(buffer, 44).set(pcm);
  return new Blob([buffer], { type: 'audio/wav' });
}

export class SpeechApiError extends Error {}

/**
 * Synthesise `text` with a natural Gemini voice and return an object URL for a
 * playable WAV blob. Caller is responsible for `URL.revokeObjectURL`.
 */
export async function synthesizeSpeech(text: string, voice: string = DEFAULT_VOICE): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) throw new SpeechApiError('Nothing to speak.');

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new SpeechApiError('Missing VITE_GEMINI_API_KEY. Add it to your .env to enable natural speech.');
  }

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: trimmed }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
        },
      }),
    });
  } catch {
    throw new SpeechApiError('Network error reaching the speech service.');
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message ?? '';
    } catch {
      /* ignore */
    }
    throw new SpeechApiError(detail || `Speech service error (${response.status}).`);
  }

  const data = await response.json();
  const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
  const audioBase64: string | undefined = part?.inlineData?.data;
  const mimeType: string | undefined = part?.inlineData?.mimeType;
  if (!audioBase64) {
    throw new SpeechApiError('The speech service did not return any audio.');
  }

  const bytes = base64ToBytes(audioBase64);
  const blob = /audio\/wav/i.test(mimeType || '')
    ? new Blob([bytes], { type: 'audio/wav' })
    : pcmToWavBlob(bytes, sampleRateFromMime(mimeType));

  return URL.createObjectURL(blob);
}
