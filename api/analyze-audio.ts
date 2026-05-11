import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzeAudio, HttpError } from '../lib/gemini';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const { audioBase64, mimeType } = req.body ?? {};
    const parsed = await analyzeAudio(audioBase64, mimeType);
    res.json(parsed);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error('Gemini audio analysis failure:', err);
    res.status(status).json({ error: err.message || 'Audio cognitive pipeline internal crash.' });
  }
}
