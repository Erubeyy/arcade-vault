// Motor de Asteroids portado de references/started-games/02-asteroids/game.js.
// Recibe un <canvas> y avisa a React por callbacks; no conoce React.

import {
  Asteroid,
  Bullet,
  H,
  Particle,
  POINTS,
  PowerUp,
  Ship,
  W,
  dist,
  rand,
  type Keys,
} from "./entities";
import type { GameCallbacks, GameEngine, GameStats } from "../engine";
import { Pen } from "./pen";
import {
  SKIN_NAMES,
  THEME_NAMES,
  THEMES,
  type AsteroidsSkin,
  type AsteroidsTheme,
} from "./skins";

export type { AsteroidsSkin, AsteroidsTheme };

export interface AsteroidsOptions {
  skin: AsteroidsSkin;
  theme: AsteroidsTheme;
}

const DEFAULTS: AsteroidsOptions = { skin: "classic", theme: "dark" };

type State = "playing" | "dead" | "gameover";

const POWERUP_CHANCE = 0.1; // probabilidad de que un asteroide destruido suelte un ítem
const TRIPLE_DURATION = 10; // segundos de disparo triple
const SHIELD_DURATION = 5; // segundos de escudo temporal
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "Space"]);

export class AsteroidsEngine implements GameEngine {
  private readonly pen: Pen;
  private readonly callbacks: GameCallbacks;
  private skin: AsteroidsSkin;
  private theme: AsteroidsTheme;

  private keys: Keys = {};
  private justPressed: Keys = {};

