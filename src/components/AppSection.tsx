import SpotifyLogo from "../assets/apps/SpotifyLogo.png";
import DeezerLogo from "../assets/apps/DeezerLogo.png";

interface SpotifyUser {
  displayName: string;
  id: string;
  accessToken: string;
}

interface AppSectionProps {
  spotifyUser: SpotifyUser | null;
  onLogout: () => void;
}

export default function AppSection({ spotifyUser, onLogout }: AppSectionProps) {
  const handleSpotifyLogin = async () => {
    try {
      const response = await fetch('/api/spotify/login');
      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Erreur lors de la connexion Spotify:', error);
    }
  };

  return (
    <section id="app-section" className="flex justify-center items-center min-h-screen w-full px-8 py-16">
      <div className="flex flex-col items-center gap-8">
        <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
          Choisis ta plateforme
        </h2>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
          <button
            onClick={handleSpotifyLogin}
            className="transition-opacity duration-200 hover:opacity-80 bg-transparent border-none cursor-pointer p-0"
            disabled={!!spotifyUser}
          >
            <img
              src={SpotifyLogo}
              alt="Spotify logo"
              className={`h-16 md:h-20 w-auto object-contain ${spotifyUser ? 'opacity-50' : ''}`}
            />
          </button>
          <a href="#" className="transition-opacity duration-200 hover:opacity-80">
            <img
              src={DeezerLogo}
              alt="Deezer logo"
              className="h-16 md:h-20 w-auto object-contain"
            />
          </a>
        </div>
        {spotifyUser && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm" style={{ color: '#1DB954' }}>
              ✓ Connecté en tant que {spotifyUser.displayName}
            </p>
            <button
              onClick={onLogout}
              className="text-white/60 hover:text-white text-sm underline bg-transparent border-none cursor-pointer transition-colors duration-200"
            >
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
