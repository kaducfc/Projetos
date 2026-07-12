// Sprite-swap animation for the monster fighting area. This is a template:
// only Chispim (js/data/monsters.js BOSSES[0].anim) has real frames right
// now, so every other monster silently falls back to the plain static
// image/emoji this module already handled before animation existed. To
// animate another monster, give it the same `anim: { idle2, hit, death1,
// death2 }` shape and it picks this up automatically — nothing here is
// Chispim-specific.
//
// This module owns all writes to #monster-sprite's image content. render.js
// must call renderMonsterSprite() instead of touching the DOM directly, so
// a death sequence in progress can't be stomped by the next render tick.

const IDLE_FRAME_MS = 1300;
const HIT_FRAME_MS = 130;
const DEATH_FRAME_MS = 260;

let currentKey = null; // bossId/weakMonsterId of whichever monster is currently shown
let idleIntervalId = null;
let idleShowingFrame2 = false;
let hitTimeoutId = null;
let deathTimeoutIds = [];
let deathPlaying = false;

function spriteEl() {
  return document.getElementById('monster-sprite');
}

// Reuses the existing <img> when possible instead of replacing innerHTML,
// so the CSS "breathing" loop (see monster-breathe in style.css) keeps
// running uninterrupted across idle frame swaps instead of restarting —
// restarting it every ~1.3s on a fresh element would snap the animation
// back to its 0% pose each time instead of looping smoothly.
function setImage(src, alt) {
  const el = spriteEl();
  if (!el) return;
  const existing = el.querySelector('img');
  if (existing) {
    existing.src = src;
    existing.alt = alt || '';
  } else {
    el.innerHTML = `<img src="${src}" alt="${alt || ''}">`;
  }
}

function monsterKey(monster) {
  return monster.isBoss ? `boss:${monster.bossId}` : `weak:${monster.weakMonsterId}`;
}

function clearIdleLoop() {
  if (idleIntervalId != null) {
    clearInterval(idleIntervalId);
    idleIntervalId = null;
  }
}

function clearHitTimer() {
  if (hitTimeoutId != null) {
    clearTimeout(hitTimeoutId);
    hitTimeoutId = null;
  }
}

function clearDeathTimers() {
  deathTimeoutIds.forEach(clearTimeout);
  deathTimeoutIds = [];
}

function startIdleLoop(monster) {
  clearIdleLoop();
  idleShowingFrame2 = false;
  if (!monster.anim) return; // no frames to alternate between — static image stays put
  idleIntervalId = setInterval(() => {
    idleShowingFrame2 = !idleShowingFrame2;
    setImage(idleShowingFrame2 ? monster.anim.idle2 : monster.image, monster.name);
  }, IDLE_FRAME_MS);
}

/// Call on every render pass with whichever monster is currently fought.
/// No-ops while a death animation is mid-playback (see triggerDeathAnimation)
/// so the outgoing monster's death frames aren't overwritten by the next
/// tick's render before the sequence finishes.
export function renderMonsterSprite(monster) {
  if (deathPlaying) return;

  const key = monsterKey(monster);
  if (key === currentKey) return; // already showing this monster — idle loop (if any) runs on its own timer

  currentKey = key;
  clearHitTimer();
  clearIdleLoop();

  const el = spriteEl();
  if (!monster.image) {
    if (el) el.innerHTML = monster.emoji;
    return;
  }
  setImage(monster.image, monster.name);
  startIdleLoop(monster);
}

/// Brief flinch frame on click, alongside the existing CSS scale-pulse
/// (see pulseMonster() in render.js). No-ops for monsters without frames.
export function triggerHitFlash(monster) {
  if (deathPlaying || !monster.anim) return;
  clearHitTimer();
  setImage(monster.anim.hit, monster.name);
  hitTimeoutId = setTimeout(() => {
    hitTimeoutId = null;
    setImage(idleShowingFrame2 ? monster.anim.idle2 : monster.image, monster.name);
  }, HIT_FRAME_MS);
}

/// Plays death1 -> death2 on the just-killed monster before calling
/// onDone(), which is expected to advance game state's render to whatever
/// spawned next. Monsters without frames call onDone() immediately, so
/// nothing changes for the rest of the roster.
export function triggerDeathAnimation(monster, onDone) {
  if (!monster.anim) {
    onDone();
    return;
  }
  clearIdleLoop();
  clearHitTimer();
  clearDeathTimers();
  deathPlaying = true;
  currentKey = null; // force the next renderMonsterSprite() to treat the new monster as a fresh spawn

  const el = spriteEl();
  el?.classList.add('dying');
  setImage(monster.anim.death1, monster.name);
  deathTimeoutIds.push(setTimeout(() => {
    setImage(monster.anim.death2, monster.name);
  }, DEATH_FRAME_MS));
  deathTimeoutIds.push(setTimeout(() => {
    deathPlaying = false;
    el?.classList.remove('dying');
    onDone();
  }, DEATH_FRAME_MS * 2));
}
