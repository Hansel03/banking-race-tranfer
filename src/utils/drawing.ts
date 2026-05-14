// Funciones de renderizado del canvas del juego
import { C } from '../constants/colors'
import { CW, CH, HORIZON_Y } from '../constants/game'
import { roadXAt, roadYAt, roadWidthAt } from './geometry'
import type { GameState, Shake } from '../types/game'

// ─── Constantes de dibujado ───────────────────────────────────────────────────
const GRASS_STRIPES = 6
const ROAD_STRIPES = 8
const DASH_ROWS = 10
const WALL_W = 10
const WALL_ROWS = 12

const RIVAL_COLORS = [C.info600, C.green400, C.warning600, C.primaryActive]

// Montañas predefinidas: [x, y_base, ancho, alto]
const MOUNTAINS: [number, number, number, number][] = [
  [0,   HORIZON_Y, 80, 28],
  [60,  HORIZON_Y, 100, 36],
  [140, HORIZON_Y, 80,  22],
  [220, HORIZON_Y, 120, 40],
  [320, HORIZON_Y, 90,  30],
  [400, HORIZON_Y, 110, 38],
  [490, HORIZON_Y, 80,  24],
  [550, HORIZON_Y, 90,  32],
]

// Capas del sol: [tamaño, color]
const SUN_LAYERS: { size: number; color: string }[] = [
  { size: 28, color: C.warning100 },
  { size: 20, color: C.warning600 },
  { size: 12, color: '#ffcc44' },
]

// ─── Helper: dibujar cielo degradado ─────────────────────────────────────────
function drawSky(ctx: CanvasRenderingContext2D): void {
  const skyHeight = Math.floor(HORIZON_Y)
  for (let row = 0; row < skyHeight; row++) {
    const t = row / skyHeight
    // Interpolación de greyBlue900 hacia naranja atardecer
    const r = Math.round(0x16 + (0xe5 - 0x16) * t * 0.55)
    const g = Math.round(0x1a + (0xa0 - 0x1a) * t * 0.45)
    const b = Math.round(0x1d + (0x00 - 0x1d) * t * 0.35)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, row, CW, 1)
  }
}

// ─── Helper: dibujar sol pixelado ───────────────────────────────────────────
function drawSun(ctx: CanvasRenderingContext2D): void {
  const sunCX = CW / 2
  const sunCY = HORIZON_Y - 2

  SUN_LAYERS.forEach(({ size, color }) => {
    ctx.fillStyle = color
    ctx.fillRect(sunCX - size / 2, sunCY - size / 2, size, size)
  })
}

// ─── Helper: dibujar montañas pixeladas ──────────────────────────────────────
function drawMountains(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = C.greyBlue800

  MOUNTAINS.forEach(([mx, my, mw, mh]) => {
    const steps = Math.floor(mw / 2)
    for (let i = 0; i < steps; i++) {
      const h = Math.floor((mh * i) / steps)
      ctx.fillRect(mx + i, my - h, 1, h)
      ctx.fillRect(mx + mw - i - 1, my - h, 1, h)
    }
  })
}

// ─── Helper: dibujar pasto lateral ───────────────────────────────────────────
function drawGrass(ctx: CanvasRenderingContext2D, gs: GameState): void {
  for (let i = 0; i < GRASS_STRIPES; i++) {
    const z0 = i / GRASS_STRIPES
    const z1 = (i + 1) / GRASS_STRIPES
    const y0 = roadYAt(z0)
    const y1 = roadYAt(z1)
    const lx0 = roadXAt(-1, z0), lx1 = roadXAt(-1, z1)
    const rx0 = roadXAt(1,  z0), rx1 = roadXAt(1,  z1)
    const even = (i + Math.floor(gs.grassOffset / (CH / GRASS_STRIPES))) % 2 === 0
    ctx.fillStyle = even ? C.greyBlue600 : C.greyBlue500

    // izquierdo
    ctx.beginPath()
    ctx.moveTo(0, y0); ctx.lineTo(lx0, y0)
    ctx.lineTo(lx1, y1); ctx.lineTo(0, y1)
    ctx.closePath(); ctx.fill()
    // derecho
    ctx.beginPath()
    ctx.moveTo(CW, y0); ctx.lineTo(rx0, y0)
    ctx.lineTo(rx1, y1); ctx.lineTo(CW, y1)
    ctx.closePath(); ctx.fill()
  }
}

