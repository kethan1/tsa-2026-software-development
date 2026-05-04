import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Modality, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TTS_MODEL = 'gemini-3.1-flash-tts-preview';

app.use(express.json({ limit: '25mb' }));

let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
} else {
  console.warn('CRITICAL WARNING: GEMINI_API_KEY environment variable is not defined.');
}


function pcmBase64ToWavBase64(pcmBase64: string, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const pcm = Buffer.from(pcmBase64, 'base64');
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]).toString('base64');
}

function firstString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

// Gemini TTS returns raw PCM tagged like "audio/L16;codec=pcm;rate=24000".
function sampleRateFromMime(mimeType: string | undefined, fallback = 24000) {
  const match = mimeType ? /rate=(\d+)/i.exec(mimeType) : null;
  return match ? Number(match[1]) : fallback;
}

app.post('/api/analyze-frame', async (req, res) => {
  try {
    const { imageBuffer, mode } = req.body;

    if (!imageBuffer) {
      return res.status(400).json({ error: 'Missing imageBuffer parameter.' });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini cognitive services are not initialized on the backend. Please add GEMINI_API_KEY inside the Secrets panel of Settings.',
      });
    }

    let promptText = '';
    switch (mode) {
      case 'ocr':
        promptText =
          'Read any written signs, labels, text on screens, or door plates in this image. State what they say clearly and concisely. If no text is found, say "No written text detected in your immediate view". Keep output under 25 words.';
        break;
      case 'hazard':
        promptText =
          'Analyze this scene for any physical traps or hazards for a deaf/blind person walking (e.g. low-hanging objects, cords on floor, liquids, stairs without rails, items out of place). State the most critical trap or hazard in under 20 words. If the path looks completely safe and clear, say "Clear unhindered pathway".';
        break;
      case 'faces':
        promptText =
          'Look at any faces of individuals speaking or looking at the camera. Identify their primary facial expression and emotional mood (e.g., happy smiling, engaged, angry, confused, speaking energetically) to give the deaf user emotional feedback. State it in under 20 words. If no people are visible, say "No clear faces or speakers in immediate view".';
        break;
      case 'scene':
      default:
        promptText =
          'Provide a short, elegant, high-fidelity spoken narration of the physical space shown in this image for a user with sensory limits (deaf/blind/impaired). Describe key objects, their distances, and the overall mood. Keep it under 30 words.';
        break;
    }

    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBuffer,
      },
    };

    const textPart = {
      text: promptText,
    };

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: { parts: [imagePart, textPart] },
    });

    const resultText = response.text ? response.text.trim() : 'Unrecognized scene signature.';
    res.json({ result: resultText });
  } catch (err: any) {
    console.error('Gemini frame process failure:', err);
    res.status(500).json({ error: err.message || 'Cognitive pipeline internal crash.' });
  }
});

app.post('/api/analyze-audio', async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Missing audioBase64 parameter.' });
    }
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini services are not initialized. Add GEMINI_API_KEY in the Secrets panel.',
      });
    }

    const prompt = `You are SenseSync, an assistive listening engine for a Deaf or Hard-of-Hearing user.
Analyze this short audio clip and report what is happening in the user's environment.

- isSpeech: true if the clip is primarily a person talking; false for any other environmental sound.
- label: a SHORT, specific name for what you heard, in your own words. Do NOT pick from a fixed list —
  describe the actual sound (e.g. "Smoke alarm beeping", "Glass shattering", "Microwave done beep",
  "Ambulance siren", "Someone laughing"). For speech use a short summary like "Person speaking".
- icon: ONE emoji that best represents the sound.
- urgency: how important it is to interrupt a Deaf user, one of "emergency", "high", "normal", "low".
  Use "emergency" for alarms/sirens/danger, "high" for doorbell/knock/phone/baby/name-call,
  "normal" for ordinary speech/appliances, "low" for ambient noise/applause/music.
- confidence: 0.0 to 1.0, how sure you are.
- description: one short sentence the user can read about the sound and what it might mean.
- If isSpeech is true also fill: transcript (the words spoken, verbatim), speaker (best guess such as
  "Adult male", "Young child", "Speaker 1"), and emotion (one or two words, e.g. "calm", "urgent",
  "cheerful", "frustrated").
If the clip is silence or unintelligible, use label "Quiet / unclear", icon "🔇", urgency "low",
confidence below 0.3.`;

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/wav',
        data: audioBase64,
      },
    };

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: { parts: [audioPart, { text: prompt }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSpeech: { type: Type.BOOLEAN },
            label: { type: Type.STRING },
            icon: { type: Type.STRING },
            urgency: { type: Type.STRING, enum: ['emergency', 'high', 'normal', 'low'] },
            confidence: { type: Type.NUMBER },
            description: { type: Type.STRING },
            transcript: { type: Type.STRING },
            speaker: { type: Type.STRING },
            emotion: { type: Type.STRING },
          },
          required: ['isSpeech', 'label', 'icon', 'urgency', 'confidence'],
        },
      },
    });

    const raw = response.text ? response.text.trim() : '';
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      parsed = JSON.parse(cleaned);
    }

    res.json(parsed);
  } catch (err: any) {
    console.error('Gemini audio analysis failure:', err);
    res.status(500).json({ error: err.message || 'Audio cognitive pipeline internal crash.' });
  }
});


app.post('/api/synthesize-speech', async (req, res) => {
  try {
    const text = firstString(req.body?.text);
    const voice = firstString(req.body?.voice) || 'Kore';

    if (!text) {
      return res.status(400).json({ error: 'Missing text parameter.' });
    }
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini services are not initialized. Add GEMINI_API_KEY in the Secrets panel.',
      });
    }

    const response = await ai.models.generateContent({
      model: GEMINI_TTS_MODEL,
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.data,
    );
    const rawAudioBase64 = audioPart?.inlineData?.data;
    const audioMimeType = audioPart?.inlineData?.mimeType;
    if (!rawAudioBase64) {
      return res.status(502).json({ error: 'Gemini did not return audio data.' });
    }

    // Gemini hands back raw 16-bit PCM; wrap it in a WAV header for the browser.
    const audioBase64 = /audio\/wav/i.test(audioMimeType || '')
      ? rawAudioBase64
      : pcmBase64ToWavBase64(rawAudioBase64, sampleRateFromMime(audioMimeType), 1);

    res.json({ audioBase64, mimeType: 'audio/wav', voice });
  } catch (err: any) {
    console.error('Gemini speech synthesis failure:', err);
    res.status(500).json({ error: err.message || 'Speech synthesis pipeline internal crash.' });
  }
});

async function startAppServer() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Initiating Vite Dev Server Connection Express proxy...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Serving production static build directory dist...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SenseSync Fullstack listening at http://0.0.0.0:${PORT}`);
  });
}

startAppServer().catch((e) => {
  console.error('Server startup crash:', e);
});
