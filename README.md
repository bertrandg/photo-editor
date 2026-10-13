# Éditeur photo

Petit éditeur d'image 100 % frontend : React + Vite + Tailwind + [shadcn/ui](https://ui.shadcn.com).

```bash
npm install
npm run dev
```

Démo : https://bertrandg.github.io/photo-editor/ — déployée automatiquement par GitHub Actions
(`.github/workflows/deploy.yml`) à chaque push sur `main`.

## Fonctionnement

1. **Import** : fichier local (clic ou glisser-déposer) ou URL web (le serveur doit autoriser le CORS).
2. **Éditeur** (desktop et mobile) : Recadrer · Ajuster · Filtres · Annoter, avec annuler/rétablir (⌘Z / ⇧⌘Z) et Avant/Après (maintenir le bouton).
3. **Export** : « Enregistrer » → téléchargement JPEG en pleine résolution.
   Les métadonnées EXIF d'une photo JPEG (appareil, date, GPS…) sont conservées :
   orientation remise à 1 (la rotation est déjà appliquée aux pixels), dimensions
   mises à jour, miniature intégrée supprimée.

### Performance et grandes images

- L'aperçu interactif travaille sur une copie réduite (2048 px max, `PREVIEW_MAX_EDGE`).
- Le filtre et les réglages de l'aperçu sont calculés sur le GPU (WebGL 1, `render/gpu-preview.ts`)
  en une seule passe ; repli automatique sur le CPU si WebGL est indisponible.
- L'export repart de l'image d'origine, traitée par bandes de 512 lignes dans un Web Worker
  (UI non bloquée, mémoire bornée). Au-delà des limites canvas du navigateur (16384 px / 120 MP)
  l'image est réduite automatiquement.

## Architecture (`src/editor`)

| Fichier | Rôle |
| --- | --- |
| `tools/index.ts` | **Registre des onglets** (id, libellé, icône, panneau, reset). Ajouter un outil = une entrée. |
| `adjustments.ts` | **Registre des réglages** : métadonnées UI, traitement CPU (`process`, export) et extrait GLSL (`gpu`, aperçu). Le panneau « Ajuster », l'aperçu et l'export sont générés à partir de ce tableau. |
| `filters.ts` | **Registre des filtres** : recettes d'opérations (matrice, contraste, virage, vignettage…), chacune compilée en GLSL (aperçu) et en JS (export). |
| `pipeline.ts` | Enchaînement filtre → réglages, partagé par le GPU, le repli CPU et le worker d'export. |
| `overlays/kinds.ts` | Rendu canvas des calques (texte, image). Ajouter un type = un renderer ici + un formulaire dans `tools/annotate/overlay-forms.tsx`. |
| `tools/crop/crop-panel.tsx` | Rotation 90°, symétries, redressement et `RATIO_PRESETS` (formats de recadrage). |
| `render/transform.ts` | Géométrie (rotation, miroir, redressement avec zoom auto), partagée par l'aperçu et l'export. |
| `render/export.ts` | Rendu pleine résolution + Web Worker (`adjust.worker.ts`). |
| `render/exif.ts` | Lecture des EXIF à l'import et réinjection dans le JPEG exporté (`piexifjs`). |
| `use-history.ts` | Undo/redo (les gestes continus comme un slider ne créent qu'une entrée). |
| `stage/` | Zone centrale : `CropStage` (cadre de recadrage) et `ResultStage` (rendu final + calques déplaçables). |
