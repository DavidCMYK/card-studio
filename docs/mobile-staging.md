# Mobile test deployment (recommended: Cloudflare Pages)

This branch is isolated from the production Card Studio application. Do **not** merge `feature/mobile-studio` into `main` before approving the mobile editor.

## Recommended: Git-connected Cloudflare Pages test site

Card Studio is a static application. The legacy Cloudflare **Pages → Connect to Git** flow needs a build command and an output directory, **not a deploy command**.

1. Go to **Workers & Pages → Create application → Pages → Connect to Git** (legacy Pages option).
2. Select GitHub repository `DavidCMYK/card-studio`.
3. Create a **separate Pages project** named `card-studio-mobile-test` (or another unused name).
4. Select **Production branch:** `feature/mobile-studio`. If the setup flow does not expose this field, change it in the new **Pages project's Settings → Builds → Branch control** after creation. Do **not** alter the existing production Worker.
5. **Framework preset:** None.
6. **Build command:** `npm run build:pages`.
7. **Build output directory:** `public`.
8. **Root directory:** repository root (`/`).
9. Save/deploy. Pages automatically publishes the files in `public/` to the new project's `*.pages.dev` URL. There is no separate deploy command.

This test Pages project deploys pushes to its configured production branch automatically. It is independent of the current production Worker, `card-studio`.

Cloudflare reference: https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/

## Alternative: separate Cloudflare Worker

The repository retains `wrangler.test.jsonc` and `npm run deploy:test` for a future **Worker** deployment. If connecting Git to a Worker using **Workers Builds** (not Pages), the branch selector is documented under **Worker → Settings → Build → Branch control**, and the deploy command is:

```sh
npx wrangler deploy --config wrangler.test.jsonc
```

The build command is `npm run build:pages`. The Worker's name must match the Wrangler config: `card-studio-mobile-test`. Worker Builds requires its own account setup. It is **not needed** for our current static test environment.

Reference: https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/

## Validation

- GitHub workflow `Verify Card Studio build` compiles TypeScript, runs unit tests, and generates Pages assets in `public/`.
- `Verify Card Studio mobile browser` runs Chromium checks for desktop and phone interaction.
- On the test Pages URL, verify project load/save, Template/Cards modes, image sets, card overrides, resizing, pinch zoom, and image exports on phones and tablets.
- Compare exported PNGs with desktop for identical projects, fonts, and rendering settings.

## Future mobile packaging

`npm run build:mobile` produces `mobile-build/`, a self-contained mobile web-assets directory sharing the existing engine and renderer. It is suitable as future Capacitor `webDir` input. A manifest, offline behavior, Android/iOS packaging, and native file handling are still future work.

## Safety

- `main`, the current production Worker, and its `wrangler.jsonc` are untouched.
- No custom domain or route should be attached to the test project.
- A test Pages URL is distinct from `workers.dev`, and can be used without a separate Worker.

## Portable fonts and undo on mobile

Older projects save font family names only. To transfer exact fonts to a different device, first open the project on desktop and use File → Embed font files… or (where supported) Embed installed project fonts…, then save the JSON again. Only embed fonts you are licensed to bundle. The new project includes the font data, so a separate installation is unnecessary. Both desktop and mobile share session-only Undo/Redo, which is not serialized.


## Local recovery acceptance

Cloudflare Pages test uses the browser's IndexedDB on its own origin. A production domain or a separately installed app would have **different** local storage.

1. Open the test site on a desktop or phone, edit a card, then leave the page idle until the status reads **Backed up locally** (on mobile: Project menu).
2. Reload. The explicit **Recover unsaved changes?** dialog should offer **Restore changes**, **Download backup JSON**, and **Discard backup**.
3. Restore, verify the text/artwork/cards, and then use **Save project** to create a permanent file. A recovered browser draft does not have its old native file write handle.
4. Test discard as well: after deleting a recovery copy and reloading, the recovery prompt should not return.
5. If browser storage is blocked or full, local autosave shows a warning; saving/exporting project files should continue to work.

The backup does not migrate between desktop and phone and is not a cloud sync. The site retains the latest local recovery copy only. Browser site-data clearing destroys it. Full project files are the source of truth.
