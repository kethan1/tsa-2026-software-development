import type { VercelRequest, VercelResponse } from '@vercel/node';
import { synthesizeSpeech, HttpError } from '../lib/gemini';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const { text, voice } = req.body ?? {};
    const result = await synthesizeSpeech(text, voice);
    res.json(result);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error('Gemini speech synthesis failure:', err);
    res.status(status).json({ error: err.message || 'Speech synthesis pipeline internal crash.' });
  }
}
