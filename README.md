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


## Multi-template projects and card sets (test branch)

A project can contain **multiple reusable templates** and **multiple card sets**. Each card set has one assigned **front template** and an optional **back template**, both referenced by persistent template IDs. Any template may be assigned to any number of sets on either side. Editing a template updates all cards that reference it, without copying the design to those cards. Individual card content and layout overrides remain separate.

On desktop, the left library uses **expandable sections** for Layers, Templates, Card Sets, Staged Cards and Image Sets. Click a section heading to give that list the entire remaining sidebar height; only one section is expanded at a time, and switching sections retains the previous scroll position. In the **Templates** section, create an empty template, duplicate an existing one, rename or select one for editing. Use **Card Sets** to create sets, assign their front/back templates, add cards, and move existing cards between sets with the **Card set** control in Card Data. In Cards mode, switch **Front / Back** to inspect each side; Template mode edits the current shared design. Mobile has a **Sets** bottom-dock panel and a front/back toggle in card navigation.

The front and back of any one set must have matching **finished cut dimensions**, though their canvas/bleed measurements may differ. Print sheets accept multiple sets of the same cut size; for different sizes, print them in separate jobs. Older projects load as one shared template and one default card set, retaining their artwork, data, and card overrides.

**File management:** **Open template** imports a new independent template without replacing cards or existing designs. **Save template** and **Save template as** operate on the currently selected template; each template has its own file handle. **Save all templates** updates each template's already-associated file directly. New templates are saved as separate `.template.json` files in a chosen folder where supported; on browsers without folder access, the studio also downloads a ZIP containing every template. The files include embedded fonts and referenced image sets. **Save project** retains every template, set, card, assignment, font and image in one project JSON.

**Spreadsheet data:** XLSX export uses one worksheet per **card set**, named after the set. Each tab contains only that set's cards and fields from its assigned front/back templates, with columns following the Layers list from top to bottom (excluding shapes and fields whose **Include in data export** setting is off). There is no **Card Set** column. The toolbar's **Export XLSX** generates a workbook with every set's tab; a set's own **Export XLSX** button generates exactly the same tab in a one-sheet workbook. **Import sheet** reads all tabs and updates their matching card sets; a set's **Import XLSX / CSV** targets that set only. Existing cards matched by name retain saved card-only layouts, print options and values absent from the sheet; new rows become new cards. Other card sets remain unchanged by single-set imports, and an import asks before deleting cards with custom layouts. Old flat spreadsheets with a **Card Set** column can still be imported.

**Deployment:** Commits to `feature/mobile-studio` should trigger the Cloudflare Pages test build. The three GitHub Actions verification workflows are configured for manual dispatch only; do not use commit-message CI skip markers, since they can suppress Cloudflare deployment as well.

## Automatic artwork matching (test branch)

Open **Match artwork** from the desktop toolbar, mobile Export menu, a card set or the bulk data editor. Choose the card set, image field (front or back), matching key (**Card name** or a text/ID field) and optional image set to search. Add files via file picker, select an entire image folder in supporting browsers, or drop image files into the dialog. Imported images use the project's existing image sets. Matching is local; it does not upload artwork to an AI service.

The matcher compares exact filenames, punctuation/case/accent-normalized names, common artwork suffixes (e.g. `-final` or `-art`), rearranged words and cautious spelling similarity. A target image frame's preferred image set breaks exact ties. **Only unique, high-confidence suggestions are preselected.** Fuzzy suggestions and ambiguous matches are left for review. Browse a thumbnail gallery or manually choose another image for any row, then click **Apply selected matches**. Multiple assignments are one undoable operation. Each saved image reference includes its image-set name to avoid collisions, and exports and the spreadsheet editor use those exact same references. Existing assignments are never replaced unless **Replace existing card assignments** is checked; missing old files are explicitly flagged. A template image fixed to a single file is never modified by per-card matching.

Matching uses filenames and existing card data, not image-content recognition. It cannot infer that an unrelated filename contains the correct character illustration, or guarantee that a fuzzy match is right. Review suggestions before applying.

## Bulk card data editor (test branch)

