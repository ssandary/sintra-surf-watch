import Hls from 'hls.js';
import './style.css';

document.title = 'Sintra Surf Watch';

const cameras = [
  { id: 'praiagrande', name: 'Praia Grande North', url: 'https://video-auth1.iol.pt/beachcam/praiagrande/playlist.m3u8' },
  { id: 'praiagrande2', name: 'Praia Grande South', url: 'https://video-auth1.iol.pt/beachcam/praiagrande2/playlist.m3u8' },
  { id: 'bcpraiapequena', name: 'Praia Pequena', url: 'https://video-auth1.iol.pt/beachcam/bcpraiapequena/playlist.m3u8' },
  { id: 'praiadasmacas', name: 'Praia das Maçãs', url: 'https://video-auth1.iol.pt/beachcam/praiadasmacas/playlist.m3u8' },
  { id: 'bcadraga', name: 'Adraga', url: 'https://video-auth1.iol.pt/beachcam/bcadraga/playlist.m3u8' },
  { id: 'bcmagoito', name: 'Magoito', url: 'https://video-auth1.iol.pt/beachcam/bcmagoito/playlist.m3u8' },
];

const orderKey = 'sintra-surf-watch-camera-order';
function orderedCameras() {
  try {
    const saved = JSON.parse(localStorage.getItem(orderKey));
    if (Array.isArray(saved) && saved.length === cameras.length
      && new Set(saved).size === cameras.length && saved.every((id) => cameras.some((camera) => camera.id === id))) {
      return saved.map((id) => cameras.find((camera) => camera.id === id));
    }
  } catch { /* Use the default order if storage is unavailable. */ }
  return cameras;
}

const app = document.querySelector('#app');
app.innerHTML = `
  <section class="splash" aria-label="Loading Sintra Surf Watch">
    <div class="splash-center">
      <span class="splash-logo" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none"><path d="M8 34c8-12 16-12 26 0s18 12 28 0M8 48c8-12 16-12 26 0s18 12 28 0" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>
      </span>
      <p>Intercepting available webcam streams<span class="loading-dots" aria-hidden="true">…</span></p>
      <span class="splash-progress"><i></i><i></i><i></i></span>
    </div>
    <p class="splash-signoff">You’re welcome, Samy</p>
  </section>
  <main class="shell" aria-hidden="true">
    <header class="topbar">
      <div class="brand">
        <span class="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none"><path d="M3 18c4-6 8-6 13 0s9 6 13 0M3 25c4-6 8-6 13 0s9 6 13 0" stroke="currentColor" stroke-width="2.7" stroke-linecap="round"/></svg>
        </span>
        <h1>Sintra Surf Watch</h1>
      </div>
    </header>
    <div class="grid" aria-label="Live beach cameras"></div>
    <p class="hint">Tap to expand. Hold and drag to rearrange.</p>
    <footer class="audience">
      <svg class="eye-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/></svg>
      <strong class="viewer-count" aria-live="polite">—</strong><span>watching now</span>
    </footer>
  </main>
  <section class="viewer" aria-hidden="true">
    <div class="viewer-media"></div>
    <div class="viewer-gradient" aria-hidden="true"></div>
    <header class="viewer-header">
      <div>
        <span class="viewer-live"><i></i> Live</span>
        <h2 class="viewer-name"></h2>
      </div>
      <div class="viewer-actions">
        <button class="orientation-button" type="button" aria-label="Switch to landscape view">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="m8 3-2 2 2 2M16 21l2-2-2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="viewer-close" type="button" aria-label="Close full-screen camera">×</button>
      </div>
    </header>
    <nav class="beach-switcher" aria-label="Switch beach camera"></nav>
  </section>
`;

const grid = app.querySelector('.grid');
const shell = app.querySelector('.shell');
const splash = app.querySelector('.splash');
const viewer = app.querySelector('.viewer');
const viewerMedia = app.querySelector('.viewer-media');
const switcher = app.querySelector('.beach-switcher');
let expandedCard = null;
let expandedPlaceholder = null;
let thumbnailTimer = null;
let landscapeMode = false;
const players = [];
const suppressedClicks = new WeakSet();
const readyPlayers = new Set();
const splashStarted = performance.now();
let splashDismissScheduled = false;

function dismissSplash() {
  if (splashDismissScheduled || splash.classList.contains('leaving')) return;
  splashDismissScheduled = true;
  const wait = Math.max(0, 1700 - (performance.now() - splashStarted));
  window.setTimeout(() => {
    splash.classList.add('leaving');
    shell.removeAttribute('aria-hidden');
    window.setTimeout(() => { splash.hidden = true; }, 700);
  }, wait);
}

