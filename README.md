# Roue

Tableau de service équitable : tours de garde, repos, relèves. Tout reste sur l’appareil.

Prototype. App web autonome, dans le style de Calque : un seul `index.html`, sans serveur, données sur l’appareil, partage par QR, lien, fichier ou PDF.

- À la racine : la version construite, prête à publier (GitHub Pages).
- `src/` : sources (`shared/` socle commun, `roue/engine.js` calcul, `roue/app.js` interface) et `build.mjs`.

Construire : dans `src/`, `npm install`, puis `node build.mjs roue` (sortie dans `src/dist/roue/`).

Les textes tirés des règlements sont des reformulations courtes ; les règlements en vigueur font foi. Outil d’instruction et de préparation : ne pas y saisir d’informations classifiées.