Open **Edit card data** on desktop, in the mobile Export menu, or from a specific **Card set → Edit data** button. The grid shows one row per staged card and the **same column names, order, front/back template fields, and data-export exclusions** as the matching XLSX worksheet. Choose a set, then edit any card name, text value, or image filename directly. Card-specific geometry, overrides, print settings and images are preserved. The grid does not modify templates.

Paste multiple cells/rows from Excel into a focused cell using Ctrl/Cmd+V. Tabs delimit columns and line breaks delimit rows; quoted multiline cells are supported. Pasting beyond the last card adds new cards only when the table is **not sorted or filtered**. Paste ranges that extend beyond the final field are rejected without modifying the project. Each cell edit or multi-cell paste is undoable; the grid also has Undo and Redo controls.

Search all displayed fields, click a column heading to sort ascending/descending, and paginate through large sets. Sorting and filtering **never reorder staged cards**, so existing image-set sequences remain unchanged. Select the current page or every filtered card to copy rows, duplicate cards or delete cards in one operation. Bulk deletion asks for confirmation; duplicated cards retain their individual overrides. Open any row in the normal card editor for detailed layout changes. Save the project file to preserve all modifications.

**Export and printing:** The current-card PNG follows the selected front/back side. **Export all ZIP** exports fronts, while **Export backs ZIP** and **Export fronts and backs ZIP** offer separate outputs. Duplex print sheets render assigned back templates by default. Legacy individual back images take precedence, and legacy shared back images remain as fallbacks when a set has no back template. Spreadsheet exports create one worksheet per card set, with only fields from the templates assigned to that set; set membership is represented by the worksheet name. When multiple image sets contain the same filename, spreadsheet image values prefer the set assigned to their template; an explicit `Set Name/filename.png` can select another set.

## Professional print readiness (test branch)

Use **Check deck** in the desktop toolbar or **Check deck for print** in the mobile Export menu before generating card ZIPs for a professional print service. The check is non-destructive and covers every card's assigned front and back templates, including card-only changes. It reports missing or unreadable artwork, estimated effective image DPI below the template target, text that will be clipped, text outside the safe zone, visible-but-empty text, duplicate/blank card names, invalid guides, trim-only canvases without included bleed, and fonts or variants not embedded in the project. Missing artwork, severe image resolution problems, text clipping and invalid geometry are labelled errors; font portability, safe-zone placement, no bleed and moderate DPI shortfalls are warnings.

Findings can be searched and filtered; **Go to card** opens the relevant card and side for correction. **Download report CSV** exports the full findings list. The scanner reuses the same image assignment and text layout rules as the card renderer, caching image metadata for duplicate artwork. It does **not** automatically change or block exports. It cannot know a printer's required bleed, color profile, acceptable resolution, or which text fields are mandatory; check those against the chosen print service's specifications. No embedded font is needed by the printer when sending rasterized PNGs, but unembedded fonts may be substituted when reopening the project on a different device.

## Print sheets PDF (test branch)

Open **Print sheets PDF** from the desktop toolbar or mobile Export menu to create printable A4, Letter, or custom-size PDF sheets. Choose portrait/landscape paper, margins, card spacing, cut marks, 150/300 DPI, and edge-extension bleed. Select cards and quantities without duplicating staged cards. Assign reusable back templates to card sets or use legacy shared/individual back images; double-sided output alternates front/back pages and mirrors placement for long- or short-edge duplex printing. Preview the first front or back sheet before exporting.

Print at **actual size / 100%**, not fit-to-page. Edge-extension bleed repeats the outer edge pixels; it is not a substitute for artwork composed with a genuine bleed area. **Duplex calibration:** Choose long-edge or short-edge flipping, then export the two-page calibration PDF from Print sheets. It has two compact, numbered front-page scales (X and Y, in millimetres) and perpendicular back-page reference lines, with no card grid. Print it double-sided at actual size and hold it to the light with **FRONT** facing you. **Read the signed number where each back reference line crosses its scale and enter that number directly** into Back horizontal / vertical offset. These are absolute settings, not incremental corrections; the next calibration PDF automatically accounts for values already entered and for the selected duplex flip. Every half-millimetre is ticked and every 2 mm is numbered, from −20 to +20. Fronts never shift. Offsets move back artwork, bleed and crop marks together, appear in back previews, and are saved with the project. **Reset offsets** restores zero alignment. This initial PDF output embeds raster RGB JPEG sheets, not CMYK or vector elements. Print selections, quantities, backs and print settings are saved in project JSON. Printed card designs preserve the existing shared template and individual card overrides.