window.setTimeout(dismissSplash, 12000);

function saveCameraOrder() {
  try {
    localStorage.setItem(orderKey, JSON.stringify([...grid.querySelectorAll('.camera-card')].map((card) => card.dataset.id)));
  } catch { /* The current order still works for this visit. */ }
}

function watchViewerCount() {
  const count = app.querySelector('.viewer-count');
  let viewerId;
  try {
    viewerId = localStorage.getItem('sintra-surf-watch-viewer');
    if (!viewerId || !/^[a-f0-9-]{36}$/.test(viewerId)) {
      viewerId = crypto.randomUUID();
      localStorage.setItem('sintra-surf-watch-viewer', viewerId);
    }
  } catch {
    viewerId = crypto.randomUUID();
  }

  let socket = null;
  let retryTimer = null;
  let heartbeatTimer = null;
  let retryDelay = 1000;

  function connect() {
    if (document.hidden || socket) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${location.host}/presence`);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'join', viewerId }));
      retryDelay = 1000;
      heartbeatTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send('{"type":"heartbeat"}');
      }, 30000);
    });
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'viewers' && Number.isSafeInteger(message.count) && message.count >= 0) {
          count.textContent = String(message.count);
        }
      } catch { /* Ignore unexpected messages. */ }
    });
    socket.addEventListener('error', () => socket?.close());
    socket.addEventListener('close', () => {
      window.clearInterval(heartbeatTimer);
      socket = null;
      count.textContent = '—';
      if (!document.hidden) {
        retryTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 15000);
      }
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.clearTimeout(retryTimer);
      socket?.close();
      count.textContent = '—';
    } else {
      connect();
    }
  });
  window.addEventListener('pagehide', () => socket?.close());
  connect();
}

function setStatus(card, state, message) {
  card.dataset.state = state;
  card.querySelector('.status-text').textContent = message;
}

function attemptPlay(video, card) {
  const result = video.play();
  if (result?.catch) {
    result.catch((error) => {
      if (error.name === 'NotAllowedError') setStatus(card, 'paused', 'Tap to play');
    });
  }
}

function createPlayer(camera) {
  const card = document.createElement('article');
  card.className = 'camera-card';
  card.dataset.id = camera.id;
  card.dataset.state = 'loading';
  card.innerHTML = `
    <video autoplay muted playsinline webkit-playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video>
    <div class="shade" aria-hidden="true"></div>
    <button class="camera-action" type="button">
      <span class="camera-top"><span class="status"><span class="status-dot"></span><span class="status-text">Connecting</span></span><span class="expand-icon" aria-hidden="true">↗</span><span class="close-icon" aria-hidden="true">×</span></span>
      <span class="camera-name"></span>
    </button>
  `;
  card.querySelector('.camera-name').textContent = camera.name;
  const action = card.querySelector('.camera-action');
  action.setAttribute('aria-label', `Expand ${camera.name} camera`);
  action.setAttribute('aria-keyshortcuts', 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown');
  const video = card.querySelector('video');
  grid.append(card);

  const player = { card, video, hls: null, retryTimer: null, camera };
  players.push(player);

  video.addEventListener('playing', () => {
    setStatus(card, 'live', 'Live');
    readyPlayers.add(camera.id);
    if (readyPlayers.size === cameras.length) dismissSplash();
  });
  video.addEventListener('waiting', () => {
    if (card.dataset.state !== 'error') setStatus(card, 'loading', 'Connecting');
  });
  video.addEventListener('canplay', () => attemptPlay(video, card));
  video.addEventListener('error', () => scheduleRetry(player));

  action.addEventListener('click', () => {
    if (suppressedClicks.has(card)) {
      suppressedClicks.delete(card);
      return;
    }
    if (expandedCard === card) {
      closeExpanded();
    } else {
      expand(card);
      players.forEach(({ video: itemVideo, card: itemCard }) => attemptPlay(itemVideo, itemCard));
    }
  });

  action.addEventListener('keydown', (event) => {
    if (!event.altKey || expandedCard) return;
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
    if (!step) return;
    event.preventDefault();
    const cards = [...grid.querySelectorAll('.camera-card')];
    const current = cards.indexOf(card);
    const destination = Math.max(0, Math.min(cards.length - 1, current + step));
    if (destination === current) return;
    grid.insertBefore(card, destination > current ? cards[destination].nextSibling : cards[destination]);
    saveCameraOrder();
    action.focus();
  });

  startPlayer(player);
}

function startPlayer(player) {
  const { card, video, camera } = player;
  clearTimeout(player.retryTimer);
  player.retryTimer = null;
  player.hls?.destroy();
  player.hls = null;
  video.removeAttribute('src');
  video.load();
  setStatus(card, 'loading', 'Connecting');

  // iPhone and iPad use their built-in HLS player. Other browsers use hls.js.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const nativeHls = Boolean(video.canPlayType('application/vnd.apple.mpegurl'));

  if (isIOS && nativeHls) {
    video.src = camera.url;
    attemptPlay(video, card);
  } else if (Hls.isSupported()) {
    const hls = new Hls({
      capLevelToPlayerSize: true,
      maxBufferLength: 10,
      backBufferLength: 4,
      lowLatencyMode: true,
    });
    player.hls = hls;
    hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(camera.url));
    hls.on(Hls.Events.MANIFEST_PARSED, () => attemptPlay(video, card));
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) scheduleRetry(player);
    });
    hls.attachMedia(video);
  } else if (nativeHls) {
    video.src = camera.url;
    attemptPlay(video, card);
  } else {
    setStatus(card, 'error', 'Browser cannot play stream');
  }
}

function scheduleRetry(player) {
  if (player.retryTimer) return;
  setStatus(player.card, 'error', 'Retrying stream');
  player.retryTimer = window.setTimeout(() => startPlayer(player), 8000);
}

function updateThumbnails() {
  for (const button of switcher.querySelectorAll('.beach-thumb')) {
    const player = players.find(({ camera }) => camera.id === button.dataset.id);
    const canvas = button.querySelector('canvas');
    if (!player || player.video.readyState < 2 || !canvas) continue;
    try {
      const context = canvas.getContext('2d');
      context.drawImage(player.video, 0, 0, canvas.width, canvas.height);
    } catch { /* A live label remains if the browser blocks video snapshots. */ }
  }
}

function buildSwitcher() {
  switcher.replaceChildren();
  for (const player of players) {
    const button = document.createElement('button');
    button.className = 'beach-thumb';
    button.type = 'button';
    button.dataset.id = player.camera.id;
    button.innerHTML = '<canvas width="180" height="110" aria-hidden="true"></canvas><span></span>';
    button.querySelector('span').textContent = player.camera.name.replace('Praia Grande ', 'P. Grande ');
    button.setAttribute('aria-label', `View ${player.camera.name}`);
    button.addEventListener('click', () => switchExpanded(player.card));
    switcher.append(button);
  }
  updateThumbnails();
}

function placeInViewer(card) {
  expandedCard = card;
  expandedPlaceholder = document.createComment(`camera-${card.dataset.id}`);
  card.replaceWith(expandedPlaceholder);
  card.classList.add('expanded');
  viewerMedia.append(card);
  viewer.querySelector('.viewer-name').textContent = card.querySelector('.camera-name').textContent;
  for (const button of switcher.querySelectorAll('.beach-thumb')) {
    button.classList.toggle('active', button.dataset.id === card.dataset.id);
    button.setAttribute('aria-current', button.dataset.id === card.dataset.id ? 'true' : 'false');
  }
}

function restoreExpandedCard() {
  if (!expandedCard || !expandedPlaceholder) return;
  const card = expandedCard;
  card.classList.remove('expanded');
  card.querySelector('.camera-action').setAttribute('aria-label', `Expand ${card.querySelector('.camera-name').textContent} camera`);
  expandedPlaceholder.replaceWith(card);
  expandedCard = null;
  expandedPlaceholder = null;
}

function expand(card) {
  if (expandedCard) switchExpanded(card);
  else {
    buildSwitcher();
    placeInViewer(card);
    viewer.classList.add('open');
    viewer.removeAttribute('aria-hidden');
    document.body.classList.add('viewing-camera');
    thumbnailTimer = window.setInterval(updateThumbnails, 2000);
    if (app.requestFullscreen && !document.fullscreenElement) {
      app.requestFullscreen({ navigationUI: 'hide' }).then(() => {
        screen.orientation?.lock?.('portrait-primary').catch(() => {});
      }).catch(() => {});
    }
  }
}

function switchExpanded(card) {
  if (!expandedCard || card === expandedCard) return;
  restoreExpandedCard();
  placeInViewer(card);
  attemptPlay(card.querySelector('video'), card);
  updateThumbnails();
}

function setLandscape(enabled) {
  landscapeMode = enabled;
  viewer.classList.toggle('landscape-mode', enabled);
  const button = viewer.querySelector('.orientation-button');
  button.setAttribute('aria-label', enabled ? 'Switch to portrait view' : 'Switch to landscape view');
  if (document.fullscreenElement && screen.orientation?.lock) {
    screen.orientation.lock(enabled ? 'landscape' : 'portrait-primary').catch(() => {});
  }
}

function closeExpanded() {
  if (!expandedCard) return;
  restoreExpandedCard();
  window.clearInterval(thumbnailTimer);
  thumbnailTimer = null;
  setLandscape(false);
  viewer.classList.remove('open');
  viewer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('viewing-camera');
  screen.orientation?.unlock?.();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

function enableReordering() {
  let pending = null;
  let dragging = null;

  function clearPending() {
    if (pending) window.clearTimeout(pending.timer);
    pending = null;
  }

  function beginDrag() {
    if (!pending || expandedCard) return;
    const { card, x, y } = pending;
    const rect = card.getBoundingClientRect();
    const placeholder = document.createElement('div');
    placeholder.className = 'drag-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    card.before(placeholder);
    card.classList.add('is-dragging');
    card.style.left = `${rect.left}px`;
    card.style.top = `${rect.top}px`;
    card.style.width = `${rect.width}px`;
    card.style.height = `${rect.height}px`;
    dragging = { card, placeholder, offsetX: x - rect.left, offsetY: y - rect.top };
  }

  function moveDrag(x, y) {
    const { card, placeholder, offsetX, offsetY } = dragging;
    card.style.left = `${x - offsetX}px`;
    card.style.top = `${y - offsetY}px`;

    const target = document.elementFromPoint(x, y)?.closest('.camera-card');
    if (!target || target === card || !grid.contains(target)) return;
    const items = [...grid.children].filter((item) => item !== card);
    const movingForward = items.indexOf(target) > items.indexOf(placeholder);
    grid.insertBefore(placeholder, movingForward ? target.nextSibling : target);
  }

  function finishDrag() {
    if (dragging) {
      const { card, placeholder } = dragging;
      grid.insertBefore(card, placeholder);
      placeholder.remove();
      card.classList.remove('is-dragging');
      for (const property of ['left', 'top', 'width', 'height']) card.style.removeProperty(property);
      saveCameraOrder();
      suppressedClicks.add(card);
      window.setTimeout(() => suppressedClicks.delete(card), 600);
      dragging = null;
    }
    clearPending();
  }

  grid.addEventListener('pointerdown', (event) => {
    if (pending || expandedCard || event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return;
    const action = event.target.closest('.camera-action');
    if (!action || !grid.contains(action)) return;
    const card = action.closest('.camera-card');
    pending = { card, pointerId: event.pointerId, x: event.clientX, y: event.clientY, timer: null };
    pending.timer = window.setTimeout(beginDrag, 400);
  });

  window.addEventListener('pointermove', (event) => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    if (dragging) {
      event.preventDefault();
      moveDrag(event.clientX, event.clientY);
    } else if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 9) {
      clearPending();
    }
  }, { passive: false });

  for (const eventName of ['pointerup', 'pointercancel']) {
    window.addEventListener(eventName, (event) => {
      if (pending && event.pointerId === pending.pointerId) finishDrag();
    });
  }
  window.addEventListener('blur', finishDrag);

  grid.addEventListener('touchstart', (event) => {
    if (pending || expandedCard || event.touches.length !== 1) return;
    const action = event.target.closest('.camera-action');
    if (!action || !grid.contains(action)) return;
    const touch = event.touches[0];
    pending = { card: action.closest('.camera-card'), touchId: touch.identifier, x: touch.clientX, y: touch.clientY, timer: null };
    pending.timer = window.setTimeout(beginDrag, 400);
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!pending || pending.touchId === undefined) return;
    const touch = [...event.touches].find((item) => item.identifier === pending.touchId);
    if (!touch) return;
    if (dragging) {
      event.preventDefault();
      moveDrag(touch.clientX, touch.clientY);
    } else if (Math.hypot(touch.clientX - pending.x, touch.clientY - pending.y) > 9) {
      clearPending();
    }
  }, { passive: false });

  for (const eventName of ['touchend', 'touchcancel']) {
    window.addEventListener(eventName, (event) => {
      if (pending?.touchId !== undefined
        && [...event.changedTouches].some((touch) => touch.identifier === pending.touchId)) finishDrag();
    });
  }
  grid.addEventListener('contextmenu', (event) => {
    if (event.target.closest('.camera-action')) event.preventDefault();
  });
}

viewer.querySelector('.viewer-close').addEventListener('click', closeExpanded);
viewer.querySelector('.orientation-button').addEventListener('click', () => setLandscape(!landscapeMode));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeExpanded();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) players.forEach(({ video, card }) => attemptPlay(video, card));
});

orderedCameras().forEach(createPlayer);
enableReordering();
watchViewerCount();
