const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const gameOverEl = document.getElementById('gameover');
const finalScoreEl = document.getElementById('finalScore');
const playAgainBtn = document.getElementById('playAgain');

const FRUIT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#a855f7', '#ec4899'];
const GRAVITY = 0.35;
const SPAWN_INTERVAL_MS = 750;
const BOMB_CHANCE = 0.15;
const TRAIL_MAX = 14;

let width = 0;
let height = 0;
let objects = [];
let pieces = [];
let trail = [];
let pointerDown = false;
let score = 0;
let running = true;
let lastSpawn = 0;
let lastFrame = performance.now();

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function spawn() {
  const isBomb = Math.random() < BOMB_CHANCE;
  const radius = isBomb ? 28 : rand(28, 38);
  const x = rand(width * 0.15, width * 0.85);
  const y = height + radius;
  // Aim roughly toward upper portion of the screen so it arcs back.
  const targetX = rand(width * 0.2, width * 0.8);
  const vx = (targetX - x) / 60;
  const vy = -rand(13, 16);
  objects.push({
    x, y, vx, vy, radius,
    type: isBomb ? 'bomb' : 'fruit',
    color: isBomb ? '#1f2937' : FRUIT_COLORS[Math.floor(Math.random() * FRUIT_COLORS.length)],
    rotation: rand(0, Math.PI * 2),
    spin: rand(-0.05, 0.05),
    sliced: false,
  });
}

function distPointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const ex = px - ax, ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx, ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

function trySlice() {
  if (trail.length < 2) return;
  const a = trail[trail.length - 2];
  const b = trail[trail.length - 1];
  for (const obj of objects) {
    if (obj.sliced) continue;
    if (distPointToSegment(obj.x, obj.y, a.x, a.y, b.x, b.y) <= obj.radius) {
      obj.sliced = true;
      if (obj.type === 'bomb') {
        endGame();
        return;
      }
      score++;
      scoreEl.textContent = score;
      spawnPieces(obj);
    }
  }
}

function spawnPieces(obj) {
  const baseAngle = Math.atan2(
    trail.length >= 2 ? trail[trail.length - 1].y - trail[trail.length - 2].y : 0,
    trail.length >= 2 ? trail[trail.length - 1].x - trail[trail.length - 2].x : 1
  );
  const perp = baseAngle + Math.PI / 2;
  const speed = 4;
  for (const sign of [-1, 1]) {
    pieces.push({
      x: obj.x,
      y: obj.y,
      vx: obj.vx + Math.cos(perp) * speed * sign,
      vy: obj.vy + Math.sin(perp) * speed * sign - 2,
      radius: obj.radius,
      color: obj.color,
      angle: baseAngle,
      rotation: obj.rotation,
      spin: obj.spin + 0.1 * sign,
      side: sign,
      life: 1,
    });
  }
}

function endGame() {
  running = false;
  finalScoreEl.textContent = score;
  gameOverEl.classList.remove('hidden');
}

function reset() {
  objects = [];
  pieces = [];
  trail = [];
  score = 0;
  scoreEl.textContent = '0';
  lastSpawn = 0;
  running = true;
  gameOverEl.classList.add('hidden');
  lastFrame = performance.now();
}

function update(now) {
  if (!running) return;

  if (now - lastSpawn > SPAWN_INTERVAL_MS) {
    spawn();
    lastSpawn = now;
  }

  for (const obj of objects) {
    obj.vy += GRAVITY;
    obj.x += obj.vx;
    obj.y += obj.vy;
    obj.rotation += obj.spin;
  }

  for (const p of pieces) {
    p.vy += GRAVITY;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.spin;
    p.life -= 0.02;
  }

  // Cull
  objects = objects.filter(o => !o.sliced && o.y - o.radius < height + 100);
  pieces = pieces.filter(p => p.life > 0 && p.y - p.radius < height + 100);

  // Fade trail naturally based on time so it disappears even if pointer stops.
  if (trail.length > 0) {
    const cutoff = now - 250;
    trail = trail.filter(p => p.t > cutoff);
  }
}

function drawObject(obj) {
  ctx.save();
  ctx.translate(obj.x, obj.y);
  ctx.rotate(obj.rotation);
  if (obj.type === 'bomb') {
    // body
    ctx.fillStyle = obj.color;
    ctx.beginPath();
    ctx.arc(0, 0, obj.radius, 0, Math.PI * 2);
    ctx.fill();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(-obj.radius * 0.35, -obj.radius * 0.35, obj.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // fuse
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -obj.radius);
    ctx.quadraticCurveTo(obj.radius * 0.3, -obj.radius * 1.4, obj.radius * 0.5, -obj.radius * 1.5);
    ctx.stroke();
    // spark
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(obj.radius * 0.55, -obj.radius * 1.55, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = obj.color;
    ctx.beginPath();
    ctx.arc(0, 0, obj.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(-obj.radius * 0.35, -obj.radius * 0.35, obj.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // little stem
    ctx.fillStyle = '#15803d';
    ctx.fillRect(-2, -obj.radius - 4, 4, 6);
  }
  ctx.restore();
}

function drawPiece(p) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, p.life);
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  // Half circle on the side this piece flew to.
  const start = p.side > 0 ? -Math.PI / 2 : Math.PI / 2;
  const end = start + Math.PI;
  ctx.arc(0, 0, p.radius, start, end);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTrail(now) {
  if (trail.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#e2e8f0';
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    const age = (now - b.t) / 250;
    const alpha = Math.max(0, 1 - age);
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2 + alpha * 6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function render(now) {
  ctx.clearRect(0, 0, width, height);
  for (const p of pieces) drawPiece(p);
  for (const obj of objects) drawObject(obj);
  drawTrail(now);
}

function loop(now) {
  update(now);
  render(now);
  lastFrame = now;
  requestAnimationFrame(loop);
}

// --- Input ---
function pointerPos(e) {
  return { x: e.clientX, y: e.clientY, t: performance.now() };
}

canvas.addEventListener('pointerdown', (e) => {
  if (!running) return;
  pointerDown = true;
  trail = [pointerPos(e)];
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointerDown || !running) return;
  trail.push(pointerPos(e));
  if (trail.length > TRAIL_MAX) trail.shift();
  trySlice();
});

const stop = (e) => {
  pointerDown = false;
  if (e && e.pointerId !== undefined && canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
};
canvas.addEventListener('pointerup', stop);
canvas.addEventListener('pointercancel', stop);
canvas.addEventListener('pointerleave', stop);

playAgainBtn.addEventListener('click', reset);

window.addEventListener('resize', resize);

// --- Boot ---
resize();
requestAnimationFrame(loop);