### Cloudflare Pages troubleshooting

A **Retry deployment** on a failed Pages deployment rebuilds that deployment's original commit, even if newer fixes exist on the branch. For the print-sheet feature, confirm that the deployment log's `HEAD is now at ...` points to the latest `feature/mobile-studio` commit, not the earlier `60c7dc5` build. New branch pushes should create new deployments when Git auto-deployments are enabled. The `build-info.json` file reports the commit and branch used in each successful deployment.

## Canvas, trim and safe-area guides (test branch)

When creating a project, choose whether the **canvas dimensions are the finished card size** or **the full artwork size including bleed**. The canvas edge is always the artwork boundary; there is no separate bleed-boundary line. If bleed is included, a red dashed **trim** boundary sits inside the canvas. A green dashed **safe-area** boundary marks where important text and symbols should remain. Both are editor-only and never appear in PNG or PDF artwork.

In **Template → Card Setup → Trim and safe area guides**, configure the bleed and safe inset for all sides together or each edge separately. Set independent **cut-line corner radius** and **safe-zone corner radius** in the same mm/in/px guide units. The canvas boundary is not a guide and has no radius setting. Rounded lines are editor-only and never crop artwork. Select **mm, inches or DPI-aware pixels**, independently of the canvas size unit. **Pixel dimensions are always displayed as whole numbers and explicitly edited pixel values snap to the nearest integer**, including canvas/cut/safe sizes, guide insets/radii and element dimensions. Millimetres and inches retain decimal precision. Measurements are stored in physical units so merely switching display units cannot move artwork. Toggle the guide overlay with **Guides (G)** in the desktop toolbar, the **G** keyboard shortcut, or the mobile Project menu. Display in Cards mode and dimming outside the safe area are separate options.

**Three editable, connected sizes:** In **Card Setup → Dimensions**, edit **Finished cut width/height**, **Canvas width/height**, or **Safe-zone width/height** in the canvas unit (mm/in/px). The cut size is the reference for the others:

- **Cut size edited** → canvas adjusts by the currently configured bleed; safe dimensions change by the current safety buffers.
- **Canvas size edited** → bleed recalculates, cut size remains unchanged; canvas cannot shrink below cut size. Opposing bleed edges share the difference, and the all-sides link unchecks automatically when necessary.
- **Bleed edited** → canvas expands/contracts, cut size remains unchanged.
- **Safety buffer edited** → safe dimensions update, cut size stays unchanged.
- **Safe-zone size edited** → safety buffers update, cut size stays unchanged; safe dimensions cannot exceed the cut size.
- Changing canvas bleed mode adds/removes configured bleed around the fixed cut size; changing no-bleed canvas dimensions automatically enables bleed when required.

All dimension calculations preserve the user's **element geometry**: changing canvas/trim/bleed/safe size never edits template element positions, card overrides or extra card elements. Users may need to arrange artwork relative to a newly positioned trim boundary, but nothing is silently moved or stretched. Older project files without guide metadata default to **canvas edge = trim**. The **New Project** dialog offers the same directly editable sizes and per-edge buffer controls.

**Export PNG** and **Export all ZIP** continue to use the complete canvas; the File menu and mobile Export menu now offer **Export trimmed PNG**, which removes included bleed and produces the finished-card dimensions at the selected DPI. Print-sheet PDFs place cards using the **finished trim size**, render artwork already in the canvas outside the trim edge, and align crop marks to that trim boundary. The old edge-extension bleed fallback remains available only when the canvas excludes bleed. Guides, sizing mode, distances and visibility are saved with the template/project; existing editor-only shape guides remain untouched.
