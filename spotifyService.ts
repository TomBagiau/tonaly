import 'dotenv/config';

// Configuration Spotify OAuth
export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
export const REDIRECT_URI = 'http://127.0.0.1:8000/callback';
export const SCOPES = 'user-read-private user-read-email playlist-modify-public playlist-modify-private';

// Interfaces
export interface Track {
    title: string;
    artist: string;
}

export interface PlaylistData {
    playlistName: string;
    tracks: Track[];
}

export interface SpotifyTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
}

export interface SpotifyUserData {
    display_name: string;
    id: string;
    email?: string;
}

/**
 * Génère l'URL d'authentification Spotify
 */
export function getSpotifyAuthUrl(): string {
    return `https://accounts.spotify.com/authorize?` +
        `client_id=${SPOTIFY_CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(SCOPES)}`;
}

/**
 * Échange le code d'autorisation contre un access token
 */
export async function exchangeCodeForToken(code: string): Promise<SpotifyTokenResponse> {
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
        throw new Error(`Erreur lors de l'obtention du token: ${JSON.stringify(tokenData)}`);
    }

    return tokenData;
}

/**
 * Récupère les informations de l'utilisateur Spotify
 */
export async function getSpotifyUserData(accessToken: string): Promise<SpotifyUserData> {
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!userResponse.ok) {
        throw new Error('Erreur lors de la récupération des données utilisateur');
    }

    return await userResponse.json();
}

/**
 * Recherche une musique sur Spotify et retourne son URI
 */
export async function searchTrackOnSpotify(
    track: Track,
    accessToken: string
): Promise<string | null> {
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
            console.log(`✅ Trouvé: ${track.title} - ${track.artist}`);
            return spotifyTrack.uri;
        } else {
            console.log(`❌ Non trouvé: ${track.title} - ${track.artist}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Erreur lors de la recherche de: ${track.title} - ${track.artist}`, error);
        return null;
    }
}

/**
 * Crée une playlist sur Spotify
 */
export async function createSpotifyPlaylist(
    userId: string,
    playlistName: string,
    accessToken: string
) {
    const createPlaylistResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: playlistName,
            description: `Playlist créée avec Tonaly - ${new Date().toLocaleDateString('fr-FR')}`,
            public: false,
        }),
    });

    const playlist = await createPlaylistResponse.json();

    if (!createPlaylistResponse.ok) {
        throw new Error(`Erreur lors de la création de la playlist: ${JSON.stringify(playlist)}`);
    }

    console.log(`✅ Playlist créée: ${playlist.name} (ID: ${playlist.id})\n`);
    return playlist;
}

/**
 * Ajoute des musiques à une playlist Spotify
 */
export async function addTracksToPlaylist(
    playlistId: string,
    trackUris: string[],
    accessToken: string
) {
    const addTracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
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
        throw new Error(`Erreur lors de l'ajout des musiques: ${JSON.stringify(error)}`);
    }

    console.log(`✅ ${trackUris.length} musiques ajoutées à la playlist\n`);
}

/**
 * Affiche un tableau formaté des musiques dans la console
 */
export function displayPlaylistTable(playlistData: PlaylistData): void {
    console.log('\n📋 Formatage des données de la playlist...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Nom de la playlist: ${playlistData.playlistName}`);
    console.log(`🎵 Nombre de musiques: ${playlistData.tracks.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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
}

/**
 * Fonction principale pour créer une playlist complète sur Spotify
 */
export async function createCompletePlaylist(
    playlistData: PlaylistData,
    accessToken: string,
    userId: string
) {
    // Afficher le tableau des musiques
    displayPlaylistTable(playlistData);

    // Rechercher les URIs Spotify pour chaque musique
    console.log('🔍 Recherche des musiques sur Spotify...\n');
    const trackUris: string[] = [];
    const notFoundTracks: Track[] = [];

    for (const track of playlistData.tracks) {
        const uri = await searchTrackOnSpotify(track, accessToken);
        if (uri) {
            trackUris.push(uri);
        } else {
            notFoundTracks.push(track);
        }
    }

    console.log(`\n📊 Résultat: ${trackUris.length}/${playlistData.tracks.length} musiques trouvées\n`);

    if (trackUris.length === 0) {
        throw new Error('Aucune musique trouvée sur Spotify');
    }

    // Créer la playlist
    console.log('🎨 Création de la playlist sur Spotify...');
    const playlist = await createSpotifyPlaylist(userId, playlistData.playlistName, accessToken);

    // Ajouter les musiques à la playlist
    console.log('➕ Ajout des musiques à la playlist...');
    await addTracksToPlaylist(playlist.id, trackUris, accessToken);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 PLAYLIST CRÉÉE AVEC SUCCÈS !');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return {
        success: true,
        playlist: {
            id: playlist.id,
            name: playlist.name,
            url: playlist.external_urls.spotify,
            tracksAdded: trackUris.length,
            tracksNotFound: notFoundTracks.length,
        },
        notFoundTracks,
    };
}
