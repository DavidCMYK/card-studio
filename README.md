# Card Studio

A browser-based card layout editor for creating game card templates, staging cards from spreadsheets, and exporting print-resolution artwork.

**Run it:** Download or clone the repository and open [`index.html`](index.html) in a desktop Chrome or Edge browser. A web server, internet connection and Node.js are not required to *use* the checked-in application.

## Features

- Custom card dimensions in millimetres, inches or pixels, with always-visible output pixel dimensions at the selected DPI. Both the template and individual elements show size in the selected unit and export pixels. Changing DPI preserves the physical layout and updates its pixel resolution.
- Visual template editor with draggable text, image frames and shapes, with resize handles on all edges and corners, plus gradients and borders.
- Resize handles follow pointer movement without drift or directional lag. Fitted image frames retain their starting frame aspect ratio on corner drags; edge drags can adjust one dimension freely.
- Scroll the workspace vertically or horizontally when the card exceeds the viewport; zoom controls keep the current viewing area centred.
- Independent opacity controls for background (or the framed image), border, and text where applicable. Older projects retain their existing appearance.
- Copy, cut and paste template elements using toolbar buttons or Ctrl/Cmd+C, X and V. Copies keep styling, image assignment and dimensions; cut-and-paste preserves staged card data.
- **Conditional visibility:** Text boxes default to **Invisible if empty**; an empty spreadsheet/card value hides the full text box (including its fill and border) on that card. Shapes and image frames can follow a named text box's visibility via **Visibility link**. Template mode still displays empty fields and linked elements for editing, while cards previews and individual/batch PNG exports apply the rules.
- **Text auto-sizing:** independently auto-fit width and height to each card's text, anchored by horizontal and vertical alignment; set left/right/top/bottom gutters separately for background and border padding. Preview and PNG export share the same text layout.
- **Edge anchoring:** Link a shape or image frame to a text element, then lock individual left, right, top and bottom edges. Anchor distances follow moving or auto-sizing text, and two opposing anchors stretch the linked element without changing the template layout for other cards.
- **Editor-only elements:** Select any element in Template mode and untick **Include in exported images**. Such layers remain in the Template editor (for cut lines, bleed markers and guides) but are hidden in Cards mode and excluded from all PNG exports. Older saved projects default to including their existing elements in exports.
- Installed font selection (browser support/permission permitting), text formatting and image fitting options.
- Manage each image set with **Manage images** to add, rename or remove individual images without deleting the set. Renaming updates linked Single Image and card filename references.
- **Alpha-accurate element shadows:** Text, shapes and image frames can cast shadows from their visible alpha (including transparent holes and borders) with colour, opacity, X/Y offset and circular spread in export pixels. Phase 1 has additive overlap; merged/max-opacity overlap is planned later.
- Image frames can independently flip image content horizontally or vertically and rotate it by any angle (or in 90° steps), without rotating the frame or border. The editor preview and PNG export share the same transform.
- Named image sets with sequential, cycling, deterministic random, or **Single Image** assignment. Single Image lets you select one filename from a chosen set and uses that same image on every card, regardless of spreadsheet image values.
- Export an XLSX staging spreadsheet using text/image element names, then import completed XLSX or CSV card data.
- Per-card layout and content overrides without changing the shared template.
- File menu with New, Open, Save and Save As for projects and templates. In Chrome/Edge, browser-granted file handles let Save overwrite the previously opened or saved file; Save As selects a different filename. Other browsers use downloads and cannot overwrite an existing local file.
- Save/load JSON projects (including embedded images) and templates, export current PNG or a ZIP of all cards.

## Sizing and resolution

Card Studio stores geometry in a stable design coordinate system (96 design pixels/inch), but **pixels shown in the editor mean pixels in the final exported PNG at the selected DPI**. For example, a 2.5 × 3.5 inch template at 300 DPI exports at 750 × 1050 px; at 600 DPI it exports at 1500 × 2100 px. The physical dimensions and element placements stay unchanged.

Use **Card setup** to change the template dimensions, units, or resolution. The inspector always shows final export pixel dimensions alongside the chosen unit. Selecting an element shows its X/Y position and width/height in the chosen unit and in export pixels, including during drag/resize.

Pixel-unit templates are DPI-aware too: changing DPI preserves physical card size, so the shown pixel dimensions change. Changing pixel dimensions directly changes physical size at the selected DPI. Version 1 templates saved in pixel mode are migrated on load to preserve their former output dimensions and layout.

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

## Deploy to Cloudflare Workers (static assets)

Card Studio is a static browser application. The supported deployment is a **Cloudflare Worker with static assets**, connected to the GitHub repository. The checked-in `wrangler.jsonc` tells Wrangler to deploy the `public/` build output as a static site; no Worker script, database, or API keys are needed.

Cloudflare dashboard setup:

1. Go to **Workers & Pages → Create application**, then choose **GitHub** and import `DavidCMYK/card-studio`.
2. Select production branch `main` and application name `card-studio`.
3. Set **Build command** to `npm run build:pages`.
4. Set **Deploy command** to `npx wrangler deploy` (the normal Workers default).
5. Leave **Root directory** empty, and save/deploy. The site becomes available at the assigned `*.workers.dev` URL.

The build command runs the automated tests, builds the browser bundle, and assembles `public/index.html`, `public/styles.css`, `public/dist/app.js`, and `public/vendor/jszip.min.js`. Wrangler deploys those files as Workers Static Assets. New commits to `main` automatically rebuild and deploy through the Git integration.

Local verification: `npm install && npm run build:pages`. Manual deployment (after Cloudflare login): `npm run deploy`.

**Custom domain:** Workers custom domains require an active Cloudflare-managed DNS zone. You may continue hosting the website itself at IONOS, but do not change your domain's nameservers without first carefully copying all existing IONOS website and email DNS records. Until the domain is configured, use the `workers.dev` address, linked from your existing site.

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

### Save and Save As

In **File**, choose **Save template** to write back to the template that was opened or previously saved via the browser's native file picker. **Save template as…** always asks for a location/name, then subsequent saves target the new file. Projects have independent Save and Save As destinations. The browser may ask permission before writing, and file handles are only retained during the current editor session; reopen the file after restarting the editor. In browsers without the File System Access API, Save downloads a new copy rather than overwriting, because websites are not allowed to modify arbitrary local files.

- Workspace panels: Template/Cards stays in the top toolbar; Layers, Staged Cards, and Image Sets are independent scrollable toolboxes with persistent scroll positions. Click a card in the toolbox to open it in Cards mode.
