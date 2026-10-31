# Card Studio

A standalone, browser-based editor for laying out game cards and preparing card sets for image export.

## Getting started

1. Download this repository or clone it.
2. Open `index.html` in Chrome or Edge on your desktop.
3. Build a card template, import your artwork and create a spreadsheet with the card fields.
4. Fill out the spreadsheet and import it to stage individual cards.
5. Review or adjust each card, then export PNG images.

No build step or installation is required. The editor is packaged as a single HTML file.

## Features

- Custom-sized card templates (millimetres, inches or pixels).
- Move, resize, layer and delete text boxes, image frames and shapes.
- Fonts and text styling, fills and gradients, borders and opacity controls.
- Image frame sizing modes and bulk image sets with automatic assignment.
- Spreadsheet (XLSX) export/import with columns named after template fields.
- Per-card previews and overrides without changing the underlying template.
- PNG card export (including ZIP export for batches).
- Save and reopen projects and reusable templates.

## Data and privacy

The editor works locally in your browser. Save your project file to retain work across sessions; do not assume browser state alone is permanent.

## Third-party code

The HTML file embeds JSZip 3.10.1 (dual-licensed MIT / GPLv3) for ZIP functionality; see the licensing notice in `index.html` and the [JSZip project](https://github.com/Stuk/jszip).

## Repository status

Initial browser-based version. Review output dimensions, typography and exported card files before production printing.
