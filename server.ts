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

// Configuration Spotify OAuth
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = 'http://127.0.0.1:8000/callback';
const SCOPES = 'user-read-private user-read-email playlist-modify-public playlist-modify-private';

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

// Route pour déconnexion Spotify
app.get('/api/spotify/logout', (req, res) => {
  res.json({ success: true });
});

// Interface pour les données de la playlist
interface Track {
  title: string;
  artist: string;
}

interface PlaylistData {
  playlistName: string;
  tracks: Track[];
}

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

    console.log('\n📋 Formatage des données de la playlist...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Nom de la playlist: ${playlistData.playlistName}`);
    console.log(`🎵 Nombre de musiques: ${playlistData.tracks.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Formater les données dans un tableau
    console.log('📊 TABLEAU DES MUSIQUES:');
    console.log('┌─────┬────────────────────────────────────────┬────────────────────────────────────────┐');
    console.log('│ N°  │ Titre                                  │ Artiste                                │');
    console.log('├─────┼────────────────────────────────────────┼────────────────────────────────────────┤');

    playlistData.tracks.forEach((track, index) => {
      const num = String(index + 1).padEnd(3);
      const title = track.title.padEnd(38).substring(0, 38);
      const artist = track.artist.padEnd(38).substring(0, 38);
      console.log(`│ ${num} │ ${title} │ ${artist} │`);
    });

    console.log('└─────┴────────────────────────────────────────┴────────────────────────────────────────┘\n');

    // Rechercher les URIs Spotify pour chaque musique
    console.log('🔍 Recherche des musiques sur Spotify...\n');
    const trackUris: string[] = [];
    const notFoundTracks: Track[] = [];

    for (const track of playlistData.tracks) {
      const query = `${track.title} ${track.artist}`;
      const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`;

      try {
        const searchResponse = await fetch(searchUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        const searchData = await searchResponse.json();

        if (searchData.tracks?.items?.length > 0) {
          const spotifyTrack = searchData.tracks.items[0];
          trackUris.push(spotifyTrack.uri);
          console.log(`✅ Trouvé: ${track.title} - ${track.artist}`);
        } else {
          notFoundTracks.push(track);
          console.log(`❌ Non trouvé: ${track.title} - ${track.artist}`);
        }
      } catch (error) {
        console.error(`❌ Erreur lors de la recherche de: ${track.title} - ${track.artist}`, error);
        notFoundTracks.push(track);
      }
    }

    console.log(`\n📊 Résultat: ${trackUris.length}/${playlistData.tracks.length} musiques trouvées\n`);

    if (trackUris.length === 0) {
      return res.status(404).json({
        error: 'Aucune musique trouvée sur Spotify',
        notFoundTracks
      });
    }

    // Créer la playlist
    console.log('🎨 Création de la playlist sur Spotify...');
    const createPlaylistResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: playlistData.playlistName,
        description: `Playlist créée avec Tonaly - ${new Date().toLocaleDateString('fr-FR')}`,
        public: false,
      }),
    });

    const playlist = await createPlaylistResponse.json();

    if (!createPlaylistResponse.ok) {
      console.error('❌ Erreur lors de la création de la playlist:', playlist);
      return res.status(createPlaylistResponse.status).json({
        error: 'Erreur lors de la création de la playlist',
        details: playlist
      });
    }

    console.log(`✅ Playlist créée: ${playlist.name} (ID: ${playlist.id})\n`);

    // Ajouter les musiques à la playlist
    console.log('➕ Ajout des musiques à la playlist...');
    const addTracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: trackUris,
      }),
    });

    if (!addTracksResponse.ok) {
      const error = await addTracksResponse.json();
      console.error('❌ Erreur lors de l\'ajout des musiques:', error);
      return res.status(addTracksResponse.status).json({
        error: 'Erreur lors de l\'ajout des musiques',
        details: error
      });
    }

    console.log(`✅ ${trackUris.length} musiques ajoutées à la playlist\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 PLAYLIST CRÉÉE AVEC SUCCÈS !');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    res.json({
      success: true,
      playlist: {
        id: playlist.id,
        name: playlist.name,
        url: playlist.external_urls.spotify,
        tracksAdded: trackUris.length,
        tracksNotFound: notFoundTracks.length,
      },
      notFoundTracks,
    });
  } catch (error) {
    console.error('❌ Erreur lors de la création de la playlist:', error);
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