// ─── Helper: dibujar paredes laterales ───────────────────────────────────────
function drawWalls(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < WALL_ROWS; i++) {
    const z0 = i / WALL_ROWS
    const z1 = (i + 1) / WALL_ROWS
    const y0 = roadYAt(z0)
    const y1 = roadYAt(z1)
    const lx = roadXAt(-1, (z0 + z1) / 2)
    const rx = roadXAt(1,  (z0 + z1) / 2)
    const even = i % 2 === 0
    ctx.fillStyle = even ? C.error600 : C.white
    ctx.fillRect(lx - WALL_W, y0, WALL_W, y1 - y0)
    ctx.fillStyle = even ? C.white : C.error600
    ctx.fillRect(rx, y0, WALL_W, y1 - y0)
  }
}

// ─── Helper: dibujar asfalto ─────────────────────────────────────────────────
function drawRoad(ctx: CanvasRenderingContext2D, gs: GameState): void {
  for (let i = 0; i < ROAD_STRIPES; i++) {
    const z0 = i / ROAD_STRIPES
    const z1 = (i + 1) / ROAD_STRIPES
    const y0 = roadYAt(z0)
    const y1 = roadYAt(z1)
    const lx0 = roadXAt(-1, z0), lx1 = roadXAt(-1, z1)
    const rx0 = roadXAt(1,  z0), rx1 = roadXAt(1,  z1)
    const even = (i + Math.floor(gs.roadOffset / (CH / ROAD_STRIPES))) % 2 === 0
    ctx.fillStyle = even ? C.greyBlue800 : C.greyBlue700
    ctx.beginPath()
    ctx.moveTo(lx0, y0); ctx.lineTo(rx0, y0)
    ctx.lineTo(rx1, y1); ctx.lineTo(lx1, y1)
    ctx.closePath(); ctx.fill()
  }
}

// ─── Helper: dibujar líneas centrales ────────────────────────────────────────
function drawCenterLines(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < DASH_ROWS; i++) {
    const z0 = (i + 0.2) / DASH_ROWS
    const z1 = (i + 0.55) / DASH_ROWS
    const y0 = roadYAt(z0)
    const y1 = roadYAt(z1)
    const x0 = roadXAt(0, z0)
    const x1 = roadXAt(0, z1)
    const w  = Math.max(1, roadWidthAt((z0 + z1) / 2) * 0.012)
    ctx.fillStyle = C.warning600
    ctx.beginPath()
    ctx.moveTo(x0 - w / 2, y0); ctx.lineTo(x0 + w / 2, y0)
    ctx.lineTo(x1 + w / 2, y1); ctx.lineTo(x1 - w / 2, y1)
    ctx.closePath(); ctx.fill()
  }
}

// ─── Helper: dibujar meta (base del canvas) ────────────────────────────────
function drawFinishLine(ctx: CanvasRenderingContext2D): void {
  const metaH = 14
  const CHECKER = 14
  for (let cx = 0; cx < CW; cx += CHECKER) {
    for (let cy = 0; cy < metaH; cy += CHECKER / 2) {
      const even = (Math.floor(cx / CHECKER) + Math.floor(cy / (CHECKER / 2))) % 2 === 0
      ctx.fillStyle = even ? C.grey700 : C.white
      ctx.fillRect(cx, CH - metaH + cy, CHECKER, CHECKER / 2)
    }
  }
}

