import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzeFrame, HttpError } from '../lib/gemini';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const { imageBuffer, mode } = req.body ?? {};
    const result = await analyzeFrame(imageBuffer, mode);
    res.json(result);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error('Gemini frame process failure:', err);
    res.status(status).json({ error: err.message || 'Cognitive pipeline internal crash.' });
  }
}
