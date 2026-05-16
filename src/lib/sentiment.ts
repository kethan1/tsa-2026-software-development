// Real-time, fully client-side sentiment analysis for the Speech tab.
//
// There is no server round-trip here on purpose: live captions need to colour
// each word the instant it is recognised, so this runs on a local lexicon and a
// few heuristics instead of an API call. `analyzeSentence` returns one coloured
// token per word plus an aggregate sentiment for the whole utterance.

export type EmotionId = 'angry' | 'urgent' | 'happy' | 'sad' | 'calm' | 'neutral';

export const EMOTION_COLORS: Record<EmotionId, string> = {
  angry: '#ef4444',
  urgent: '#f59e0b',
  happy: '#22c55e',
  sad: '#3b82f6',
  calm: '#14b8a6',
  neutral: '#9ca3af',
};

export const EMOTION_LABELS: Record<EmotionId, string> = {
  angry: 'Angry',
  urgent: 'Urgent',
  happy: 'Happy',
  sad: 'Sad',
  calm: 'Calm',
  neutral: 'Neutral',
};

// Polarity: how positive (+1) or negative (-1) each emotion reads. Drives the
// overall sentence sentiment meter.
const EMOTION_POLARITY: Record<EmotionId, number> = {
  happy: 1,
  calm: 0.5,
  neutral: 0,
  sad: -0.6,
  urgent: -0.4,
  angry: -1,
};

// How strongly an emotion should win when picking the dominant tone of a
// sentence. Alarming emotions outrank ambient ones so a single "help" still
// flags the whole line as urgent.
const EMOTION_WEIGHT: Record<EmotionId, number> = {
  angry: 2.4,
  urgent: 2.6,
  sad: 1.6,
  happy: 1.4,
  calm: 1,
  neutral: 0,
};

// Word -> emotion lexicon. Kept compact but covers the common assistive-context
// vocabulary (safety, greetings, feelings, requests).
const LEXICON: Record<EmotionId, string[]> = {
  angry: [
    'angry', 'mad', 'furious', 'hate', 'hated', 'annoyed', 'annoying', 'upset',
    'ridiculous', 'stupid', 'idiot', 'shut', 'enough', 'unacceptable', 'rage',
    'disgusting', 'terrible', 'awful', 'worst', 'damn', 'no', 'never', 'stop',
  ],
  urgent: [
    'help', 'emergency', 'hurry', 'now', 'danger', 'dangerous', 'careful',
    'watch', 'look', 'run', 'fire', 'quick', 'quickly', 'immediately', 'warning',
    'alert', 'caution', 'evacuate', 'call', 'ambulance', 'police', 'wait',
  ],
  happy: [
    'happy', 'great', 'thanks', 'thank', 'awesome', 'love', 'loved', 'nice',
    'excited', 'glad', 'wonderful', 'amazing', 'good', 'yes', 'yay', 'perfect',
    'beautiful', 'fun', 'enjoy', 'congrats', 'congratulations', 'welcome', 'hi',
    'hello', 'please', 'cool', 'fantastic', 'delighted',
  ],
  sad: [
    'sad', 'sorry', 'hurt', 'hurts', 'crying', 'cry', 'lonely', 'tired', 'miss',
    'missed', 'worried', 'worry', 'unfortunately', 'disappointed', 'lost',
    'sick', 'pain', 'afraid', 'scared', 'unwell', 'depressed', 'alone',
  ],
  calm: [
    'okay', 'ok', 'fine', 'calm', 'relax', 'breathe', 'slowly', 'slow',
    'peaceful', 'gentle', 'easy', 'steady', 'alright', 'sure', 'understood',
    'maybe', 'later', 'soon', 'home', 'quiet',
  ],
  neutral: [],
};

// Build a flat word -> emotion map once at module load.
const WORD_EMOTION = new Map<string, EmotionId>();
(Object.keys(LEXICON) as EmotionId[]).forEach((emotion) => {
  for (const word of LEXICON[emotion]) WORD_EMOTION.set(word, emotion);
});

export type Token = {
  /** The word exactly as it should be displayed (original casing + punctuation). */
  text: string;
  /** Emotion bucket used to colour this word. */
  emotion: EmotionId;
};

export type SentenceAnalysis = {
  tokens: Token[];
  /** Dominant emotion across the whole sentence. */
  overall: EmotionId;
  /** -1 (very negative) … +1 (very positive). */
  polarity: number;
  /** 0 … 1 — how emotionally charged the sentence is overall. */
  intensity: number;
};

const stripWord = (raw: string) => raw.toLowerCase().replace(/[^a-z']+/g, '');

function classifyWord(raw: string): EmotionId {
  const word = stripWord(raw);
  if (!word) return 'neutral';

  const direct = WORD_EMOTION.get(word);
  if (direct) return direct;

  // Light morphology: "frustrated" -> "frustrate", "thanks" handled in lexicon.
  if (word.endsWith('ing') && WORD_EMOTION.has(word.slice(0, -3))) {
    return WORD_EMOTION.get(word.slice(0, -3))!;
  }
  if (word.endsWith('ed') && WORD_EMOTION.has(word.slice(0, -2))) {
    return WORD_EMOTION.get(word.slice(0, -2))!;
  }

  // SHOUTED words read as urgent emphasis even when not in the lexicon.
  if (raw.length > 2 && raw === raw.toUpperCase() && /[A-Z]/.test(raw)) return 'urgent';

  return 'neutral';
}

export function analyzeSentence(text: string): SentenceAnalysis {
  const parts = text.split(/(\s+)/); // keep whitespace so display spacing is preserved
  const tokens: Token[] = [];
  const counts: Record<EmotionId, number> = {
    angry: 0, urgent: 0, happy: 0, sad: 0, calm: 0, neutral: 0,
  };

  for (const part of parts) {
    if (part.trim() === '') {
      tokens.push({ text: part, emotion: 'neutral' });
      continue;
    }
    const emotion = classifyWord(part);
    tokens.push({ text: part, emotion });
    counts[emotion] += 1;
  }

  // Exclamation marks amplify whatever the sentence already leans toward.
  const bangBoost = Math.min(2, (text.match(/!/g) || []).length);
  if (bangBoost) {
    if (counts.angry > 0) counts.angry += bangBoost;
    else if (counts.urgent > 0 || /\b(help|run|fire|now|stop)\b/i.test(text)) counts.urgent += bangBoost;
    else counts.happy += bangBoost;
  }

  let overall: EmotionId = 'neutral';
  let best = 0;
  let charged = 0;
  (Object.keys(counts) as EmotionId[]).forEach((emotion) => {
    if (emotion === 'neutral') return;
    const score = counts[emotion] * EMOTION_WEIGHT[emotion];
    charged += counts[emotion];
    if (score > best) {
      best = score;
      overall = emotion;
    }
  });

  const meaningful = tokens.filter((t) => t.text.trim() !== '').length || 1;
  const intensity = Math.min(1, charged / meaningful + (bangBoost ? 0.15 : 0));

  // Polarity weighted by each emotion's share of the charged words.
  let polarity = 0;
  if (charged > 0) {
    (Object.keys(counts) as EmotionId[]).forEach((emotion) => {
      if (emotion === 'neutral') return;
      polarity += (counts[emotion] / charged) * EMOTION_POLARITY[emotion];
    });
  }

  return { tokens, overall, polarity, intensity };
}
