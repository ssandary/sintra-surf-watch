# Sintra Surf Watch

A mobile-first live view of six beach cameras near Sintra. All six muted streams play together. Tap a camera for a portrait full-screen view and use its close button to return to the grid. Hold and drag a camera to rearrange the grid; its order is saved on that device. The initial order is Praia Grande North, Praia Grande South, Praia Pequena, Praia das Maçãs, Adraga, and Magoito.

The app opens with a full-screen welcome while all six camera streams start in the background. Its rotating loading message reports live progress from `[0/6]` to `[6/6]`, and a tap skips directly to the dashboard. The dashboard is fixed to the phone viewport and does not scroll. Selecting a beach opens a portrait viewer with live snapshot buttons for the other beaches, pinch zoom on the selected video, and an optional landscape control that hides the other feeds.

The “watching now” counter shows the number of distinct browsers with this page currently visible. Multiple tabs in the same browser count once; reconnects and network interruptions can briefly change the number.

## Run locally

```sh
npm ci
npm run build
npm start
```

Open `http://localhost:10000/`. Set `PORT` to use a different local port. `npm run dev` runs the camera interface alone without the viewer counter.

## Deploy on Render Free

The included `render.yaml` configures one free Node web service. Connect this repository in Render and create a Blueprint from `render.yaml`, or create a Web Service using the Free plan with build command `npm ci && npm run build` and start command `npm start`.

The camera streams come directly from IOL's public HLS endpoints. If an upstream camera goes offline, its tile retries automatically.
