# Sintra Surf Watch

A mobile-first live view of six beach cameras near Sintra. All six muted streams play together. Tap a camera for a portrait full-screen view and use its close button to return to the grid. Hold and drag a camera to rearrange the grid; its order is saved on that device. The initial order is Praia Grande North, Praia Grande South, Praia Pequena, Praia das Maçãs, Adraga, and Magoito.

The app opens with a full-screen welcome while all six camera streams start in the background. Its rotating loading message reports live progress from `[0/6]` to `[6/6]`, and a tap skips directly to the dashboard. The dashboard is fixed to the portrait phone viewport and does not scroll. Selecting a beach opens a viewer with live snapshot buttons for the other beaches, pinch zoom and one-finger panning on the selected video, and an optional landscape control that hides the other feeds while keeping zoom and pan available.

## Run locally

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. To test the production build, run `npm run build` followed by `npm run preview`.

## Deploy on Render Free

The included `render.yaml` configures a static site named `sintra-surf-watch-static`. Render cannot change an existing web service into a static site in place, so create this as a new service, verify its new URL, and then remove the old `sintra-surf-watch` web service. If configuring it manually, create a Static Site with build command `npm ci && npm run build` and publish directory `dist`.

The camera streams come directly from IOL's public HLS endpoints. If an upstream camera goes offline, its tile retries automatically.
