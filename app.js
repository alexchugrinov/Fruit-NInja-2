// ==================== CONFIGURATION ====================
const CONFIG = {
  GRAVITY: 0.35,
  BASE_SPAWN_INTERVAL: 750,
  MIN_SPAWN_INTERVAL: 350,
  BOMB_CHANCE: 0.15,
  GOLDEN_FRUIT_CHANCE: 0.08,
  TRAIL_MAX_LENGTH: 14,
  TRAIL_FADE_TIME: 250,
  COMBO_WINDOW: 1000,
  MAX_MISSED: 5,
  PARTICLE_COUNT: 12,
  PARTICLE_LIFE: 1,
  PARTICLE_DECAY: 0.02,
  SCREEN_SHAKE_DURATION: 500,
  SCREEN_SHAKE_INTENSITY: 10,
};

// Fruit types with points and colors
const FRUIT_TYPES = [
  { name: 'apple', points: 1, color: '#ef4444', radius: [28, 34] },
  { name: 'orange', points: 2, color: '#f97316', radius: [30, 36] },
  { name: 'lemon', points: 2, color: '#fbbf24', radius: [26, 32] },
  { name: 'lime', points: 1, color: '#22c55e', radius: [26, 32] },
  { name: 'grape', points: 3, color: '#a855f7', radius: [24, 30] },
  { name: 'berry', points: 3, color: '#ec4899', radius: [24, 30] },
  { name: 'watermelon', points: 5, color: '#dc2626', radius: [36, 42] },
];

const GOLDEN_FRUIT = {
  name: 'golden',
  points: 20,
  color: '#fbbf24',
  radius: [32, 38],
  glowColor: 'rgba(251, 191, 36, 0.6)',
};

// ==================== AUDIO SYSTEM ====================
class AudioController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playTone(freq, type, duration, vol = 0.3) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playSlice() {
    this.playTone(800, 'sine', 0.1, 0.2);
    setTimeout(() => this.playTone(1200, 'sine', 0.08, 0.15), 30);
  }

  playCombo(count) {
    const baseFreq = 400 + (Math.min(count, 5) - 1) * 150;
    this.playTone(baseFreq, 'square', 0.15, 0.2);
    setTimeout(() => this.playTone(baseFreq + 200, 'square', 0.15, 0.15), 80);
  }

  playGolden() {
    this.playTone(523, 'sine', 0.1, 0.3);
    setTimeout(() => this.playTone(659, 'sine', 0.1, 0.3), 100);
    setTimeout(() => this.playTone(784, 'sine', 0.2, 0.3), 200);
  }

  playExplosion() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    noise.start();
  }

  playMiss() {
    this.playTone(200, 'sawtooth', 0.2, 0.15);
  }

  playStart() {
    this.playTone(440, 'sine', 0.15, 0.3);
    setTimeout(() => this.playTone(554, 'sine', 0.15, 0.3), 150);
    setTimeout(() => this.playTone(659, 'sine', 0.2, 0.3), 300);
  }
}

// ==================== GAME CLASSES ====================
class GameObject {
  constructor(x, y, vx, vy, radius, type) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.type = type;
    this.rotation = Math.random() * Math.PI * 2;
    this.spin = (Math.random() - 0.5) * 0.1;
    this.sliced = false;
    this.markedForDeletion = false;
  }

  update(deltaTime) {
    this.vy += CONFIG.GRAVITY;
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.spin;
    
    if (this.y - this.radius > window.innerHeight + 100) {
      this.markedForDeletion = true;
    }
  }
}

class Fruit extends GameObject {
  constructor(x, y, vx, vy, fruitType, isGolden = false) {
    super(x, y, vx, vy, fruitType.radius[0] + Math.random() * (fruitType.radius[1] - fruitType.radius[0]), 'fruit');
    this.fruitType = fruitType;
    this.points = isGolden ? GOLDEN_FRUIT.points : fruitType.points;
    this.isGolden = isGolden;
    this.color = isGolden ? GOLDEN_FRUIT.color : fruitType.color;
    this.glowPhase = Math.random() * Math.PI * 2;
  }

