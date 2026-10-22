// Dibujo de Arkanoid por skin. Solo pinta: no toca posiciones, colisiones ni
// reglas. Las coordenadas que recibe son las del motor (retro las ajusta a su
// rejilla de píxeles solo al dibujar).

import type { BlockColor } from "./levels";
import type { ArkanoidSkin, ThemeTokens } from "./skins";
import {
  BALL_SPRITE,
  BLOCK_SPRITES,
  EXPLOSION_FRAMES,
  PADDLE_SPRITE,
  drawFrame,
} from "./sprites";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Renderer {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    public skin: ArkanoidSkin,
    public t: ThemeTokens,
    public img: HTMLImageElement | null = null,
  ) {}

  // El skin arcade dibuja en plano hasta que carga el spritesheet.
  private get mode(): "classic" | "neon" | "retro" | "sprites" {
    if (this.skin === "arcade") return this.img ? "sprites" : "classic";
    return this.skin;
  }

  clear(w: number, h: number) {
    const { ctx } = this;
    ctx.imageSmoothingEnabled =
      this.mode !== "retro" && this.mode !== "sprites";
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.t.background;
    ctx.fillRect(0, 0, w, h);
  }

  block(color: BlockColor, r: Rect) {
    const { ctx, t } = this;
    const c = t.blocks[color];
    switch (this.mode) {
      case "sprites":
        drawFrame(ctx, this.img!, BLOCK_SPRITES[color], r.x, r.y, r.w, r.h);
        this.outlineRect(r);
        return;
      case "classic":
        ctx.fillStyle = c;
        ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
        return;
      case "neon":
        this.neonRect(c, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, 1);
        return;
      case "retro": {
        const x = snap(r.x);
        const y = snap(r.y);
        ctx.fillStyle = c;
        ctx.fillRect(x, y, snap(r.w) - PX, snap(r.h) - PX);
        ctx.fillStyle = t.shine;
        ctx.fillRect(x + PX, y + PX, PX * 3, PX);
        return;
      }
    }
  }

  // `p` = progreso de la explosión en [0, 1).
  explosion(color: BlockColor, r: Rect, p: number) {
    const { ctx, t } = this;
    const c = t.blocks[color];
    switch (this.mode) {
      case "sprites": {
        const frames = EXPLOSION_FRAMES[color];
        const i = Math.min(frames.length - 1, Math.floor(p * frames.length));
        drawFrame(ctx, this.img!, frames[i], r.x, r.y, r.w, r.h);
        return;
      }
      case "classic": {
        // El bloque encoge hacia su centro.
        const s = 1 - p;
        ctx.fillStyle = c;
        ctx.fillRect(
          r.x + (r.w * (1 - s)) / 2,
          r.y + (r.h * (1 - s)) / 2,
          r.w * s,
          r.h * s,
        );
        return;
      }
      case "neon": {
        // Un contorno que se expande y se apaga.
        const g = 1 + p * 0.5;
        const w = (r.w - 8) * g;
        const h = (r.h - 8) * g;
        this.neonRect(
          c,
          { x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2, w, h },
          1 - p,
        );
        return;
      }
      case "retro": {
        // El bloque se desmorona en celdas de 2×2 píxeles, en 4 pasos.
        const step = Math.min(3, Math.floor(p * 4));
        const cell = PX * 2;
        const x0 = snap(r.x);
        const y0 = snap(r.y);
        ctx.fillStyle = c;
        for (let cy = 0; cy < Math.floor(r.h / cell); cy++) {
          for (let cx = 0; cx < Math.floor(r.w / cell); cx++) {
            if ((cx * 7 + cy * 13) % 4 <= step) continue;
            ctx.fillRect(x0 + cx * cell, y0 + cy * cell, cell - PX, cell - PX);
          }
        }
        return;
      }
    }
  }

  paddle(r: Rect) {
    const { ctx, t } = this;
    const cap = 12;
    switch (this.mode) {
      case "sprites":
        drawFrame(ctx, this.img!, PADDLE_SPRITE, r.x, r.y, r.w, r.h);
        this.outlineRect(r);
        return;
      case "classic":
        ctx.fillStyle = t.paddle;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = t.paddleAccent;
        ctx.fillRect(r.x, r.y, cap, r.h);
        ctx.fillRect(r.x + r.w - cap, r.y, cap, r.h);
        return;
      case "neon":
        this.neonRect(
          t.paddle,
          { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 },
          1,
        );
        ctx.shadowBlur = t.glow;
        ctx.shadowColor = t.paddleAccent;
        ctx.fillStyle = t.paddleAccent;
        ctx.fillRect(r.x + 1, r.y + 1, cap, r.h - 2);
        ctx.fillRect(r.x + r.w - 1 - cap, r.y + 1, cap, r.h - 2);
        ctx.shadowBlur = 0;
        return;
      case "retro": {
        // 3 filas de píxeles con las esquinas recortadas.
        const x = snap(r.x);
        const y = snap(r.y);
        const w = snap(r.w);
        ctx.fillStyle = t.paddle;
        ctx.fillRect(x + PX, y, w - PX * 2, PX);
        ctx.fillRect(x, y + PX, w, PX);
        ctx.fillRect(x + PX, y + PX * 2, w - PX * 2, PX);
        ctx.fillStyle = t.paddleAccent;
        ctx.fillRect(x, y + PX, PX * 3, PX);
        ctx.fillRect(x + w - PX * 3, y + PX, PX * 3, PX);
        return;
      }
    }
  }

  ball(cx: number, cy: number, radius: number) {
    const { ctx, t } = this;
    switch (this.mode) {
      case "sprites": {
        const d = radius * 2;
        drawFrame(ctx, this.img!, BALL_SPRITE, cx - radius, cy - radius, d, d);
        if (t.outline) {
          ctx.strokeStyle = t.outline;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        return;
      }
      case "classic":
      case "neon":
        ctx.shadowBlur = t.glow;
        ctx.shadowColor = t.ball;
        ctx.fillStyle = t.ball;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        return;
      case "retro": {
        // Círculo de 4×4 píxeles: .XX. / XXXX / XXXX / .XX.
        const x = snap(cx - radius);
        const y = snap(cy - radius);
        ctx.fillStyle = t.ball;
        ctx.fillRect(x + PX, y, PX * 2, PX * 4);
        ctx.fillRect(x, y + PX, PX * 4, PX * 2);
        return;
      }
    }
  }

  text(msg: string, x: number, y: number) {
    const { ctx, t } = this;
    ctx.shadowBlur = this.mode === "neon" ? t.glow : 0;
    ctx.shadowColor = t.text;
    ctx.fillStyle = t.text;
    ctx.font = t.font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(msg, x, y);
    ctx.shadowBlur = 0;
  }

  // Relleno translúcido + contorno brillante.
  private neonRect(color: string, r: Rect, alpha: number) {
    const { ctx, t } = this;
    ctx.globalAlpha = t.fillAlpha * alpha;
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = t.glow;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Contorno de los sprites sobre fondo claro (sin él, el gris claro se pierde).
  private outlineRect(r: Rect) {
    const { ctx, t } = this;
    if (!t.outline) return;
    ctx.strokeStyle = t.outline;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  }
}

// Tamaño del «píxel» retro.
const PX = 4;
const snap = (v: number) => Math.round(v / PX) * PX;
