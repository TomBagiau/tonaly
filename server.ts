import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Mistral } from '@mistralai/mistralai';

// Vérifier que la clé API Mistral est configurée
if (!process.env.MISTRAL_API_KEY) {
  console.warn('⚠️  MISTRAL_API_KEY n\'est pas configurée. Le chat IA ne fonctionnera pas.');
  console.warn('   Créez un fichier .env avec: MISTRAL_API_KEY=votre_cle_api');
}

// Initialiser le client Mistral
const mistralClient = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

// Instructions système pour contraindre l'IA
const SYSTEM_INSTRUCTIONS = `Tu es un assistant spécialisé UNIQUEMENT dans la création de playlists musicales.

RÈGLES STRICTES :
- Tu DOIS TOUJOURS orienter la conversation vers la création de playlists musicales
- Les playlists doivent contenir entre 30 et 50 chansons
- Tu NE DOIS JAMAIS répondre à des questions qui ne concernent pas la musique
- Si on te pose une question hors sujet, refuse poliment et redirige vers la musique

COMPORTEMENT :
- Salutation simple → Propose immédiatement de créer une playlist et demande l'ambiance recherchée
- Question musicale → Réponds avec enthousiasme et pose maximum 3 questions pour affiner
- Question hors sujet → "Je suis désolé, je suis spécialisé uniquement dans la création de playlists musicales. Puis-je vous aider à créer une playlist ? 🎵"

EXEMPLES :

User: Bonjour
Assistant: Bonjour ! 🎵 Je suis là pour vous aider à créer la playlist parfaite. Quelle ambiance recherchez-vous ? Quelque chose d'énergique, de relaxant, ou pour une occasion spéciale ?

User: Quelle est la capitale de la France ?
Assistant: Je suis désolé, je suis spécialisé uniquement dans la création de playlists musicales. Je ne peux pas répondre à cette question. Puis-je plutôt vous aider à créer une playlist de musique française ? 🎶`;

const app = express();
app.use(express.json());

// Route API pour le chat
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    // Utiliser l'API Conversations de Mistral avec instructions
    const response = await mistralClient.chat.complete({
      model: 'mistral-small-latest',
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTIONS },
        ...messages,
      ],
    });

    // Extraire le contenu de la réponse
    const rawContent = response.choices[0]?.message?.content || '';
    const content = typeof rawContent === 'string' ? rawContent : '';

    // Configurer les headers pour le format DataStream
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Vercel-AI-Data-Stream', 'v1');

    // Simuler le streaming en envoyant le contenu par morceaux
    const words = content.split(' ');
    for (const word of words) {
      const chunk = `0:${JSON.stringify(word + ' ')}\n`;
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

