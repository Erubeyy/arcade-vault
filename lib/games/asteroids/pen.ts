// «Pluma» de dibujo de Asteroids: las entidades piden líneas, polígonos y
// puntos en coordenadas de mundo y la pluma los pinta según el skin activo.
// En modo vectorial usa trazos de canvas (con glow si el skin lo pide); en
// modo retro rasteriza las líneas con Bresenham sobre una rejilla de píxeles
// gruesos y fillRect alineados, así no hay antialias ni bordes suaves.

import type { ThemeTokens } from "./skins";

export type Point = [number, number];

export class Pen {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    public t: ThemeTokens,
  ) {}

  clear(w: number, h: number) {
    const { ctx, t } = this;
    ctx.imageSmoothingEnabled = t.pixel === 0;
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = t.background;
    ctx.fillRect(0, 0, w, h);
  }

  // Polilínea (cerrada por defecto). `alpha` solo aplica en modo vectorial:
  // el retro no admite tonos intermedios fuera de su paleta.
  poly(pts: Point[], color: string, closed = true, alpha = 1) {
    if (pts.length < 2) return;
    const { ctx, t } = this;
    if (t.pixel > 0) {
      ctx.fillStyle = color;
      const n = closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        this.pixLine(x0, y0, x1, y1);
      }
      return;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = t.lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    this.applyGlow(color);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (closed) ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
    alpha = 1,
  ) {
    this.poly(
      [
        [x0, y0],
        [x1, y1],
      ],
      color,
      false,
      alpha,
    );
  }

  ring(x: number, y: number, r: number, color: string) {
    if (this.t.pixel > 0) {
      const pts: Point[] = [];
      const n = 20;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
      this.poly(pts, color);
      return;
    }
    const { ctx, t } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = t.lineWidth;
    this.applyGlow(color);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  dot(x: number, y: number, r: number, color: string) {
    const { ctx, t } = this;
    if (t.pixel > 0) {
      const P = t.pixel;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x / P) * P, Math.floor(y / P) * P, P, P);
      return;
    }
    ctx.save();
    ctx.fillStyle = color;
    this.applyGlow(color);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  text(str: string, x: number, y: number, color: string) {
    const { ctx, t } = this;
    ctx.save();
    ctx.font = t.font;
    ctx.textAlign = "left";
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  private applyGlow(color: string) {
    if (this.t.glow <= 0) return;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = this.t.glow;
  }

  // Bresenham en la rejilla de píxeles retro; el fillStyle ya está puesto.
  private pixLine(x0: number, y0: number, x1: number, y1: number) {
    const P = this.t.pixel;
    let gx = Math.floor(x0 / P);
    let gy = Math.floor(y0 / P);
    const gx1 = Math.floor(x1 / P);
    const gy1 = Math.floor(y1 / P);
    const dx = Math.abs(gx1 - gx);
    const dy = -Math.abs(gy1 - gy);
    const sx = gx < gx1 ? 1 : -1;
    const sy = gy < gy1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.ctx.fillRect(gx * P, gy * P, P, P);
      if (gx === gx1 && gy === gy1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        gx += sx;
      }
      if (e2 <= dx) {
        err += dx;
        gy += sy;
      }
    }
  }
}
