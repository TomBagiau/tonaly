# Tonaly - Application de génération de playlists avec IA

Application React + TypeScript + Vite pour générer des playlists parfaites grâce à l'IA.

## Configuration

### Clé API Mistral

Pour utiliser le chat IA, vous devez configurer votre clé API Mistral :

1. Obtenez votre clé API sur [https://console.mistral.ai/](https://console.mistral.ai/)
2. Créez un fichier `.env` à la racine du projet :
   ```
   MISTRAL_API_KEY=votre_cle_api_ici
   ```

## Développement

Pour lancer le serveur de développement :

```bash
npm run dev
```

Le serveur sera accessible sur [http://localhost:5173](http://localhost:5173)

## Composants

- **HeroSection** : Section d'accueil avec le logo et le message principal
- **AppSection** : Section pour choisir la plateforme de streaming
- **ChatSection** : Interface de chat avec l'IA utilisant le modèle Mistral Small

## Technologies utilisées

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Vercel AI SDK
- Mistral AI (mistral-small)