  private ship = new Ship();
  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];
  private particles: Particle[] = [];
  private powerUps: PowerUp[] = [];
  private powerUpsSpawned = { triple: false, shield: false };
  private tripleTimer = 0;
  private shieldTimer = 0;

  private score = 0;
  private lives = 3;
  private level = 1;
  private state: State = "playing";
  private deadTimer = 0;
  private gameOverEmitted = false;

  private rafId: number | null = null;
  private lastTime: number | null = null;
  private listening = false;
  private destroyed = false;
  private lastStats: GameStats | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
    options?: Partial<AsteroidsOptions>,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.callbacks = callbacks;
    // Opciones inválidas o ausentes caen en los valores por defecto.
    this.skin = SKIN_NAMES.includes(options?.skin as AsteroidsSkin)
      ? (options!.skin as AsteroidsSkin)
      : DEFAULTS.skin;
    this.theme = THEME_NAMES.includes(options?.theme as AsteroidsTheme)
      ? (options!.theme as AsteroidsTheme)
      : DEFAULTS.theme;
    this.pen = new Pen(ctx, THEMES[this.skin][this.theme]);
  }

  // ── Apariencia (solo dibujo; no afecta a la partida) ───────────────────────

  setSkin(skin: AsteroidsSkin) {
    if (!SKIN_NAMES.includes(skin)) return;
    this.skin = skin;
    this.applyLook();
  }

  setTheme(theme: AsteroidsTheme) {
    if (!THEME_NAMES.includes(theme)) return;
    this.theme = theme;
    this.applyLook();
  }

  private applyLook() {
    this.pen.t = THEMES[this.skin][this.theme];
    // Repinta ya, por si el bucle está detenido (pausa).
    if (!this.destroyed) this.draw();
  }

  // ── Ciclo de vida ───────────────────────────────────────────────────────────

  start() {
    if (this.destroyed) return;
    this.initGame();
    this.addListeners();
    this.startLoop();
  }

  pause() {
    this.stopLoop();
  }

  resume() {
    if (this.destroyed) return;
    this.justPressed = {};
    this.startLoop();
  }

  restart() {
    if (this.destroyed) return;
    this.justPressed = {};
    this.initGame();
    this.startLoop();
  }

  end() {
    if (this.destroyed || this.state === "gameover") return;
    this.state = "gameover";
    this.emitGameOver();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopLoop();
    this.removeListeners();
  }

  // ── Loop ────────────────────────────────────────────────────────────────────

  private startLoop() {
    if (this.rafId !== null) return;
    this.lastTime = null; // evita un salto de dt tras pausar
    this.rafId = requestAnimationFrame(this.loop);
  }

  private stopLoop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private loop = (ts: number) => {
    const dt =
      this.lastTime === null ? 0 : Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    this.update(dt);
    this.draw();
    this.emitStats();
    this.rafId = requestAnimationFrame(this.loop);
  };

  // ── Teclado ─────────────────────────────────────────────────────────────────

  private addListeners() {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private removeListeners() {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private static isTextTarget(e: KeyboardEvent) {
    const t = e.target;
    return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code) || AsteroidsEngine.isTextTarget(e)) return;
    e.preventDefault();
    if (!this.keys[e.code]) this.justPressed[e.code] = true;
    this.keys[e.code] = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return;
    if (!AsteroidsEngine.isTextTarget(e)) e.preventDefault();
    this.keys[e.code] = false;
  };

  private pressed(code: string) {
    const val = this.justPressed[code];
    this.justPressed[code] = false;
    return !!val;
  }

  // ── Estado del juego ────────────────────────────────────────────────────────

  private initGame() {
    this.ship = new Ship();
    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpsSpawned = { triple: false, shield: false };
    this.tripleTimer = 0;
    this.shieldTimer = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.state = "playing";
    this.gameOverEmitted = false;
    this.spawnAsteroids(4);
    this.emitStats(true);
  }

  private spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      this.asteroids.push(new Asteroid(x, y, 3));
    }
  }

  private nextLevel() {
    this.level++;
    this.bullets = [];
    this.particles = [];
    this.ship.reset();
    // Cada tipo de power-up puede volver a salir en el nuevo nivel.
    this.powerUpsSpawned = { triple: false, shield: false };
    this.spawnAsteroids(3 + this.level);
  }

  private explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y));
  }

  private killShip() {
    this.explode(this.ship.x, this.ship.y, 14);
    this.ship.dead = true;
    this.tripleTimer = 0;
    this.shieldTimer = 0;
    this.lives--;
    if (this.lives <= 0) {
      this.state = "gameover";
      this.emitStats();
      this.emitGameOver();
    } else {
      this.state = "dead";
      this.deadTimer = 2;
    }
  }

  // ── Callbacks hacia React ───────────────────────────────────────────────────

  private emitStats(force = false) {
    const { score, lives, level } = this;
    const last = this.lastStats;
    if (
      !force &&
      last &&
      last.score === score &&
      last.lives === lives &&
      last.level === level
    )
      return;
    this.lastStats = { score, lives, level };
    this.callbacks.onStats({ score, lives, level });
  }

  private emitGameOver() {
    if (this.gameOverEmitted) return;
    this.gameOverEmitted = true;
    this.callbacks.onGameOver(this.score);
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  private update(dt: number) {
    if (this.state === "gameover") {
      this.stepParticles(dt);
      return;
    }

    if (this.state === "dead") {
      this.deadTimer -= dt;
      this.stepParticles(dt);
      this.asteroids.forEach((a) => a.update(dt));
      this.powerUps.forEach((p) => p.update(dt));
      this.powerUps = this.powerUps.filter((p) => !p.dead);
      if (this.deadTimer <= 0) {
        this.state = "playing";
        this.ship.reset();
      }
      return;
    }

    // Disparar
    if (this.pressed("Space")) {
      this.bullets.push(...this.ship.tryShoot(this.tripleTimer > 0));
    }

    if (this.tripleTimer > 0) this.tripleTimer -= dt;
    if (this.shieldTimer > 0) this.shieldTimer -= dt;

    const { ship } = this;
    ship.update(dt, this.keys);
    this.bullets.forEach((b) => b.update(dt));
    this.asteroids.forEach((a) => a.update(dt));
    this.particles.forEach((p) => p.update(dt));

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => !p.dead);

    // Power-ups: movimiento y recogida
    for (const p of this.powerUps) {
      p.update(dt);
      if (dist(ship, p) < ship.radius + p.radius) {
        if (p.kind === "triple") this.tripleTimer = TRIPLE_DURATION;
        else this.shieldTimer = SHIELD_DURATION;
        p.dead = true;
      }
    }
    this.powerUps = this.powerUps.filter((p) => !p.dead);

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of this.bullets) {
      for (const a of this.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          this.score += POINTS[a.size];
          this.explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          // Un mismo asteroide suelta como máximo un ítem, y cada tipo sólo
          // puede aparecer una vez por nivel.
          if (!this.powerUpsSpawned.triple && Math.random() < POWERUP_CHANCE) {
            this.powerUps.push(new PowerUp(a.x, a.y, "triple"));
            this.powerUpsSpawned.triple = true;
          } else if (
            !this.powerUpsSpawned.shield &&
            Math.random() < POWERUP_CHANCE
          ) {
            this.powerUps.push(new PowerUp(a.x, a.y, "shield"));
            this.powerUpsSpawned.shield = true;
          }
        }
      }
    }
    this.asteroids = this.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    this.bullets = this.bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of this.asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          if (this.shieldTimer > 0) {
            // El escudo absorbe el impacto: se consume y da un respiro breve.
            this.shieldTimer = 0;
            ship.invincible = 1;
            this.explode(ship.x, ship.y, 10);
          } else {
            this.killShip();
          }
          break;
        }
      }
    }

    // Nivel completado
    if (this.state === "playing" && this.asteroids.length === 0)
      this.nextLevel();
  }

  private stepParticles(dt: number) {
    this.particles.forEach((p) => p.update(dt));
    this.particles = this.particles.filter((p) => !p.dead);
  }

  // ── Draw ────────────────────────────────────────────────────────────────────

  // El HUD de puntuación, vidas, nivel y GAME OVER vive en React. Aquí solo
  // quedan los contadores de power-ups.
  private drawPowerUpTimers() {
    const { pen } = this;
    let y = 26;
    if (this.tripleTimer > 0) {
      pen.text(`TRIPLE ${Math.ceil(this.tripleTimer)}s`, 14, y, pen.t.triple);
      y += 18;
    }
    if (this.shieldTimer > 0) {
      pen.text(`ESCUDO ${Math.ceil(this.shieldTimer)}s`, 14, y, pen.t.shield);
    }
  }

  private draw() {
    const { pen } = this;
    pen.clear(W, H);

    this.particles.forEach((p) => p.draw(pen));
    this.asteroids.forEach((a) => a.draw(pen));
    this.powerUps.forEach((p) => p.draw(pen));
    this.bullets.forEach((b) => b.draw(pen));
    this.ship.draw(pen, this.shieldTimer > 0);

    this.drawPowerUpTimers();
  }
}
