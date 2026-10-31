# Card Studio

A browser-based card layout editor for creating game card templates, staging cards from spreadsheets, and exporting print-resolution artwork.

**Run it:** Download or clone the repository and open [`index.html`](index.html) in a desktop Chrome or Edge browser. A web server, internet connection and Node.js are not required to *use* the checked-in application.

## Features

- Custom card dimensions in millimetres, inches or pixels; PNG export at selectable DPI.
- Visual template editor with draggable and resizable text, image frames, shapes, gradients and borders.
- Installed font selection (browser support/permission permitting), text formatting and image fitting options.
- Named image sets with sequential, cycling and deterministic random placement.
- Export an XLSX staging spreadsheet using text/image element names, then import completed XLSX or CSV card data.
- Per-card layout and content overrides without changing the shared template.
- Save/load JSON projects (including embedded images) and templates, export current PNG or a ZIP of all cards.

## Source layout

| Path | Responsibility |
| --- | --- |
| `src/types.ts`, `src/model.ts` | Persisted project schema, templates, cards and per-card overrides |
| `src/preview.ts` | Interactive browser preview |
| `src/interface.ts` | Layer list, inspector, card list and editing controls |
| `src/editor.ts` | User actions, pointer and keyboard interactions |
| `src/image-sets.ts`, `src/assets.ts` | Image assignment, loading, caching and framing |
| `src/png-renderer.ts`, `src/png-export.ts` | Canvas drawing and PNG/ZIP export |
| `src/spreadsheet.ts` | XLSX/CSV import and XLSX generation |
| `src/project-storage.ts` | JSON save/load and template compatibility |
| `src/dom.ts` | DOM/download utilities |
| `vendor/jszip.min.js` | Bundled JSZip v3.10.1 for offline XLSX/ZIP handling |
| `dist/app.js` | **Generated** browser bundle, included for local/offline use |

The editor is written in TypeScript and uses the existing DOM-based canvas editor with a separate HTML5 Canvas export renderer. The renderer has **not** been replaced with Fabric.js; keeping the existing behavior intact was intentional for this structural refactor.

## Develop

Requires Node.js and TypeScript (installed with the development dependencies):

```sh
npm install
npm run build
npm test
```

`npm run build` compiles `src/*.ts` and creates `dist/app.js`. The repository deliberately includes the generated bundle, so ordinary users can simply open `index.html`. The small `scripts/bundle.cjs` builds a single offline-compatible browser script without requiring a separate development server or a bundler framework.

## Compatibility

Existing version 1 `.cardstudio.json` project files and `.template.json` files remain supported. Loading a saved project preserves embedded images and per-card overrides. Staged-card import currently replaces the staged cards, as in the original editor.

## Notes

This is an initial editor. Check the export output and dimensions before production printing. Fonts that are not installed on the computer may be substituted. The bundled JSZip library retains its original license notice.
