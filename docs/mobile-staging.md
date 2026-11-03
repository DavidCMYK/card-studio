# Mobile development and isolated Cloudflare test Worker

## Safety rules

- Keep `main` and the live `wrangler.jsonc` configuration unchanged until the mobile experience is approved.
- Development branch: `feature/mobile-studio`.
- Live Worker (existing): `card-studio`. Test Worker (new): `card-studio-mobile-test`.
- The test Worker has its own `workers.dev` URL, not the production domain or route.
- Deploy the test with `wrangler.test.jsonc`. Never use bare `wrangler deploy` on this branch.
- Merge feature changes into `main` only after tests and hands-on checks.

## Connect a Cloudflare Worker to this branch

1. In Cloudflare **Workers & Pages**, create a separate Worker using the GitHub repository `DavidCMYK/card-studio`. Name it **card-studio-mobile-test** (matching `wrangler.test.jsonc`).
2. In the Worker's **Settings → Build → Branch control**, set the production branch for *this test Worker* to **feature/mobile-studio**. This is separate from the real live Worker, which remains connected to `main`.
3. Set its **Build command** to `npm run build:pages`.
4. Set its **Deploy command** to `npx wrangler deploy --config wrangler.test.jsonc`.
5. Ensure **workers.dev** is enabled and no production-domain routes or custom domains are attached. Deploy and use the URL shown in the Cloudflare dashboard.
6. Verify both desktop and mobile, then approve a separate merge/promotion to the live branch.

Cloudflare may initially default to the GitHub repository's `main` branch. Explicitly change the test Worker's branch **before** enabling automatic deployments.

## Manual local test deployment

After authenticating Wrangler to the intended Cloudflare account:

```sh
npm install
npm run deploy:test
```

This runs the tests, builds the static assets into `public/`, and deploys only `card-studio-mobile-test`.

## Test checklist

- Existing desktop workflows, opened projects, image assignment and exports work as before.
- Small touch phone: editing, selection, pinch/zoom, canvas navigation, image handling, panels and saving.
- Tablet: portrait and landscape; no lost edits on orientation change.
- Exported card images have the same pixels as desktop for equivalent project content and fonts.
- Opening the same JSON project in desktop/mobile preserves cards, template geometry and effects.

## App packaging path

Once mobile interaction tests are complete, add a separate mobile web-assets build for Capacitor and a web app manifest. Packaging should consume the same shared document model, renderer and actions; it must not become a fork of the editing implementation.

## Prepare installable mobile assets later

Run `npm run build:mobile` to generate `mobile-build/`, a self-contained web-assets directory whose entrypoint forces the touch interface. It shares the exact project schema and rendering code with the normal adaptive website. This output can later be supplied as the Capacitor `webDir` without forking Card Studio's editor; Android/iOS wrappers, app identity, native file handling and installation graphics remain separate future work.
