import { useState, useEffect } from "react";
import HeroSection from "./components/HeroSection";
import AppSection from "./components/AppSection";
import ChatSection from "./components/ChatSection";

interface SpotifyUser {
  displayName: string;
  id: string;
  accessToken: string;
}

function App() {
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null);

  useEffect(() => {
    // Vérifier si l'utilisateur revient du callback Spotify
    const urlParams = new URLSearchParams(window.location.search);
    const spotifyUserData = urlParams.get('spotify_user');

    if (spotifyUserData) {
      try {
        const userData = JSON.parse(decodeURIComponent(spotifyUserData));
        setSpotifyUser(userData);

        // Nettoyer l'URL
        window.history.replaceState({}, document.title, '/');

        // Scroll vers la section chat
        setTimeout(() => {
          const chatSection = document.getElementById('chat-section');
          chatSection?.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      } catch (error) {
        console.error('Erreur lors du parsing des données Spotify:', error);
      }
    }
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/spotify/logout');
      setSpotifyUser(null);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  return (
    <div className="w-full min-h-screen">
      <HeroSection />
      <AppSection spotifyUser={spotifyUser} onLogout={handleLogout} />
      <ChatSection spotifyUser={spotifyUser} />
    </div>
  )
}

export default App

