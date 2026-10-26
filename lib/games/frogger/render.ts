// Dibujo de Frogger por skin. Solo pinta: no toca posiciones, colisiones ni reglas.
// Recibe del motor una escena ya resuelta (coordenadas en píxeles del canvas lógico);
// retro ajusta esas coordenadas a su rejilla de 4 px solo al dibujar.

import {
  CELL,
  GOALS,
  GOAL_WIDTH,
  H,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_SAFE_MID,
  ROW_START,
  W,
  type EntityKind,
} from "./board";
import type { FroggerSkin, ThemeTokens } from "./skins";

// "blink" = fotograma apagado del aviso de inmersión de las tortugas.
export type EntityLook = "full" | "blink" | "under";

export interface SceneEntity {
  kind: EntityKind;
  x: number; // borde izquierdo en px
  y: number; // borde superior de la fila en px
  cells: number; // ancho en celdas
  dir: 1 | -1;
  row: number;
  look: EntityLook;
}

export interface SceneFrog {
  cx: number;
  cy: number;
  scale: number; // > 1 en mitad del salto
  angle: number; // 0 = mira arriba
  leaping: boolean;
}

export interface Scene {
  entities: SceneEntity[];
  goals: readonly boolean[];
  frog: SceneFrog;
  timeRatio: number; // 0..1
}

const PX = 4; // píxel retro
const snap = (v: number) => Math.round(v / PX) * PX;

// Sprites retro de 8×8 «píxeles», mirando hacia arriba. El contorno no va en el
// dibujo: lo añade `sprite()` como halo de 1 píxel.
// g = cuerpo, d = patas y manchas, e = ojo, p = pupila.
const FROG_SPRITE = [
  "dpe..epd",
  "deeggeed",
  ".gggggg.",
  ".ggddgg.",
  ".gggggg.",
  "dggggggd",
  "dd.gg.dd",
  "........",
];
const FROG_LEAP_SPRITE = [
  "dpe..epd",
  ".eeggee.",
  ".gggggg.",
  ".ggddgg.",
  ".gggggg.",
  ".gggggg.",
  "..g..g..",
  "dd....dd",
];
// s = caparazón, l = dibujo del caparazón, cabeza y patas.
const TURTLE_SPRITE = [
  "...ll...",
  "l.ssss.l",
  ".ssllss.",
  ".slssls.",
  ".slssls.",
  ".ssllss.",
  "l.ssss.l",
  "...ll...",
];
// r = onda de la tortuga sumergida.
const RIPPLE_SPRITE = [
  "........",
  "..r..r..",
  ".r....r.",
  "........",
  "........",
  ".r....r.",
  "..r..r..",
  "........",
];

// Cuartos de vuelta en sentido horario a partir del ángulo de la rana.
const quarterTurns = (angle: number) =>
  (((Math.round(angle / (Math.PI / 2)) % 4) + 4) % 4) as 0 | 1 | 2 | 3;