  draw(ctx, time) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (this.isGolden) {
      // Glow effect
      this.glowPhase += 0.1;
      const glowIntensity = 0.4 + Math.sin(this.glowPhase) * 0.2;
      ctx.shadowColor = GOLDEN_FRUIT.glowColor;
      ctx.shadowBlur = 20 * glowIntensity;
    }

    // Main body - juicy gradient
    const gradient = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.1, 0, 0, this.radius);
    gradient.addColorStop(0, this.lightenColor(this.color, 30));
    gradient.addColorStop(0.5, this.color);
    gradient.addColorStop(1, this.darkenColor(this.color, 20));
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Juicy highlight (more pronounced)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-this.radius * 0.35, -this.radius * 0.35, this.radius * 0.3, this.radius * 0.2, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Secondary subtle highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(this.radius * 0.4, this.radius * 0.4, this.radius * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Stem
    if (!this.isGolden) {
      ctx.fillStyle = '#15803d';
      ctx.fillRect(-2, -this.radius - 4, 4, 6);
    } else {
      // Sparkles for golden fruit
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 3; i++) {
        const angle = (time / 200 + (i * 2)) % (Math.PI * 2);
        const dist = this.radius * 0.6;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
  
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }
  
  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }
}

class Bomb extends GameObject {
  constructor(x, y, vx, vy, radius) {
    super(x, y, vx, vy, radius, 'bomb');
    this.sparkPhase = 0;
  }

