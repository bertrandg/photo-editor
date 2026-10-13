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
2. **Éditeur** : Recadrer · Ajuster · Annoter, avec annuler/rétablir (⌘Z / ⇧⌘Z) et Avant/Après (maintenir le bouton).
3. **Export** : « Enregistrer » → téléchargement JPEG / PNG / WebP en pleine résolution.

### Grandes images

- L'aperçu interactif travaille sur une copie réduite (2048 px max, `PREVIEW_MAX_EDGE`).
- L'export repart de l'image d'origine, traitée par bandes de 512 lignes dans un Web Worker
  (UI non bloquée, mémoire bornée). Au-delà des limites canvas du navigateur (16384 px / 120 MP)
  l'image est réduite automatiquement.

## Architecture (`src/editor`)

| Fichier | Rôle |
| --- | --- |
| `tools/index.ts` | **Registre des onglets** (id, libellé, icône, panneau, reset). Ajouter un outil = une entrée. |
| `adjustments.ts` | **Registre des réglages** (métadonnées UI + traitement pixel). Le panneau « Ajuster », l'aperçu et l'export sont générés à partir de ce tableau. |
| `overlays/kinds.ts` | Rendu canvas des calques (texte, image). Ajouter un type = un renderer ici + un formulaire dans `tools/annotate/overlay-forms.tsx`. |
| `tools/crop/crop-panel.tsx` | `RATIO_PRESETS` : liste des formats de recadrage. |
| `render/export.ts` | Rendu pleine résolution + Web Worker (`adjust.worker.ts`). |
| `use-history.ts` | Undo/redo (les gestes continus comme un slider ne créent qu'une entrée). |
| `stage/` | Zone centrale : `CropStage` (cadre de recadrage) et `ResultStage` (rendu final + calques déplaçables). |
