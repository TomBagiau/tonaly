import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Mistral } from '@mistralai/mistralai';
import {
  getSpotifyAuthUrl,
  exchangeCodeForToken,
  getSpotifyUserData,
  createCompletePlaylist,
  type PlaylistData,
} from './spotifyService.js';

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
- Tu NE DOIS JAMAIS répondre à des questions qui ne concernent pas la musique
- Si on te pose une question hors sujet, refuse poliment et redirige vers la musique
- Les playlists doivent contenir entre 30 et 50 chansons

COMPORTEMENT :
- Salutation simple → Propose immédiatement de créer une playlist et demande l'ambiance recherchée
- Nom de la playlist → Avant toute question, tu dois demander le nom que la playlist devra avoir
- Question musicale → Pose au maximum 3 questions pour affiner la playlist
- Question hors sujet → "Je suis désolé, je suis spécialisé uniquement dans la création de playlists musicales. Puis-je vous aider à créer une playlist ? 🎵"

FORMAT DE RÉPONSE FINALE :
Une fois que tu as toutes les informations nécessaires (nom de la playlist + ambiance/préférences), tu dois générer la playlist.
Ta réponse finale doit OBLIGATOIREMENT contenir un bloc JSON avec ce format exact :

\`\`\`json
{
  "playlistName": "Nom de la playlist",
  "tracks": [
    {
      "title": "Titre de la chanson",
      "artist": "Nom de l'artiste"
    }
  ]
}
\`\`\`

IMPORTANT : Le JSON doit être valide et contenir entre 30 et 50 chansons. Assure-toi d'inclure des chansons variées et pertinentes par rapport à l'ambiance demandée.

EXEMPLES :

User: Bonjour
Assistant: Bonjour ! 🎵 Je suis là pour vous aider à créer la playlist parfaite. Quelle ambiance recherchez-vous ? Quelque chose d'énergique, de relaxant, ou pour une occasion spéciale ?

User: Quelle est la capitale de la France ?
Assistant: Je suis désolé, je suis spécialisé uniquement dans la création de playlists musicales. Je ne peux pas répondre à cette question. Puis-je plutôt vous aider à créer une playlist de musique française ? 🎶`;

const app = express();
app.use(express.json());

// Route pour initier l'authentification Spotify
app.get('/api/spotify/login', (req, res) => {
  const authUrl = getSpotifyAuthUrl();
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
    const tokenData = await exchangeCodeForToken(code);

    // Récupérer les informations de l'utilisateur
    const userData = await getSpotifyUserData(tokenData.access_token);

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

// Route pour déconnexion Spotify
app.get('/api/spotify/logout', (req, res) => {
  res.json({ success: true });
});

// Route API pour créer une playlist sur Spotify
app.post('/api/spotify/create-playlist', async (req, res) => {
  try {
    const { playlistData, accessToken, userId } = req.body as {
      playlistData: PlaylistData;
      accessToken: string;
      userId: string;
    };

    if (!playlistData || !accessToken || !userId) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    // Utiliser le service Spotify pour créer la playlist complète
    const result = await createCompletePlaylist(playlistData, accessToken, userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Erreur lors de la création de la playlist:', error);

    // Gérer les erreurs spécifiques
    if (error instanceof Error && error.message.includes('Aucune musique trouvée')) {
      return res.status(404).json({
        error: error.message,
      });
    }

    res.status(500).json({
      error: 'Erreur lors de la création de la playlist',
      details: error instanceof Error ? error.message : 'Erreur inconnue',
    });
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

