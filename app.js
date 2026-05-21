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

    // Main body
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.25, 0, Math.PI * 2);
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
