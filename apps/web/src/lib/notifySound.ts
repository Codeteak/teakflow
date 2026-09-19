const SOUND_URL = '/notificaiton-sound/notify-sound.wav';

let audioContext: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let loadPromise: Promise<AudioBuffer | null> | null = null;
let primed = false;
let pendingPlay = false;
let lastPlayedAt = 0;

function getContext() {
  if (typeof window === 'undefined') {
    return null;
  }
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }
  if (!audioContext) {
    audioContext = new AudioCtx();
  }
  return audioContext;
}

async function loadBuffer() {
  if (buffer) {
    return buffer;
  }
  if (loadPromise) {
    return loadPromise;
  }
  const ctx = getContext();
  if (!ctx) {
    return null;
  }
  loadPromise = fetch(SOUND_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Notify sound missing (${response.status})`);
      }
      return response.arrayBuffer();
    })
    .then((data) => ctx.decodeAudioData(data.slice(0)))
    .then((decoded) => {
      buffer = decoded;
      return decoded;
    })
    .catch(() => {
      loadPromise = null;
      return null;
    });
  return loadPromise;
}

async function resumeContext() {
  const ctx = getContext();
  if (!ctx) {
    return false;
  }
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  return ctx.state === 'running';
}

async function playNow() {
  const ctx = getContext();
  const decoded = await loadBuffer();
  if (!ctx || !decoded) {
    return false;
  }
  const ready = await resumeContext();
  if (!ready) {
    return false;
  }
  const source = ctx.createBufferSource();
  source.buffer = decoded;
  const gain = ctx.createGain();
  gain.gain.value = 0.9;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(0);
  return true;
}

function onUserGesture() {
  void (async () => {
    await resumeContext();
    await loadBuffer();
    if (pendingPlay) {
      pendingPlay = false;
      await playNow();
    }
  })();
}

/** Call once from the signed-in shell so the first click unlocks audio. */
export function primeNotifySound() {
  if (primed || typeof window === 'undefined') {
    return;
  }
  primed = true;
  void loadBuffer();
  window.addEventListener('pointerdown', onUserGesture, { passive: true });
  window.addEventListener('keydown', onUserGesture, { passive: true });
  window.addEventListener('touchstart', onUserGesture, { passive: true });
}

/** Play the shared notify sound (sync-deduped when message + notification fire together). */
export function playNotifySound() {
  if (typeof window === 'undefined') {
    return;
  }
  primeNotifySound();
  const now = Date.now();
  // Claim the play slot synchronously so concurrent socket events cannot race.
  if (now - lastPlayedAt < 800) {
    return;
  }
  lastPlayedAt = now;
  void (async () => {
    const played = await playNow();
    if (!played) {
      // Allow a retry after unlock; clear the claim so the next call can play.
      lastPlayedAt = 0;
      pendingPlay = true;
    }
  })();
}
