import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_MODEL = 'gemini-2.5-flash';

// Lazily build the client so the API key is read at request time, not import
// time. This keeps things working both locally (server.ts loads .env via dotenv
// before any request) and on Vercel (env vars are injected into the function).
let cachedAi: GoogleGenAI | null | undefined;

function getAi(): GoogleGenAI | null {
  if (cachedAi !== undefined) return cachedAi;

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    cachedAi = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } else {
    console.warn('CRITICAL WARNING: GEMINI_API_KEY environment variable is not defined.');
    cachedAi = null;
  }

  return cachedAi;
}

// Error that carries the HTTP status the caller should respond with.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function analyzeFrame(imageBuffer: unknown, mode: unknown): Promise<{ result: string }> {
  if (!imageBuffer || typeof imageBuffer !== 'string') {
    throw new HttpError(400, 'Missing imageBuffer parameter.');
  }

  const ai = getAi();
  if (!ai) {
    throw new HttpError(
      503,
      'Gemini cognitive services are not initialized on the backend. Please add GEMINI_API_KEY inside the Secrets panel of Settings.',
    );
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
  return { result: resultText };
}

export async function analyzeAudio(audioBase64: unknown, mimeType: unknown): Promise<Record<string, unknown>> {
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    throw new HttpError(400, 'Missing audioBase64 parameter.');
  }

  const ai = getAi();
  if (!ai) {
    throw new HttpError(503, 'Gemini services are not initialized. Add GEMINI_API_KEY in the Secrets panel.');
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
      mimeType: (typeof mimeType === 'string' && mimeType) || 'audio/wav',
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
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned);
  }
}
