import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { analyzeFrame, analyzeAudio, synthesizeSpeech, HttpError } from './lib/gemini';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

function sendError(res: express.Response, err: any, fallback: string, logPrefix: string) {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error(logPrefix, err);
  res.status(status).json({ error: err?.message || fallback });
}

app.post('/api/analyze-frame', async (req, res) => {
  try {
    const { imageBuffer, mode } = req.body ?? {};
    res.json(await analyzeFrame(imageBuffer, mode));
  } catch (err) {
    sendError(res, err, 'Cognitive pipeline internal crash.', 'Gemini frame process failure:');
  }
});

app.post('/api/analyze-audio', async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body ?? {};
    res.json(await analyzeAudio(audioBase64, mimeType));
  } catch (err) {
    sendError(res, err, 'Audio cognitive pipeline internal crash.', 'Gemini audio analysis failure:');
  }
});

app.post('/api/synthesize-speech', async (req, res) => {
  try {
    const { text, voice } = req.body ?? {};
    res.json(await synthesizeSpeech(text, voice));
  } catch (err) {
    sendError(res, err, 'Speech synthesis pipeline internal crash.', 'Gemini speech synthesis failure:');
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
