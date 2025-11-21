import SpotifyLogo from "../assets/apps/SpotifyLogo.png";
import DeezerLogo from "../assets/apps/DeezerLogo.png";

export default function AppSection() {
  return (
    <section id="app-section" className="flex justify-center items-center min-h-screen w-full px-8 py-16">
      <div className="flex flex-col items-center gap-8">
        <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
          Choisis ta plateforme
        </h2>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
          <a href="#" className="transition-opacity duration-200 hover:opacity-80">
            <img 
              src={SpotifyLogo} 
              alt="Spotify logo" 
              className="h-16 md:h-20 w-auto object-contain"
            />
          </a>
          <a href="#" className="transition-opacity duration-200 hover:opacity-80">
            <img 
              src={DeezerLogo} 
              alt="Deezer logo" 
              className="h-16 md:h-20 w-auto object-contain"
            />
          </a>
        </div>
      </div>
    </section>
  );
}

