/**
 * NEON INVADERS - Core Game Logic
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreEl = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 40;
const INVADER_SIZE = 30;
const PROJECTILE_SPEED = 7;
const INVADER_SPEED_START = 1;
const INVADER_SPEED_INCREMENT = 0.2;

// Colors
const NEON_BLUE = '#00f2ff';
const NEON_PINK = '#ff00ff';
const NEON_PURPLE = '#bc13fe';

// Game State
let gameState = 'START';
let score = 0;
let lives = 3;
let player;
let projectiles = [];
let invaderProjectiles = [];
let invaders = [];
let particles = [];
let shields = [];
let keys = {};
let lastTime = 0;
let invaderDirection = 1;
let invaderStepDown = false;
let currentWave = 1;
let invaderMoveTimer = 0;

// Audio Context Setup
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(freq, type, duration, volume = 0.1) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Classes
class Entity {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        this.render();
        ctx.restore();
    }

    render() {
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    getRect() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
}

class Player extends Entity {
    constructor() {
        super(CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, CANVAS_HEIGHT - 60, PLAYER_SIZE, 20, NEON_BLUE);
        this.speed = 5;
        this.cooldown = 0;
    }

    render() {
        // Draw a stylized spaceship
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.closePath();
        ctx.fill();
        // Cockpit
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x + this.width / 2 - 2, this.y + 5, 4, 5);
    }

    update() {
        if (keys['ArrowLeft'] || keys['a']) this.x -= this.speed;
        if (keys['ArrowRight'] || keys['d']) this.x += this.speed;

        // Clamp to screen
        this.x = Math.max(0, Math.min(CANVAS_WIDTH - this.width, this.x));

        if (this.cooldown > 0) this.cooldown--;
        if (keys[' '] && this.cooldown === 0) {
            this.shoot();
            this.cooldown = 20;
        }
    }

    shoot() {
        projectiles.push(new Projectile(this.x + this.width / 2 - 2, this.y, -PROJECTILE_SPEED, NEON_BLUE));
        playSound(440, 'square', 0.1);
    }
}

class Invader extends Entity {
    constructor(x, y, type) {
        super(x, y, INVADER_SIZE, INVADER_SIZE, NEON_PINK);
        this.type = type;
    }

    render() {
        const p = 4; // padding
        ctx.fillRect(this.x + p, this.y + p, this.width - p * 2, this.height - p * 2);
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x + 8, this.y + 10, 4, 4);
        ctx.fillRect(this.x + this.width - 12, this.y + 10, 4, 4);
    }
}

class Projectile extends Entity {
    constructor(x, y, vy, color) {
        super(x, y, 4, 15, color);
        this.vy = vy;
    }

    update() {
        this.y += this.vy;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 3, 3);
        ctx.globalAlpha = 1.0;
    }
}

class Shield extends Entity {
    constructor(x, y) {
        super(x, y, 10, 10, NEON_PURPLE);
        this.health = 3;
    }
    
    render() {
        ctx.globalAlpha = this.health / 3;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.globalAlpha = 1.0;
    }
}

// Background Starfield
let stars = [];
function initStars() {
    stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1
        });
    }
}

function updateStars() {
    stars.forEach(star => {
        star.y += star.speed;
        if (star.y > CANVAS_HEIGHT) star.y = 0;
    });
}

function drawStars() {
    ctx.fillStyle = '#fff';
    stars.forEach(star => {
        ctx.fillRect(star.x, star.y, star.size, star.size);
    });
}

// Initialization Functions
function initGame() {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    player = new Player();
    projectiles = [];
    invaderProjectiles = [];
    particles = [];
    score = 0;
    lives = 3;
    currentWave = 1;
    createInvaders();
    createShields();
    initStars();
    updateHUD();
}

function createInvaders() {
    invaders = [];
    const rows = 5;
    const cols = 10;
    const spacing = 50;
    const offsetX = (CANVAS_WIDTH - (cols * spacing)) / 2;
    const offsetY = 80;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            invaders.push(new Invader(offsetX + c * spacing, offsetY + r * spacing, r % 3));
        }
    }
    invaderDirection = 1;
}

function createShields() {
    shields = [];
    const numShields = 4;
    const shieldWidth = 60;
    const spacing = CANVAS_WIDTH / (numShields + 1);
    
    for (let i = 0; i < numShields; i++) {
        const startX = spacing * (i + 1) - shieldWidth / 2;
        const startY = CANVAS_HEIGHT - 150;
        
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 8; col++) {
                // Round corners / cut out parts
                if ((row === 0 && (col === 0 || col === 7))) continue;
                shields.push(new Shield(startX + col * 10, startY + row * 10));
            }
        }
    }
}

function updateHUD() {
    scoreEl.innerText = score.toString().padStart(4, '0');
    livesEl.innerText = lives;
}

// Game Loop
function gameLoop(timestamp) {
    if (gameState !== 'PLAYING') return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    updateStars();
    drawStars();

    player.update();
    player.draw();

    // Invader Movement Logic
    let moveSpeed = INVADER_SPEED_START + (currentWave - 1) * INVADER_SPEED_INCREMENT;
    let hitEdge = false;
    
    invaderMoveTimer++;
    if (invaderMoveTimer > 2) { // Slow down movement logic for a bit of "retro" feel
        invaders.forEach(inv => {
            inv.x += invaderDirection * moveSpeed;
            if (inv.x + inv.width > CANVAS_WIDTH - 10 || inv.x < 10) {
                hitEdge = true;
            }
        });
        invaderMoveTimer = 0;
    }

    if (hitEdge) {
        invaderDirection *= -1;
        invaders.forEach(inv => {
            inv.y += 20;
            if (inv.y + inv.height > player.y) {
                endGame();
            }
        });
    }

    // Invader Shooting
    if (Math.random() < 0.01 + (currentWave * 0.005) && invaders.length > 0) {
        const randomInvader = invaders[Math.floor(Math.random() * invaders.length)];
        invaderProjectiles.push(new Projectile(randomInvader.x + randomInvader.width / 2, randomInvader.y + randomInvader.height, PROJECTILE_SPEED, NEON_PINK));
    }

    // Update Projectiles
    projectiles = projectiles.filter(p => {
        p.update();
        p.draw();
        
        // Collision with Invaders
        let hit = false;
        invaders = invaders.filter(inv => {
            if (checkCollision(p, inv)) {
                hit = true;
                score += 100;
                createExplosion(inv.x + inv.width / 2, inv.y + inv.height / 2, NEON_PINK);
                playSound(150, 'sawtooth', 0.1);
                return false;
            }
            return true;
        });

        // Collision with Shields
        shields = shields.filter(s => {
            if (checkCollision(p, s)) {
                hit = true;
                s.health--;
                return s.health > 0;
            }
            return true;
        });

        if (invaders.length === 0) {
            currentWave++;
            createInvaders();
        }

        updateHUD();
        return !hit && p.y > 0;
    });

    invaderProjectiles = invaderProjectiles.filter(p => {
        p.update();
        p.draw();

        // Collision with Player
        if (checkCollision(p, player)) {
            lives--;
            createExplosion(player.x + player.width / 2, player.y + player.height / 2, NEON_BLUE);
            playSound(50, 'sine', 0.5, 0.3);
            updateHUD();
            if (lives <= 0) endGame();
            return false;
        }

        // Collision with Shields
        let hitShield = false;
        shields = shields.filter(s => {
            if (checkCollision(p, s)) {
                hitShield = true;
                s.health--;
                return s.health > 0;
            }
            return true;
        });

        return !hitShield && p.y < CANVAS_HEIGHT;
    });

    // Update Particles
    particles = particles.filter(p => {
        p.update();
        p.draw();
        return p.life > 0;
    });

    // Draw Shields
    shields.forEach(s => s.draw());

    requestAnimationFrame(gameLoop);
}

function checkCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function endGame() {
    gameState = 'GAMEOVER';
    gameOverScreen.classList.remove('hidden');
    finalScoreEl.innerText = score;
}

// Input Handlers
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

startBtn.addEventListener('click', () => {
    initAudio();
    startScreen.classList.add('hidden');
    gameState = 'PLAYING';
    initGame();
    requestAnimationFrame(gameLoop);
});

restartBtn.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    gameState = 'PLAYING';
    initGame();
    requestAnimationFrame(gameLoop);
});

// Initial Setup
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
initStars();
// Draw a preview
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
drawStars();
