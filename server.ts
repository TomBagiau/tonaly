import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { mistral } from '@ai-sdk/mistral';
import { streamText } from 'ai';

// Vérifier que la clé API Mistral est configurée
if (!process.env.MISTRAL_API_KEY) {
  console.warn('⚠️  MISTRAL_API_KEY n\'est pas configurée. Le chat IA ne fonctionnera pas.');
  console.warn('   Créez un fichier .env avec: MISTRAL_API_KEY=votre_cle_api');
}

const app = express();
app.use(express.json());

// Route API pour le chat
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    const result = await streamText({
      model: mistral('mistral-small'),
      messages,
    });

    // Configurer les headers pour le format DataStream
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Vercel-AI-Data-Stream', 'v1');

    // Stream la réponse au format DataStream
    // Format DataStream: "0:content\n" où 0 = type texte, content = JSON stringifié
    for await (const textPart of result.textStream) {
      // Format DataStream: type:data\n
      // Type 0 = text-delta chunk
      const chunk = `0:${JSON.stringify(textPart)}\n`;
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    console.error('Error in chat API:', error);
    res.status(500).json({ 
      error: 'Une erreur est survenue lors de la génération de la réponse' 
    });
  }
});

async function createServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(5173, () => {
    console.log('Server running on http://localhost:5173');
  });
}

createServer();

