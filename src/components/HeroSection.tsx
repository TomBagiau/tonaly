import tonalyLogo from "../assets/tonaly.svg";

export default function HeroSection() {
  return (
    <section className="flex justify-center items-center min-h-screen w-full px-8">
      <div className="flex flex-col items-center text-center max-w-3xl w-full">
        <img 
          src={tonalyLogo} 
          alt="Tonaly logo" 
          className="mb-12 max-w-[200px] h-auto md:max-w-[150px] md:mb-8"
        />
        <h1 className="text-4xl md:text-3xl leading-tight mb-6 text-white font-semibold">
          Génère une playlist parfaite grâce à l'IA
        </h1>
        <p className="text-xl md:text-lg leading-relaxed mb-12 text-white/70 max-w-[600px]">
          Choisis ta plateforme, décris l'ambiance, laisse l'IA faire le reste.
        </p>
        <button 
          onClick={() => {
            document.getElementById('app-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-white text-[#121212] border-none rounded-[100px] px-12 py-4 text-lg font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(255,255,255,0.2)] active:translate-y-0"
        >
          Commencer
        </button>
      </div>
    </section>
  );
}