  draw(ctx, time) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Body
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(-this.radius * 0.35, -this.radius * 0.35, this.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Fuse
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.quadraticCurveTo(this.radius * 0.3, -this.radius * 1.4, this.radius * 0.5, -this.radius * 1.5);
    ctx.stroke();

    // Spark
    this.sparkPhase += 0.3;
    const sparkSize = 3 + Math.sin(this.sparkPhase) * 1.5;
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(this.radius * 0.55, -this.radius * 1.55, sparkSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

class Piece {
  constructor(x, y, vx, vy, radius, color, angle, rotation, spin, side) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.color = color;
    this.angle = angle;
    this.rotation = rotation;
    this.spin = spin;
    this.side = side;
    this.life = CONFIG.PARTICLE_LIFE;
  }

  update() {
    this.vy += CONFIG.GRAVITY;
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.spin;
    this.life -= CONFIG.PARTICLE_DECAY;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    const start = this.side > 0 ? -Math.PI / 2 : Math.PI / 2;
    ctx.arc(0, 0, this.radius, start, start + Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = Math.random() * 4 + 2;
    this.color = color;
    this.life = 1;
    this.decay = Math.random() * 0.02 + 0.015;
  }

  update() {
    this.vy += CONFIG.GRAVITY * 0.5;
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.life -= this.decay;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class FloatingText {
  constructor(x, y, text, color, size = '24px') {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.size = size;
    this.life = 1;
    this.vy = -2;
  }

  update() {
    this.y += this.vy;
    this.vy *= 0.95;
    this.life -= 0.015;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.font = `bold ${this.size} Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// ==================== GAME ENGINE ====================
class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new AudioController();
    
    // Game state
    this.state = 'MENU'; // MENU, PLAYING, PAUSED, GAMEOVER
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('fruitNinjaHighScore')) || 0;
    this.missed = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastSliceTime = 0;
    this.spawnInterval = CONFIG.BASE_SPAWN_INTERVAL;
    this.lastSpawnTime = 0;
    
    // Entities
    this.objects = [];
    this.particles = [];
    this.pieces = [];
    this.floatingTexts = [];
    
    // Input
    this.trail = [];
    this.isPointing = false;
    this.lastPointerPos = null;
    
    // Screen shake
    this.shakeTime = 0;
    this.shakeIntensity = 0;
    
    // Timing
    this.lastTime = 0;
    this.deltaTime = 0;
    
    this.resize();
    this.bindEvents();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    
    // Pointer events
    this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('pointerup', () => this.handlePointerUp());
    this.canvas.addEventListener('pointercancel', () => this.handlePointerUp());
    
    // UI buttons
    document.getElementById('startBtn').addEventListener('click', () => this.startGame());
    document.getElementById('playAgain').addEventListener('click', () => this.startGame());
    document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
    document.getElementById('resumeBtn').addEventListener('click', () => this.togglePause());
    document.getElementById('quitBtn').addEventListener('click', () => this.quitGame());
    
    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') {
        if (this.state === 'PLAYING' || this.state === 'PAUSED') {
          this.togglePause();
        }
      }
    });
  }

  handlePointerDown(e) {
    this.isPointing = true;
    this.trail = [];
    this.lastPointerPos = { x: e.clientX, y: e.clientY };
    this.addTrailPoint(e.clientX, e.clientY);
    
    if (this.state === 'MENU' || this.state === 'GAMEOVER') {
      // Let buttons handle clicks
      return;
    }
  }

  handlePointerMove(e) {
    if (!this.isPointing) return;
    
    const pos = { x: e.clientX, y: e.clientY };
    this.addTrailPoint(pos.x, pos.y);
    
    if (this.state === 'PLAYING' && this.lastPointerPos) {
      this.checkSlicing(this.lastPointerPos, pos);
    }
    
    this.lastPointerPos = pos;
  }

  handlePointerUp() {
    this.isPointing = false;
    this.trail = [];
    this.lastPointerPos = null;
  }

  addTrailPoint(x, y) {
    this.trail.push({ x, y, time: Date.now() });
    if (this.trail.length > CONFIG.TRAIL_MAX_LENGTH) {
      this.trail.shift();
    }
  }

  checkSlicing(from, to) {
    const now = Date.now();
    
    // Check collision with all objects
    for (const obj of this.objects) {
      if (obj.sliced) continue;
      
      // Check if line segment intersects circle
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      
      // Closest point on line to circle center
      const t = Math.max(0, Math.min(1, 
        ((obj.x - from.x) * dx + (obj.y - from.y) * dy) / (len * len)
      ));
      
      const closestX = from.x + t * dx;
      const closestY = from.y + t * dy;
      
      const distX = obj.x - closestX;
      const distY = obj.y - closestY;
      const dist = Math.sqrt(distX * distX + distY * distY);
      
      if (dist < obj.radius) {
        // Hit!
        if (obj.type === 'bomb') {
          this.hitBomb(obj);
        } else if (obj.type === 'fruit') {
          this.sliceFruit(obj, from, to);
        }
      }
    }
  }

  sliceFruit(fruit, from, to) {
    fruit.sliced = true;
    fruit.markedForDeletion = true;
    
    // Combo system
    const now = Date.now();
    if (now - this.lastSliceTime < CONFIG.COMBO_WINDOW) {
      this.combo++;
      if (this.combo > 1) {
        this.audio.playCombo(this.combo);
        this.showFloatingText(fruit.x, fruit.y - 30, `x${this.combo} COMBO!`, '#fbbf24', '28px');
      }
    } else {
      this.combo = 1;
    }
    this.lastSliceTime = now;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    
    // Score with combo multiplier
    const multiplier = 1 + Math.floor((this.combo - 1) / 3) * 0.5;
    const points = Math.floor(fruit.points * multiplier);
    this.score += points;
    
    // Audio
    if (fruit.isGolden) {
      this.audio.playGolden();
      this.showFloatingText(fruit.x, fruit.y - 50, `GOLDEN! +${points}`, '#fbbf24', '32px');
    } else {
      this.audio.playSlice();
      this.showFloatingText(fruit.x, fruit.y - 30, `+${points}`, '#fff');
    }
    
    // Create pieces
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const speed = 3;
    const vx1 = Math.cos(angle - Math.PI/2) * speed;
    const vy1 = Math.sin(angle - Math.PI/2) * speed;
    const vx2 = Math.cos(angle + Math.PI/2) * speed;
    const vy2 = Math.sin(angle + Math.PI/2) * speed;
    
    this.pieces.push(new Piece(fruit.x, fruit.y, vx1, vy1, fruit.radius, fruit.color, angle, fruit.rotation, fruit.spin * 0.8, 1));
    this.pieces.push(new Piece(fruit.x, fruit.y, vx2, vy2, fruit.radius, fruit.color, angle, fruit.rotation, fruit.spin * 0.8, -1));
    
    // Particles
    for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
      this.particles.push(new Particle(fruit.x, fruit.y, fruit.color));
    }
    
    this.updateUI();
  }

  hitBomb(bomb) {
    this.audio.playExplosion();
    bomb.markedForDeletion = true;
    
    // Screen shake
    this.shakeTime = CONFIG.SCREEN_SHAKE_DURATION;
    this.shakeIntensity = CONFIG.SCREEN_SHAKE_INTENSITY;
    
    // Explosion particles
    for (let i = 0; i < 30; i++) {
      this.particles.push(new Particle(bomb.x, bomb.y, '#fbbf24'));
      this.particles.push(new Particle(bomb.x, bomb.y, '#ef4444'));
      this.particles.push(new Particle(bomb.x, bomb.y, '#1f2937'));
    }
    
    this.gameOver('You hit a bomb!');
  }

  missFruit() {
    this.missed++;
    this.audio.playMiss();
    this.updateUI();
    
    if (this.missed >= CONFIG.MAX_MISSED) {
      this.gameOver('Too many fruits dropped!');
    }
  }

  showFloatingText(x, y, text, color, size) {
    this.floatingTexts.push(new FloatingText(x, y, text, color, size));
  }

  spawnObject() {
    const x = Math.random() * (this.canvas.width - 100) + 50;
    const y = this.canvas.height + 50;
    
    // Random velocity towards center - INCREASED for higher arcs
    const targetX = this.canvas.width / 2 + (Math.random() - 0.5) * 200;
    const vx = (targetX - x) * 0.018; // Slightly more horizontal spread
    const vy = -(Math.random() * 5 + 14); // Higher vertical velocity (was 11, now 14-19)
    
    const radius = Math.random() * 6 + 28;
    
    // Decide what to spawn
    const rand = Math.random();
    
    if (rand < CONFIG.GOLDEN_FRUIT_CHANCE) {
      // Golden fruit
      const fruitType = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
      this.objects.push(new Fruit(x, y, vx, vy, fruitType, true));
    } else if (rand < CONFIG.GOLDEN_FRUIT_CHANCE + CONFIG.BOMB_CHANCE) {
      // Bomb
      this.objects.push(new Bomb(x, y, vx, vy, radius));
    } else {
      // Regular fruit
      const fruitType = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
      this.objects.push(new Fruit(x, y, vx, vy, fruitType, false));
    }
  }

  updateUI() {
    document.getElementById('score').textContent = this.score;
    document.getElementById('highScore').textContent = `Best: ${this.highScore}`;
    document.getElementById('missedCount').textContent = `${this.missed}/${CONFIG.MAX_MISSED}`;
    
    const comboContainer = document.getElementById('comboContainer');
    if (this.combo > 1) {
      comboContainer.classList.remove('hidden');
      document.getElementById('comboMultiplier').textContent = `x${1 + Math.floor((this.combo - 1) / 3) * 0.5}`;
      document.getElementById('comboCount').textContent = `Combo: ${this.combo}`;
    } else {
      comboContainer.classList.add('hidden');
    }
  }

  startGame() {
    this.audio.init();
    this.audio.playStart();
    
    this.state = 'PLAYING';
    this.score = 0;
    this.missed = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.spawnInterval = CONFIG.BASE_SPAWN_INTERVAL;
    this.objects = [];
    this.particles = [];
    this.pieces = [];
    this.floatingTexts = [];
    this.trail = [];
    
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameover').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    
    this.updateUI();
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      document.getElementById('pauseScreen').classList.remove('hidden');
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      document.getElementById('pauseScreen').classList.add('hidden');
    }
  }

  quitGame() {
    this.state = 'MENU';
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
  }

  gameOver(reason) {
    this.state = 'GAMEOVER';
    
    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('fruitNinjaHighScore', this.highScore.toString());
    }
    
    document.getElementById('gameOverReason').textContent = reason;
    document.getElementById('finalScore').textContent = this.score;
    document.getElementById('finalHighScore').textContent = this.highScore;
    document.getElementById('maxCombo').textContent = this.maxCombo;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('gameover').classList.remove('hidden');
  }

  update(deltaTime) {
    if (this.state !== 'PLAYING') return;
    
    const now = Date.now();
    
    // Spawn objects
    if (now - this.lastSpawnTime > this.spawnInterval) {
      this.spawnObject();
      this.lastSpawnTime = now;
      
      // Increase difficulty
      const progress = Math.min(this.score / 20, 1);
      this.spawnInterval = CONFIG.BASE_SPAWN_INTERVAL - (CONFIG.BASE_SPAWN_INTERVAL - CONFIG.MIN_SPAWN_INTERVAL) * progress;
    }
    
    // Update objects
    for (const obj of this.objects) {
      obj.update(deltaTime);
      
      // Check if fruit fell
      if (obj.markedForDeletion && obj.type === 'fruit' && !obj.sliced) {
        if (obj.y - obj.radius > this.canvas.height + 50) {
          this.missFruit();
        }
      }
    }
    
    // Remove deleted objects
    this.objects = this.objects.filter(obj => !obj.markedForDeletion);
    
    // Update pieces
    for (const piece of this.pieces) {
      piece.update();
    }
    this.pieces = this.pieces.filter(p => p.life > 0);
    
    // Update particles
    for (const particle of this.particles) {
      particle.update();
    }
    this.particles = this.particles.filter(p => p.life > 0);
    
    // Update floating texts
    for (const text of this.floatingTexts) {
      text.update();
    }
    this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);
    
    // Update trail
    this.trail = this.trail.filter(point => now - point.time < CONFIG.TRAIL_FADE_TIME);
    
    // Update screen shake
    if (this.shakeTime > 0) {
      this.shakeTime -= deltaTime;
      if (this.shakeTime <= 0) {
        this.shakeIntensity = 0;
      }
    }
  }

  draw(time) {
    // Clear canvas
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Apply screen shake
    this.ctx.save();
    if (this.shakeIntensity > 0) {
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      this.ctx.translate(dx, dy);
    }
    
    // Draw pieces
    for (const piece of this.pieces) {
      piece.draw(this.ctx);
    }
    
    // Draw objects
    for (const obj of this.objects) {
      obj.draw(this.ctx, time);
    }
    
    // Draw particles
    for (const particle of this.particles) {
      particle.draw(this.ctx);
    }
    
    // Draw trail
    if (this.trail.length > 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        this.ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.lineWidth = 6;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
      this.ctx.shadowBlur = 10;
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }
    
    // Draw floating texts
    for (const text of this.floatingTexts) {
      text.draw(this.ctx);
    }
    
    this.ctx.restore();
  }

  loop(timestamp) {
    this.deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;
    
    this.update(this.deltaTime);
    this.draw(timestamp);
    
    requestAnimationFrame(this.loop);
  }
}

// ==================== INITIALIZATION ====================
window.addEventListener('load', () => {
  new Game();
});
