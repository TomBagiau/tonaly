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

// Configuration Spotify OAuth
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = 'http://127.0.0.1:8000/callback';
const SCOPES = 'user-read-private user-read-email';

// Route pour initier l'authentification Spotify
app.get('/api/spotify/login', (req, res) => {
  const authUrl = `https://accounts.spotify.com/authorize?` +
    `client_id=${SPOTIFY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}`;

  res.json({ authUrl });
});

// Route de callback Spotify
app.get('/callback', async (req, res) => {
  const code = req.query.code as string;

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    // Échanger le code contre un access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Erreur lors de l\'obtention du token:', tokenData);
      return res.redirect('/?error=token_error');
    }

    // Récupérer les informations de l'utilisateur
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    // Rediriger vers l'application avec les données utilisateur
    const userDataEncoded = encodeURIComponent(JSON.stringify({
      displayName: userData.display_name,
      id: userData.id,
      accessToken: tokenData.access_token,
    }));

    res.redirect(`/?spotify_user=${userDataEncoded}`);
  } catch (error) {
    console.error('Erreur lors de l\'authentification Spotify:', error);
    res.redirect('/?error=auth_failed');
  }
});

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

  app.listen(8000, () => {
    console.log('Server running on http://127.0.0.1:8000');
  });
}

createServer();