// ─── Helper: dibujar monedas ────────────────────────────────────────────────
function drawCoins(ctx: CanvasRenderingContext2D, gs: GameState): void {
  gs.coins.forEach(coin => {
    const z = coin.z
    if (z < 0.05) return

    const cx = roadXAt(coin.lane * 0.45, z)
    const cy = roadYAt(z)
    const size = Math.max(6, 18 * z) // Más grandes: 18 en lugar de 12
    const even = gs.frameCount % 2 === 0
    const innerSize = size * 0.85

    // Borde exterior de la moneda (sombra/borde)
    ctx.fillStyle = even ? C.warning600 : C.grey700
    ctx.beginPath()
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
    ctx.fill()

    // Color dorado principal
    ctx.fillStyle = even ? '#ffd700' : C.warning600
    ctx.beginPath()
    ctx.arc(cx, cy, innerSize / 2, 0, Math.PI * 2)
    ctx.fill()

    // Brillo interior
    ctx.fillStyle = even ? C.warning100 : '#ffcc44'
    ctx.beginPath()
    ctx.arc(cx - size * 0.1, cy - size * 0.1, innerSize * 0.35, 0, Math.PI * 2)
    ctx.fill()

    // Símbolo $ en el centro
    ctx.fillStyle = even ? C.warning600 : '#ffd700'
    ctx.font = `${Math.floor(size * 0.45)}px 'Press Start 2P', monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('$', cx, cy + 1)
  })
}

// ─── Helper: dibujar autos rivales ───────────────────────────────────────────
function drawRivals(ctx: CanvasRenderingContext2D, gs: GameState): void {
  gs.rivals.forEach(rival => {
    const z = rival.z
    if (z < 0.05) return
    const cx = roadXAt(rival.lane * 0.42, z)
    const cy = roadYAt(z)
    const scale = z
    drawCar(ctx, cx, cy, scale, RIVAL_COLORS[rival.id % RIVAL_COLORS.length], false)
    // número del rival
    if (scale > 0.25) {
      ctx.fillStyle = C.white
      ctx.font = `${Math.max(5, Math.floor(8 * scale))}px 'Press Start 2P', monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`#${rival.label}`, cx, cy - 30 * scale)
    }
  })
}

// ─── Helper: dibujar auto del jugador ────────────────────────────────────────
function drawPlayerCar(ctx: CanvasRenderingContext2D, gs: GameState): void {
  const playerScreenX = roadXAt(gs.playerX, 1)
  const playerScreenY = CH - 18
  ctx.save()
  ctx.translate(playerScreenX, playerScreenY)
  ctx.rotate((gs.tilt * Math.PI) / 180)
  drawCar(ctx, 0, 0, 1, C.primary, true)
  ctx.restore()
}

// ─── Helper: dibujar textos flotantes ────────────────────────────────────────
function drawFloatTexts(ctx: CanvasRenderingContext2D, gs: GameState): void {
  gs.floats.forEach(ft => {
    ctx.globalAlpha = ft.alpha
    ctx.fillStyle   = C.warning600
    ctx.font        = "8px 'Press Start 2P', monospace"
    ctx.textAlign   = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ft.text, ft.x, ft.y)
    ctx.globalAlpha = 1
  })
}

// ─── Helper: dibujar HUD ──────────────────────────────────────────────────────
function drawHUD(ctx: CanvasRenderingContext2D, money: number): void {
  ctx.fillStyle = `rgba(22,26,29,0.82)`
  ctx.fillRect(0, 0, CW, 28)
  ctx.fillStyle = C.warning600
  ctx.font      = "10px 'Press Start 2P', monospace"
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(`$${money.toLocaleString('es-DO')}`, 10, 14)
  ctx.fillStyle = C.greyBlue200
  ctx.font      = "7px 'Press Start 2P', monospace"
  ctx.textAlign = 'right'
  ctx.fillText('VEL 120km/h', CW - 10, 14)
}

// ─── Helper: overlay de inicio ───────────────────────────────────────────────
function drawIdleOverlay(ctx: CanvasRenderingContext2D, blinkOn: boolean): void {
  ctx.fillStyle = `rgba(13,17,23,0.72)`
  ctx.fillRect(0, 0, CW, CH)
  if (blinkOn) {
    ctx.fillStyle = C.primary
    ctx.font      = "14px 'Press Start 2P', monospace"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('CLICK PARA JUGAR', CW / 2, CH / 2)
  }
}

