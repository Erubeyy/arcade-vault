// Entidades de Asteroids portadas de references/started-games/02-asteroids/game.js.
// Sin dependencia de document ni window: el contexto 2D y el estado de teclas
// llegan como argumentos. El dibujo pasa por `Pen`, que aplica el skin activo.

import type { Pen, Point } from "./pen";

export const W = 800;
export const H = 600;

export type Keys = Record<string, boolean>;
export type Vertex = [number, number];

// ── Utilidades ────────────────────────────────────────────────────────────────

export const wrap = (v: number, max: number) => ((v % max) + max) % max;
export const dist = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.hypot(a.x - b.x, a.y - b.y);
export const rand = (min: number, max: number) =>
  min + Math.random() * (max - min);
export const randInt = (min: number, max: number) =>
  Math.floor(rand(min, max + 1));

// ── Constantes ────────────────────────────────────────────────────────────────

export const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
export const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
export const POINTS = [0, 100, 50, 20]; // puntos por tamaño

// Formas fijas (contorno normalizado, como fracción del radio) para asteroides
// grandes. Se eligen al azar junto con la generación procedural habitual.
export const LARGE_ASTEROID_SHAPES: Vertex[][] = [
  [
    [-0.111, -0.911],
    [0.399, -0.783],
    [0.345, -0.213],
    [0.855, -0.025],
    [0.687, 0.526],
    [0.231, 0.512],
    [0.009, 0.881],
    [-0.648, 0.552],
    [-0.943, 0.029],
    [-0.823, -0.568],
  ],
];

export type PowerUpKind = "triple" | "shield";

// Rota y traslada puntos locales a coordenadas de mundo.
const place = (pts: Point[], x: number, y: number, a: number): Point[] => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map(([px, py]) => [x + px * c - py * s, y + px * s + py * c]);
};

// ── Bullet ────────────────────────────────────────────────────────────────────

export class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;

  constructor(x: number, y: number, angle: number) {
    const SPEED = 520;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(pen: Pen) {
    pen.dot(this.x, this.y, this.radius, pen.t.bullet);
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────

export class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: Vertex[];

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Asteroides grandes: la mitad de las veces usan una de las formas fijas.
    if (size === 3 && Math.random() < 0.5) {
      const shape =
        LARGE_ASTEROID_SHAPES[randInt(0, LARGE_ASTEROID_SHAPES.length - 1)];
      this.verts = shape.map(([dx, dy]) => [
        dx * this.radius,
        dy * this.radius,
      ]);
    } else {
      // Polígono irregular
      const n = randInt(8, 13);
      this.verts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(pen: Pen) {
    pen.poly(place(this.verts, this.x, this.y, this.rot), pen.t.asteroid);
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────

export class Ship {
  x = W / 2;
  y = H / 2;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  dead = false;

  constructor() {
    this.reset();
  }

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keys: Keys) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;

    if (keys["ArrowLeft"]) this.angle -= ROT * dt;
    if (keys["ArrowRight"]) this.angle += ROT * dt;

    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(tripleActive: boolean): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (tripleActive) {
      const SPREAD = 0.2;
      return [
        new Bullet(ox, oy, this.angle - SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(pen: Pen, shieldActive: boolean) {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    // Silueta clásica: nariz, ala izquierda, muesca trasera, ala derecha
    const hull: Point[] = [
      [20, 0],
      [-12, -9],
      [-7, 0],
      [-12, 9],
    ];
    pen.poly(place(hull, this.x, this.y, this.angle), pen.t.ship);

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      const flame: Point[] = [
        [-8, -4],
        [-8 - rand(6, 14), 0],
        [-8, 4],
      ];
      pen.poly(place(flame, this.x, this.y, this.angle), pen.t.thrust, false);
    }

    // Anillo del escudo (no rota con la nave)
    if (shieldActive) pen.ring(this.x, this.y, this.radius + 6, pen.t.shield);
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(pen: Pen) {
    const alpha = this.ttl / this.life;
    // En retro no hay transparencias: la chispa se ve entera y se apaga antes.
    if (pen.t.pixel > 0 && alpha < 0.3) return;
    pen.line(
      this.x,
      this.y,
      this.x - this.vx * 0.05,
      this.y - this.vy * 0.05,
      pen.t.particle,
      alpha,
    );
  }
}

// ── Power-ups ─────────────────────────────────────────────────────────────────
// Ítems recolectables que sueltan los asteroides al ser destruidos.

export class PowerUp {
  x: number;
  y: number;
  kind: PowerUpKind;
  vx: number;
  vy: number;
  radius = 10;
  life = 8;
  ttl = 8;
  dead = false;

  constructor(x: number, y: number, kind: PowerUpKind) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    const angle = rand(0, Math.PI * 2);
    const speed = 30;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(pen: Pen) {
    // Parpadeo cuando quedan menos de 2 s
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;

    const { x, y, radius: r } = this;
    const color = this.kind === "triple" ? pen.t.triple : pen.t.shield;
    pen.ring(x, y, r, color);

    if (this.kind === "triple") {
      // Tres rayitas en abanico
      for (const a of [-0.3, 0, 0.3]) {
        pen.line(
          x,
          y,
          x + Math.cos(a) * r * 0.7,
          y + Math.sin(a) * r * 0.7 - r * 0.3,
          color,
        );
      }
    } else {
      // Ícono de escudo
      const icon: Point[] = [
        [0, -r * 0.6],
        [r * 0.5, -r * 0.25],
        [r * 0.5, r * 0.2],
        [0, r * 0.6],
        [-r * 0.5, r * 0.2],
        [-r * 0.5, -r * 0.25],
      ];
      pen.poly(place(icon, x, y, 0), color);
    }
  }
}