export class Renderer {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    public skin: FroggerSkin,
    public t: ThemeTokens,
  ) {}

  draw(scene: Scene) {
    const { ctx } = this;
    ctx.imageSmoothingEnabled = this.skin !== "retro";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.clearRect(0, 0, W, H);
    this.background();
    this.goals(scene.goals);
    for (const e of scene.entities) this.entity(e);
    const f = scene.frog;
    this.frog(f.cx, f.cy, f.scale, f.angle, f.leaping);
    this.timeBar(scene.timeRatio);
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  // Glow del neón con el color dado (no-op en los demás skins).
  private glow(color: string) {
    const { ctx, t } = this;
    ctx.shadowBlur = t.glow;
    ctx.shadowColor = t.glow > 0 ? color : "transparent";
  }

  private noGlow() {
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = "transparent";
  }

  private rect(color: string, x: number, y: number, w: number, h: number) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  // Sprite retro 8×8 en (ox, oy), girado `rot` cuartos de vuelta. Con `outline`,
  // cada píxel lleva antes un halo de 1 píxel de ese color.
  private sprite(
    grid: string[],
    ox: number,
    oy: number,
    palette: Record<string, string>,
    rot: 0 | 1 | 2 | 3 = 0,
    outline: string | null = null,
  ) {
    const n = grid.length;
    const at = (c: number, r: number): [number, number] =>
      rot === 0
        ? [c, r]
        : rot === 1
          ? [n - 1 - r, c]
          : rot === 2
            ? [n - 1 - c, n - 1 - r]
            : [r, n - 1 - c];
    for (const pass of outline ? [0, 1] : [1]) {
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const color = palette[grid[r][c]];
          if (!color) continue;
          const [dc, dr] = at(c, r);
          const x = ox + dc * PX;
          const y = oy + dr * PX;
          if (pass === 0) this.rect(outline!, x - PX, y - PX, PX * 3, PX * 3);
          else this.rect(color, x, y, PX, PX);
        }
      }
    }
  }

  // ── Fondo ──────────────────────────────────────────────────────────────────

  private background() {
    const { ctx, t } = this;
    const zone = (r0: number, r1: number, color: string) =>
      this.rect(color, 0, r0 * CELL, W, (r1 - r0 + 1) * CELL);
    zone(ROW_GOALS, ROW_GOALS, t.wall);
    zone(ROW_RIVER_TOP, ROW_RIVER_BOT, t.water);
    zone(ROW_SAFE_MID, ROW_SAFE_MID, t.grass);
    zone(ROW_ROAD_TOP, ROW_ROAD_BOT, t.road);
    zone(ROW_START, ROW_START, t.grass);

    if (this.skin === "retro") {
      // Olas y líneas de carril como trazos de píxel duros.
      for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOT; r++) {
        for (let x = (r * 12) % 40; x < W; x += 40) {
          this.rect(t.waterLine, x, r * CELL + 16, 12, PX);
          this.rect(t.waterLine, x + 12, r * CELL + 20, 8, PX);
        }
      }
      for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
        for (let x = 4; x < W; x += 32) {
          this.rect(t.roadLine, x, r * CELL - 2, 16, PX);
        }
      }
      return;
    }

    // Olas sutiles en el río.
    ctx.strokeStyle = t.waterLine;
    ctx.lineWidth = 1;
    for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOT; r++) {
      const y = r * CELL + CELL / 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const yy = y + Math.sin((x + r * 17) / 11) * 3;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // Líneas discontinuas entre carriles de carretera.
    ctx.strokeStyle = t.roadLine;
    ctx.lineWidth = this.skin === "neon" ? 2 : 1;
    ctx.setLineDash([14, 14]);
    for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(W, r * CELL);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private goals(occupied: readonly boolean[]) {
    const { ctx, t } = this;
    GOALS.forEach((g, i) => {
      const x = g * CELL;
      const w = GOAL_WIDTH * CELL;
      if (this.skin === "retro") {
        this.rect(t.goalBorder, x + PX, PX, w - PX * 2, CELL - PX * 2);
        this.rect(t.goal, x + PX * 2, PX * 2, w - PX * 4, CELL - PX * 4);
      } else {
        this.rect(t.goal, x + 2, 2, w - 4, CELL - 4);
        ctx.strokeStyle = t.goalBorder;
        ctx.lineWidth = 2;
        this.glow(t.goalBorder);
        ctx.strokeRect(x + 3, 3, w - 6, CELL - 6);
        this.noGlow();
      }
      if (occupied[i]) this.frog(x + w / 2, CELL / 2, 1, 0, false);
    });
  }

  // ── Entidades ──────────────────────────────────────────────────────────────

  private entity(e: SceneEntity) {
    if (this.skin === "retro") return this.retroEntity(e);
    const { ctx } = this;
    const w = e.cells * CELL;
    switch (e.kind) {
      case "log":
        this.log(e.x, e.y, w, e.cells);
        break;
      case "turtle":
        ctx.globalAlpha = e.look === "blink" ? 0.45 : 1;
        this.turtles(e);
        ctx.globalAlpha = 1;
        break;
      case "car":
        this.car(e, w);
        break;
      case "truck":
        this.truck(e, w);
        break;
    }
  }

  private log(x: number, y: number, w: number, cells: number) {
    const { ctx, t } = this;
    const neon = this.skin === "neon";
    ctx.beginPath();
    ctx.roundRect(x, y + 6, w, CELL - 12, 10);
    if (neon) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = t.log;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = t.log;
      ctx.lineWidth = 2.5;
      this.glow(t.log);
      ctx.stroke();
      this.noGlow();
    } else {
      ctx.fillStyle = t.log;
      ctx.fill();
    }
    ctx.strokeStyle = t.logLine;
    ctx.lineWidth = neon ? 1.5 : 2;
    for (let k = 1; k < cells * 2; k++) {
      const lx = x + (k * w) / (cells * 2);
      ctx.beginPath();
      ctx.moveTo(lx, y + 11);
      ctx.lineTo(lx + 4, y + CELL - 11);
      ctx.stroke();
    }
  }

  private turtles(e: SceneEntity) {
    const { ctx, t } = this;
    const neon = this.skin === "neon";
    for (let k = 0; k < e.cells; k++) {
      const cx = e.x + k * CELL + CELL / 2;
      const cy = e.y + CELL / 2;
      if (e.look === "under") {
        // Sumergida: solo la onda, sin glow (no sirve de apoyo).
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.strokeStyle = t.ripple;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      ctx.beginPath();
      ctx.arc(cx, cy, neon ? 15 : 16, 0, Math.PI * 2);
      if (neon) {
        const a = ctx.globalAlpha;
        ctx.globalAlpha = a * 0.2;
        ctx.fillStyle = t.shell;
        ctx.fill();
        ctx.globalAlpha = a;
        ctx.strokeStyle = t.shell;
        ctx.lineWidth = 2.5;
        this.glow(t.shell);
        ctx.stroke();
        this.noGlow();
      } else {
        ctx.fillStyle = t.shell;
        ctx.fill();
      }
      ctx.strokeStyle = t.shellLine;
      ctx.lineWidth = neon ? 1.5 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.moveTo(cx - 16, cy);
      ctx.lineTo(cx - 9, cy);
      ctx.moveTo(cx + 9, cy);
      ctx.lineTo(cx + 16, cy);
      ctx.moveTo(cx, cy - 16);
      ctx.lineTo(cx, cy - 9);
      ctx.moveTo(cx, cy + 9);
      ctx.lineTo(cx, cy + 16);
      ctx.stroke();
    }
  }

  // Carrocería: plana en clásico; tinte + trazo con glow en neón.
  private body(
    color: string,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (this.skin === "neon") {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      this.glow(color);
      ctx.stroke();
      this.noGlow();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  private car(e: SceneEntity, w: number) {
    const { t } = this;
    const color = t.cars[e.row % t.cars.length];
    this.body(color, e.x + 3, e.y + 8, w - 6, CELL - 16, 6);
    // Parabrisas en el lado hacia el que avanza.
    const wx = e.dir === 1 ? e.x + w - 13 : e.x + 7;
    this.rect(
      this.skin === "neon" ? color : t.carWindow,
      wx,
      e.y + 12,
      6,
      CELL - 24,
    );
    this.wheels(e.x, e.y, w, e.cells, color);
  }

  private truck(e: SceneEntity, w: number) {
    const { t } = this;
    const cabW = CELL - 4;
    const cabX = e.dir === 1 ? e.x + w - cabW - 2 : e.x + 2;
    const trailerX = e.dir === 1 ? e.x + 2 : e.x + cabW + 4;
    this.body(t.truckBody, trailerX, e.y + 7, w - cabW - 6, CELL - 14, 3);
    this.body(t.truckCab, cabX, e.y + 9, cabW, CELL - 18, 5);
    const wx = e.dir === 1 ? cabX + cabW - 9 : cabX + 3;
    this.rect(
      this.skin === "neon" ? t.truckCab : t.truckWindow,
      wx,
      e.y + 13,
      6,
      CELL - 26,
    );
    this.wheels(e.x, e.y, w, 3, t.truckBody);
  }

  private wheels(
    x: number,
    y: number,
    w: number,
    cells: number,
    accent: string,
  ) {
    const { ctx, t } = this;
    // En neón las ruedas negras se perderían en el asfalto: van del color del vehículo.
    ctx.fillStyle = this.skin === "neon" ? accent : t.wheel;
    const xs =
      cells >= 3 ? [x + 11, x + w / 2, x + w - 11] : [x + 11, x + w - 11];
    for (const wx of xs) {
      for (const wy of [y + 8, y + CELL - 8]) {
        ctx.beginPath();
        ctx.arc(wx, wy, this.skin === "neon" ? 3 : 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Retro ──────────────────────────────────────────────────────────────────

  private retroEntity(e: SceneEntity) {
    const { t } = this;
    const x = snap(e.x);
    const y = e.y;
    const w = e.cells * CELL;
    const o = t.outline;
    switch (e.kind) {
      case "log": {
        if (o) {
          this.rect(o, x, y + 4, w, 32);
          this.rect(o, x - PX, y + 8, w + PX * 2, 24);
        }
        this.rect(t.log, x + PX, y + 8, w - PX * 2, 24);
        this.rect(t.log, x, y + 12, w, 16);
        for (let k = 1; k < e.cells * 2; k++) {
          this.rect(t.logLine, x + k * 20 - 4, y + (k % 2 ? 16 : 20), 8, PX);
        }
        // Anillos del corte en los extremos.
        this.rect(t.logLine, x + PX, y + 16, PX, 8);
        this.rect(t.logLine, x + w - PX * 2, y + 16, PX, 8);
        return;
      }
      case "turtle": {
        const rot = e.dir === 1 ? 1 : 3;
        for (let k = 0; k < e.cells; k++) {
          const ox = x + k * CELL + PX;
          if (e.look === "full") {
            this.sprite(
              TURTLE_SPRITE,
              ox,
              y + PX,
              { s: t.shell, l: t.shellLine },
              rot,
              o,
            );
          } else {
            // Sumergida o en el fotograma apagado del aviso: solo la onda.
            this.sprite(RIPPLE_SPRITE, ox, y + PX, { r: t.ripple });
          }
        }
        return;
      }
      case "car": {
        const color = t.cars[e.row % t.cars.length];
        if (o) this.rect(o, x, y + 4, w, 32);
        this.rect(color, x + PX, y + 8, w - PX * 2, 24);
        const wx = e.dir === 1 ? x + w - 16 : x + 12;
        this.rect(t.carWindow, wx, y + 12, PX, 16);
        this.retroWheels(x, y, w, e.cells);
        return;
      }
      case "truck": {
        const cabW = 36;
        const cabX = e.dir === 1 ? x + w - cabW - PX : x + PX;
        const trailerX = e.dir === 1 ? x + PX : x + cabW + PX * 2;
        if (o) this.rect(o, x, y + 4, w, 32);
        this.rect(t.truckBody, trailerX, y + 8, w - cabW - PX * 3, 24);
        this.rect(t.truckCab, cabX, y + 8, cabW, 24);
        const wx = e.dir === 1 ? cabX + cabW - 12 : cabX + 8;
        this.rect(t.truckWindow, wx, y + 12, PX, 16);
        this.retroWheels(x, y, w, 3);
        return;
      }
    }
  }

  private retroWheels(x: number, y: number, w: number, cells: number) {
    const xs =
      cells >= 3 ? [x + 8, x + w / 2 - 4, x + w - 16] : [x + 8, x + w - 16];
    for (const wx of xs) {
      this.rect(this.t.wheel, wx, y + PX, 8, PX);
      this.rect(this.t.wheel, wx, y + 32, 8, PX);
    }
  }

  // ── Rana ───────────────────────────────────────────────────────────────────

  private frog(
    cx: number,
    cy: number,
    scale: number,
    angle: number,
    leaping: boolean,
  ) {
    const { ctx, t } = this;
    if (this.skin === "retro") {
      this.sprite(
        leaping ? FROG_LEAP_SPRITE : FROG_SPRITE,
        snap(cx) - 16,
        snap(cy) - 16,
        { g: t.frog, d: t.frogDark, e: t.eye, p: t.pupil },
        quarterTurns(angle),
        t.frogOutline,
      );
      return;
    }
    // Rana de primitivas: cuerpo elíptico, dos ojos y patas que se abren en el salto.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    const spread = leaping ? 6 : 0;
    ctx.strokeStyle = t.frogOutline;
    ctx.lineWidth = 2;
    ctx.fillStyle = t.frogDark;
    for (const [lx, ly] of [
      [-13, -8 - spread],
      [13, -8 - spread],
      [-13, 8 + spread],
      [13, 8 + spread],
    ]) {
      ctx.beginPath();
      ctx.ellipse(lx, ly, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = t.frog;
    this.glow(t.frog);
    ctx.fill();
    this.noGlow();
    for (const ex of [-6, 6]) {
      ctx.fillStyle = t.eye;
      ctx.beginPath();
      ctx.arc(ex, -9, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.pupil;
      ctx.beginPath();
      ctx.arc(ex, -10, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Barra de tiempo en el borde inferior de la franja de inicio.
  private timeBar(ratio: number) {
    const { t } = this;
    const color =
      ratio > 0.5 ? t.timeOk : ratio > 0.25 ? t.timeWarn : t.timeLow;
    this.rect(t.timeTrack, 0, H - 8, W, 8);
    const w = this.skin === "retro" ? snap(W * ratio) : W * ratio;
    this.glow(color);
    this.rect(color, 0, H - 8, w, 8);
    this.noGlow();
  }
}