// ─── Helper: overlay de crash ────────────────────────────────────────────────
function drawCrashOverlay(ctx: CanvasRenderingContext2D, msg: string, money: number, blinkOn: boolean): void {
  ctx.fillStyle = `rgba(255,242,240,0.88)`
  ctx.fillRect(0, 0, CW, CH)
  if (blinkOn) {
    ctx.fillStyle = C.error600
    ctx.font      = "18px 'Press Start 2P', monospace"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(msg, CW / 2, CH / 2 - 28)
  }
  ctx.fillStyle = C.grey700
  ctx.font      = "10px 'Press Start 2P', monospace"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`MONTO CAPTURADO: $${money.toLocaleString('es-DO')}`, CW / 2, CH / 2 + 10)
  ctx.fillStyle = C.greyBlue700
  ctx.font      = "8px 'Press Start 2P', monospace"
  ctx.fillText('CLICK PARA REINICIAR', CW / 2, CH / 2 + 38)
}

// ─── DIBUJAR AUTO (reusable para jugador y rivales) ──────────────────────────
function drawCar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  bodyColor: string,
  isPlayer: boolean,
) {
  const w = 38 * scale
  const h = 60 * scale
  const x = cx - w / 2
  const y = cy - h

  // sombra dura
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(x + 2 * scale, y + h * 0.88 + 2 * scale, w * 0.9, h * 0.12)

  // cuerpo
  ctx.fillStyle = isPlayer ? C.primary : bodyColor
  ctx.fillRect(x, y + h * 0.28, w, h * 0.6)

  // capot delantero (ancho)
  ctx.fillStyle = isPlayer ? C.primaryActive : bodyColor
  ctx.fillRect(x + w * 0.06, y + h * 0.72, w * 0.88, h * 0.16)

  // techo / parabrisas
  ctx.fillStyle = C.greyBlue800
  ctx.fillRect(x + w * 0.18, y + h * 0.13, w * 0.64, h * 0.28)

  // ventana (brillo)
  ctx.fillStyle = `rgba(100,160,220,0.45)`
  ctx.fillRect(x + w * 0.22, y + h * 0.16, w * 0.56, h * 0.22)

  // spoiler trasero
  ctx.fillStyle = isPlayer ? C.primaryActive : C.grey700
  ctx.fillRect(x + w * 0.05, y + h * 0.25, w * 0.90, h * 0.07)

  // ruedas
  ctx.fillStyle = '#0a0a0a'
  const ww = w * 0.22, wh = h * 0.18
  ctx.fillRect(x - ww * 0.4, y + h * 0.55, ww, wh)
  ctx.fillRect(x + w - ww * 0.6, y + h * 0.55, ww, wh)
  ctx.fillRect(x - ww * 0.4, y + h * 0.74, ww, wh * 0.85)
  ctx.fillRect(x + w - ww * 0.6, y + h * 0.74, ww, wh * 0.85)

  // llanta detalle
  ctx.fillStyle = C.greyBlue200
  ctx.fillRect(x - ww * 0.1, y + h * 0.58, ww * 0.6, wh * 0.5)
  ctx.fillRect(x + w - ww * 0.3, y + h * 0.58, ww * 0.6, wh * 0.5)

  // faros traseros (jugador) o delanteros (rivales)
  ctx.fillStyle = isPlayer ? '#ff3333' : '#ffee88'
  ctx.fillRect(x + w * 0.06, y + h * 0.24, w * 0.20, h * 0.06)
  ctx.fillRect(x + w * 0.74, y + h * 0.24, w * 0.20, h * 0.06)
}

// ─── DIBUJAR FRAME COMPLETO ──────────────────────────────────────────────────
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  gs: GameState,
  shake: Shake,
): void {
  ctx.save()
  ctx.translate(shake.dx, shake.dy)

  drawSky(ctx)
  drawSun(ctx)
  drawMountains(ctx)
  drawGrass(ctx, gs)
  drawWalls(ctx)
  drawRoad(ctx, gs)
  drawCenterLines(ctx)
  drawFinishLine(ctx)

  drawCoins(ctx, gs)
  drawRivals(ctx, gs)
  drawPlayerCar(ctx, gs)
  drawFloatTexts(ctx, gs)

  drawHUD(ctx, gs.money)

  if (gs.phase === 'idle') {
    drawIdleOverlay(ctx, gs.blinkOn)
  } else if (gs.phase === 'crashed') {
    drawCrashOverlay(ctx, gs.crashMsg, gs.money, gs.blinkOn)
  }

  ctx.restore()
}