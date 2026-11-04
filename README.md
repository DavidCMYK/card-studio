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
- **Alpha-accurate element shadows:** Enable a per-element shadow for text, shapes or image frames; choose colour, opacity, X/Y offset and circular spread (in export pixels). PNG transparency, clipped images and borders all determine the shadow silhouette. **Shadow overlap** is project-wide in Template → Card setup: **Add** retains normal stacked shadows; **Merge** preserves artwork stacking while preventing overlapping shadows from increasing their visible opacity. A higher artwork can still shadow a lower one; fully and partly transparent images are respected. Different shadow colours blend according to stacking order. Older projects default to Add.
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

This is an initial editor. Check the export output and dimensions before production printing. For exact fonts across devices, use File → Embed font files… or Embed installed project fonts… before saving. Only embed fonts whose licences permit embedding. Older files with font names alone use substitute fonts on phones. The bundled JSZip library retains its original license notice.

### Save and Save As

In **File**, choose **Save template** to write back to the template that was opened or previously saved via the browser's native file picker. **Save template as…** always asks for a location/name, then subsequent saves target the new file. Projects have independent Save and Save As destinations. The browser may ask permission before writing, and file handles are only retained during the current editor session; reopen the file after restarting the editor. In browsers without the File System Access API, Save downloads a new copy rather than overwriting, because websites are not allowed to modify arbitrary local files.

- Workspace panels: Template/Cards stays in the top toolbar; Layers, Staged Cards, and Image Sets are independent scrollable toolboxes with persistent scroll positions. Click a card in the toolbox to open it in Cards mode.

## Hosting on Cloudflare

Connect this GitHub repository to Cloudflare. Use `npm run build:pages` as the build command and `public` as the output directory. This command runs the tests and compiles the browser bundle before copying the static website assets. No server or database is needed.


## Mobile development and test Worker

Mobile development is isolated on [`feature/mobile-studio`](https://github.com/DavidCMYK/card-studio/tree/feature/mobile-studio). The permanent live Worker configuration stays in `wrangler.jsonc`; the independent test Worker uses `wrangler.test.jsonc`. See [`docs/mobile-staging.md`](docs/mobile-staging.md) for Cloudflare Git-branch setup and deployment safeguards.


## Undo/redo and portable fonts (mobile development)

Both desktop and mobile use the same document history: Undo (Ctrl/Cmd+Z) and Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y). Each completed drag or inspector edit is one step. History retains up to 60 steps, resets when opening or creating a different project, and is not saved to JSON. Native text-input undo is retained while the input is focused.

To fix missing fonts in an existing desktop project, open it on desktop and use File → Embed installed project fonts… (on supported Chrome/Edge with permission), or File → Embed font files… to select licensed TTF, OTF, WOFF or WOFF2 files. The font family name entered must match the text element. Save the project and open the new JSON on your phone. Embedded fonts are used for previews and PNG exports. They are never silently copied from your computer. JSON sizes can increase with bundled font files.

The mobile Cards panel shows lazy-rendered artwork thumbnails; they omit expensive shadow compositing, while PNG exports retain the full renderer.

For precise placement on a phone or tablet, select an element and tap Move to use the arrow-pad. Switch between 1 and 10 design-pixel increments; each tap can be undone independently.


## Local autosave and crash recovery (test branch)

- Every completed edit is backed up automatically to **IndexedDB in this browser**, usually after 1.6 seconds without another edit. Inspector fields also update their recovery copy while you type, and hiding/closing the tab triggers a best-effort final write.
- On the next visit, Card Studio **asks** whether to restore the latest local copy, download it as project JSON, or discard it. It never loads recovery data over your work without your permission.
- A confirmed native **Save project** clears the current tab's recovery copy. A download-only fallback does **not** claim to overwrite a file and therefore keeps the local recovery.
- Use **File → Local recovery…** to reopen the recovery prompt.
- Restored projects have **no write permission to any previous local file**. Use Save project / Save as to create a permanent JSON copy.
- The browser currently retains **one latest recovery copy per site**; edits to another document in the same browser may replace it. Save valuable projects as JSON before switching. Recovery stays on that **device, browser profile and site address**; it does not sync between desktop and phone.
- Private browsing, disabled site storage, full device storage, or clearing site data can prevent or erase local recovery. It is a safety net, not a replacement for saved project files. A tab closed instantly after editing may lose the last few changes if its final IndexedDB write does not complete.

The browser regression suite covers recover/discard after reload, explicit Save, a 240-card deck with embedded artwork, desktop/mobile PNG export equality, and tablet orientation changes.


## Installable offline web app (test branch)

The test deployment is also a Progressive Web App (PWA). Once it has loaded online, a service worker caches the application shell (HTML, CSS, JavaScript and icons), making the **editor available without internet access**. It does **not** upload your project files or use cloud storage. Embedded artwork/font data and browser recovery remain available offline in their normal storage.

On Android Chrome, open the test site online, then use the browser menu's **Install app** or **Add to Home screen** option. On desktop Chrome/Edge, look for the browser's Install app control. Installation support and menu wording vary by browser. Launch it once while online to finish caching; afterward, editing and local recovery work offline.

PWA storage is tied to the exact site origin. Installing the *test* address does not migrate local drafts to a future live domain; save JSON files to move projects between devices or environments. An installed PWA is still a web application; Android/iOS native wrappers remain separate future work.
