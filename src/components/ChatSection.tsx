import { useRef, useEffect, useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface SpotifyUser {
  displayName: string;
  id: string;
  accessToken: string;
}

interface ChatSectionProps {
  spotifyUser: SpotifyUser | null;
}

interface Track {
  title: string;
  artist: string;
}

interface PlaylistData {
  playlistName: string;
  tracks: Track[];
}

export default function ChatSection({ spotifyUser }: ChatSectionProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSpotifyConnected = !!spotifyUser;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fonction pour extraire le JSON de la playlist depuis le message
  const extractPlaylistData = (content: string): PlaylistData | null => {
    try {
      // Chercher un bloc JSON dans le contenu
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        const data = JSON.parse(jsonMatch[1]);
        if (data.playlistName && Array.isArray(data.tracks) && data.tracks.length > 0) {
          return data;
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'extraction des données de la playlist:', error);
    }
    return null;
  };

  // Fonction pour créer la playlist sur Spotify
  const handleCreatePlaylist = async () => {
    if (!playlistData || !spotifyUser) {
      return;
    }

    setIsCreatingPlaylist(true);

    try {
      const response = await fetch('/api/spotify/create-playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playlistData,
          accessToken: spotifyUser.accessToken,
          userId: spotifyUser.id,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Ajouter un message de succès dans le chat
        const successMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `✅ Playlist "${result.playlist.name}" créée avec succès !\n\n🎵 ${result.playlist.tracksAdded} musiques ajoutées\n${result.notFoundTracks.length > 0 ? `⚠️ ${result.notFoundTracks.length} musiques non trouvées sur Spotify\n` : ''}\n🔗 [Ouvrir dans Spotify](${result.playlist.url})`,
        };
        setMessages((prev) => [...prev, successMessage]);
        setPlaylistData(null); // Réinitialiser les données de la playlist
      } else {
        throw new Error(result.error || 'Erreur lors de la création de la playlist');
      }
    } catch (error) {
      console.error('Erreur:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ Erreur lors de la création de la playlist: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Créer un message assistant vide pour le streaming
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };
    setMessages((prev) => [...prev, assistantMessage]);

    let currentAssistantMessageId = assistantMessageId;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération de la réponse');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Impossible de lire la réponse');
      }

      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Parser le format DataStream: "0:content\n"
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const content = JSON.parse(line.slice(2));
              accumulatedText += content;

              // Mettre à jour le message assistant avec le texte accumulé
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === currentAssistantMessageId
                    ? { ...msg, content: accumulatedText }
                    : msg
                )
              );
            } catch (e) {
              // Ignorer les erreurs de parsing
            }
          }
        }
      }

      // Vérifier si le message contient des données de playlist
      const extractedData = extractPlaylistData(accumulatedText);
      if (extractedData) {
        setPlaylistData(extractedData);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === currentAssistantMessageId
            ? { ...msg, content: 'Erreur lors de la génération de la réponse. Veuillez réessayer.' }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="chat-section" className="flex justify-center items-center min-h-screen w-full px-8 py-16">
      <div className="flex flex-col items-center w-full max-w-4xl">
        {spotifyUser && (
          <p className="text-sm mb-2" style={{ color: '#1DB954' }}>
            Bonjour {spotifyUser.displayName}
          </p>
        )}
        <h2 className="text-3xl md:text-4xl font-semibold text-white mb-8">
          décris l'ambiance
        </h2>

        <div className="w-full bg-[#1a1a1a] rounded-2xl shadow-xl border border-white/10 overflow-hidden flex flex-col h-[600px]">
          {/* Zone des messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-white/60 py-12">
                <p className="text-lg">Décris l'ambiance de la playlist que tu souhaites</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === 'user'
                    ? 'bg-white text-[#121212]'
                    : 'bg-white/10 text-white'
                    }`}
                >
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {message.content || (message.role === 'assistant' && isLoading ? '...' : '')}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content && (
              <div className="flex justify-start">
                <div className="bg-white/10 text-white rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Zone de saisie */}
          <form onSubmit={handleSubmit} className="border-t border-white/10 p-4">
            <div className="flex gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tapez votre message..."
                disabled={isLoading}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="text-[#121212] border-none rounded-xl px-6 py-3 font-semibold cursor-pointer transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: isSpotifyConnected ? '#1DB954' : '#FFF' }}
              >
                Envoyer
              </button>
            </div>
          </form>

          {/* Bouton pour créer la playlist */}
          {playlistData && spotifyUser && (
            <div className="border-t border-white/10 p-4 bg-white/5">
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <p className="font-semibold">🎵 Playlist prête !</p>
                  <p className="text-sm text-white/60">
                    {playlistData.playlistName} • {playlistData.tracks.length} musiques
                  </p>
                </div>
                <button
                  onClick={handleCreatePlaylist}
                  disabled={isCreatingPlaylist}
                  className="text-white border-none rounded-xl px-6 py-3 font-semibold cursor-pointer transition-all duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#1DB954' }}
                >
                  {isCreatingPlaylist ? 'Création...' : 'Créer sur Spotify'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
