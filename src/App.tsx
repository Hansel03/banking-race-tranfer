import { useEffect, useRef, useState, useCallback } from 'react'
import './index.css'

// ─── BHD Color Tokens (JS mirror para uso en canvas y estilos inline) ─────────
const C = {
  background:           '#0d1117',
  surface:              '#161b22',
  surfaceRaised:        '#1c2128',
  border:               '#30363d',
  borderStrong:         '#484f58',
  foreground:           '#e6edf3',
  muted:                '#8b949e',
  primary:              '#58a6ff',
  primaryHover:         '#79b8ff',
  primaryActive:        '#1f6feb',
  primarySoft:          '#0d2241',
  success:              '#3fb950',
  successSoft:          '#0d2818',
  danger:               '#f85149',
  dangerSoft:           '#2d1014',
  warning:              '#d29922',
  warningSoft:          '#2d1f03',
  info:                 '#58a6ff',
  infoSoft:             '#0d2241',
  disabledFg:           '#484f58',
  disabledBg:           '#21262d',
  greyBlue900:          '#161a1d',
  greyBlue800:          '#2c353a',
  greyBlue700:          '#424f57',
  greyBlue600:          '#586a74',
  greyBlue500:          '#6e8491',
  greyBlue200:          '#c5ced3',
  white:                '#ffffff',
  green400:             '#50b940',
  green600:             '#00a80c',
  green100:             '#e2f2e3',
  error600:             '#db2500',
  error100:             '#fff2f0',
  warning600:           '#e5a000',
  warning100:           '#fffaf0',
  info600:              '#3c80f6',
  grey700:              '#333333',
} as const

// ─── Cuentas mock ──────────────────────────────────────────────────────────────
const CUENTAS = [
  { id: '1', num: '0042', tipo: 'CA', alias: 'Ahorro Personal',    saldo: 12450  },
  { id: '2', num: '0117', tipo: 'CC', alias: 'Cuenta Corriente',   saldo: 87320  },
  { id: '3', num: '0258', tipo: 'CA', alias: 'Fondo de Viaje',     saldo: 5890   },
  { id: '4', num: '0391', tipo: 'CA', alias: 'Gastos del Hogar',   saldo: 23100  },
  { id: '5', num: '0524', tipo: 'CC', alias: 'Empresa SRL',        saldo: 154000 },
]

// ─── Canvas constants ─────────────────────────────────────────────────────────
const CW = 636
const CH = 300
const HORIZON_Y = CH * 0.42   // línea de horizonte
const ROAD_LEFT_BASE  = 0.01  // fracción del ancho en la base del canvas
const ROAD_RIGHT_BASE = 0.99
const ROAD_LEFT_HOR   = 0.35  // punto de fuga izquierdo
const ROAD_RIGHT_HOR  = 0.65  // punto de fuga derecho

// ─── Tipos del juego ──────────────────────────────────────────────────────────
type GamePhase = 'idle' | 'playing' | 'crashed' | 'done'

interface Rival {
  id:    number
  lane:  number   // -1, 0, 1
  z:     number   // 0=horizonte, 1=frente del jugador
  color: string
  label: number
}

interface Coin {
  id:    number
  lane:  number
  z:     number
}

interface FloatText {
  id:    number
  x:     number
  y:     number
  alpha: number
  text:  string
}

interface GameState {
  phase:       GamePhase
  money:       number
  playerX:     number  // -1 a 1 dentro de la pista
  tilt:        number  // grados de rotación
  rivals:      Rival[]
  coins:       Coin[]
  floats:      FloatText[]
  roadOffset:  number  // desplazamiento de las franjas del suelo
  grassOffset: number
  crashMsg:    string
  shakeEnd:    number  // timestamp fin del shake
  blinkOn:     boolean
  blinkTick:   number
  frameCount:  number
  nextRivalId: number
  nextCoinId:  number
  nextFloatId: number
  keysDown:    Set<string>
}

// ─── Audio helpers ─────────────────────────────────────────────────────────────
function playSound(
  type: OscillatorType,
  frequency: number,
  durationMs: number,
  volume = 0.18,
) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + durationMs / 1000)
    osc.onended = () => ctx.close()
  } catch { /* sin permisos de audio */ }
}

const playCoin  = () => playSound('sine',   880, 80)
const playCrash = () => playSound('square', 120, 300, 0.25)

// ─── Helpers de perspectiva ───────────────────────────────────────────────────
// z: 0=horizonte … 1=frente del canvas
function roadXAt(norm: number, z: number): number {
  const left  = ROAD_LEFT_HOR  + (ROAD_LEFT_BASE  - ROAD_LEFT_HOR)  * z
  const right = ROAD_RIGHT_HOR + (ROAD_RIGHT_BASE - ROAD_RIGHT_HOR) * z
  return (left + (right - left) * ((norm + 1) / 2)) * CW
}

function roadYAt(z: number): number {
  return HORIZON_Y + (CH - HORIZON_Y) * z
}

function roadWidthAt(z: number): number {
  const left  = (ROAD_LEFT_HOR  + (ROAD_LEFT_BASE  - ROAD_LEFT_HOR)  * z) * CW
  const right = (ROAD_RIGHT_HOR + (ROAD_RIGHT_BASE - ROAD_RIGHT_HOR) * z) * CW
  return right - left
}

// ─── Dibujado del canvas ──────────────────────────────────────────────────────
function drawFrame(
  ctx:   CanvasRenderingContext2D,
  gs:    GameState,
  shake: { dx: number; dy: number },
) {
  ctx.save()
  ctx.translate(shake.dx, shake.dy)

  // ── Cielo degradado pixelado ────────────────────────────────────────────────
  const skyHeight = Math.floor(HORIZON_Y)
  for (let row = 0; row < skyHeight; row++) {
    const t = row / skyHeight
    // de greyBlue900 (#161a1d) hacia un naranja atardecer interpolado
    const r = Math.round(0x16 + (0xe5 - 0x16) * t * 0.55)
    const g = Math.round(0x1a + (0xa0 - 0x1a) * t * 0.45)
    const b = Math.round(0x1d + (0x00 - 0x1d) * t * 0.35)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, row, CW, 1)
  }

  // ── Sol cuadrado pixelado ───────────────────────────────────────────────────
  const sunCX = CW / 2
  const sunCY = HORIZON_Y - 2
  const sunLayers = [
    { size: 28, color: C.warning100 },
    { size: 20, color: C.warning600 },
    { size: 12, color: '#ffcc44'    },
  ]
  sunLayers.forEach(({ size, color }) => {
    ctx.fillStyle = color
    ctx.fillRect(sunCX - size / 2, sunCY - size / 2, size, size)
  })

  // ── Montañas pixeladas ──────────────────────────────────────────────────────
  const mountains = [
    [0,   HORIZON_Y, 80, 28],
    [60,  HORIZON_Y, 100, 36],
    [140, HORIZON_Y, 80,  22],
    [220, HORIZON_Y, 120, 40],
    [320, HORIZON_Y, 90,  30],
    [400, HORIZON_Y, 110, 38],
    [490, HORIZON_Y, 80,  24],
    [550, HORIZON_Y, 90,  32],
  ] as [number, number, number, number][]
  ctx.fillStyle = C.greyBlue800
  mountains.forEach(([mx, my, mw, mh]) => {
    // triángulo pixelado (rectángulo con esquinas)
    const steps = Math.floor(mw / 2)
    for (let i = 0; i < steps; i++) {
      const h = Math.floor((mh * i) / steps)
      ctx.fillRect(mx + i, my - h, 1, h)
      ctx.fillRect(mx + mw - i - 1, my - h, 1, h)
    }
  })

  // ── Pasto lateral ───────────────────────────────────────────────────────────
  const GRASS_STRIPES = 6
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

  // ── Paredes laterales ajedrezadas ───────────────────────────────────────────
  const WALL_W = 10
  const WALL_ROWS = 12
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

  // ── Franjas de asfalto ──────────────────────────────────────────────────────
  const ROAD_STRIPES = 8
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

  // ── Líneas centrales amarillas ──────────────────────────────────────────────
  const DASH_ROWS = 10
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

  // ── Franja de meta (base del canvas) ────────────────────────────────────────
  const metaH = 14
  const CHECKER = 14
  for (let cx = 0; cx < CW; cx += CHECKER) {
    for (let cy = 0; cy < metaH; cy += CHECKER / 2) {
      const even = (Math.floor(cx / CHECKER) + Math.floor(cy / (CHECKER / 2))) % 2 === 0
      ctx.fillStyle = even ? C.grey700 : C.white
      ctx.fillRect(cx, CH - metaH + cy, CHECKER, CHECKER / 2)
    }
  }

  // ── Monedas ─────────────────────────────────────────────────────────────────
  gs.coins.forEach(coin => {
    const z = coin.z
    if (z < 0.05) return
    const cx = roadXAt(coin.lane * 0.45, z)
    const cy = roadYAt(z)
    const size = Math.max(4, 12 * z)
    const even = gs.frameCount % 2 === 0
    ctx.fillStyle = even ? C.warning600 : C.warning100
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size)
    if (size > 6) {
      ctx.fillStyle = even ? C.warning100 : C.warning600
      ctx.font = `${Math.floor(size * 0.5)}px 'Press Start 2P', monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('$', cx, cy)
    }
  })

  // ── Autos rivales ───────────────────────────────────────────────────────────
  const RIVAL_COLORS = [C.info600, C.green400, C.warning600, C.primaryActive]
  gs.rivals.forEach(rival => {
    const z = rival.z
    if (z < 0.08) return
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

  // ── Auto del jugador ────────────────────────────────────────────────────────
  const playerScreenX = roadXAt(gs.playerX, 1)
  const playerScreenY = CH - 18
  ctx.save()
  ctx.translate(playerScreenX, playerScreenY)
  ctx.rotate((gs.tilt * Math.PI) / 180)
  drawCar(ctx, 0, 0, 1, 'var(--bhd-theme-primary)', true)
  ctx.restore()

  // ── Textos flotantes (monedas recogidas) ─────────────────────────────────────
  gs.floats.forEach(ft => {
    ctx.globalAlpha = ft.alpha
    ctx.fillStyle   = C.warning600
    ctx.font        = "8px 'Press Start 2P', monospace"
    ctx.textAlign   = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ft.text, ft.x, ft.y)
    ctx.globalAlpha = 1
  })

  // ── HUD ─────────────────────────────────────────────────────────────────────
  ctx.fillStyle = `rgba(22,26,29,0.82)`
  ctx.fillRect(0, 0, CW, 28)
  ctx.fillStyle = C.warning600
  ctx.font      = "10px 'Press Start 2P', monospace"
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(`$${gs.money.toLocaleString('es-DO')}`, 10, 14)
  ctx.fillStyle = C.greyBlue200
  ctx.font      = "7px 'Press Start 2P', monospace"
  ctx.textAlign = 'right'
  ctx.fillText('VEL 120km/h', CW - 10, 14)

  // ── Overlay IDLE ─────────────────────────────────────────────────────────────
  if (gs.phase === 'idle') {
    ctx.fillStyle = `rgba(13,17,23,0.72)`
    ctx.fillRect(0, 0, CW, CH)
    if (gs.blinkOn) {
      ctx.fillStyle = C.primary
      ctx.font      = "14px 'Press Start 2P', monospace"
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('CLICK PARA JUGAR', CW / 2, CH / 2)
    }
  }

  // ── Overlay CRASH ────────────────────────────────────────────────────────────
  if (gs.phase === 'crashed') {
    ctx.fillStyle = `rgba(255,242,240,0.88)`
    ctx.fillRect(0, 0, CW, CH)
    if (gs.blinkOn) {
      ctx.fillStyle = C.error600
      ctx.font      = "18px 'Press Start 2P', monospace"
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(gs.crashMsg, CW / 2, CH / 2 - 28)
    }
    ctx.fillStyle = C.grey700
    ctx.font      = "10px 'Press Start 2P', monospace"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`MONTO CAPTURADO: $${gs.money.toLocaleString('es-DO')}`, CW / 2, CH / 2 + 10)
    ctx.fillStyle = C.greyBlue700
    ctx.font      = "8px 'Press Start 2P', monospace"
    ctx.fillText('CLICK PARA REINICIAR', CW / 2, CH / 2 + 38)
  }

  ctx.restore()
}

// ─── Dibujado del auto ─────────────────────────────────────────────────────────
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
  ctx.fillRect(x - ww * 0.4, y + h * 0.55, ww, wh)               // izq trasera
  ctx.fillRect(x + w - ww * 0.6, y + h * 0.55, ww, wh)            // der trasera
  ctx.fillRect(x - ww * 0.4, y + h * 0.74, ww, wh * 0.85)         // izq delantera
  ctx.fillRect(x + w - ww * 0.6, y + h * 0.74, ww, wh * 0.85)     // der delantera

  // llanta detalle
  ctx.fillStyle = C.greyBlue200
  ctx.fillRect(x - ww * 0.1, y + h * 0.58, ww * 0.6, wh * 0.5)
  ctx.fillRect(x + w - ww * 0.3, y + h * 0.58, ww * 0.6, wh * 0.5)

  // faros traseros (jugador) o delanteros (rivales)
  ctx.fillStyle = isPlayer ? '#ff3333' : '#ffee88'
  ctx.fillRect(x + w * 0.06, y + h * 0.24, w * 0.20, h * 0.06)
  ctx.fillRect(x + w * 0.74, y + h * 0.24, w * 0.20, h * 0.06)
}

// ─── Estado inicial del juego ─────────────────────────────────────────────────
function makeInitialGS(): GameState {
  return {
    phase:       'idle',
    money:       0,
    playerX:     0,
    tilt:        0,
    rivals:      [],
    coins:       [],
    floats:      [],
    roadOffset:  0,
    grassOffset: 0,
    crashMsg:    '',
    shakeEnd:    0,
    blinkOn:     true,
    blinkTick:   0,
    frameCount:  0,
    nextRivalId: 0,
    nextCoinId:  0,
    nextFloatId: 0,
    keysDown:    new Set(),
  }
}

// ─── Formateador ─────────────────────────────────────────────────────────────
function fmt(n: number) {
  return `$${n.toLocaleString('es-DO')}`
}

// ─── Estilos inline base ───────────────────────────────────────────────────────
const S = {
  app: {
    minHeight:       '100vh',
    background:      'var(--bhd-theme-background)',
    display:         'flex',
    flexDirection:   'column' as const,
    alignItems:      'center',
    padding:         '24px 16px 48px',
    gap:             '0px',
    fontFamily:      "'Press Start 2P', monospace",
    position:        'relative' as const,
    overflow:        'hidden',
  },
  scanlines: {
    position:        'fixed' as const,
    inset:           0,
    pointerEvents:   'none' as const,
    zIndex:          9999,
    backgroundImage: 'repeating-linear-gradient(0deg, var(--bhd-theme-foreground) 0px, transparent 1px, transparent 3px)',
    opacity:         0.04,
  },
  title: {
    color:           'var(--bhd-theme-primary)',
    fontSize:        '13px',
    letterSpacing:   '1px',
    marginBottom:    '20px',
    textShadow:      `2px 2px 0 ${C.grey700}`,
  },
  panel: {
    width:           '100%',
    maxWidth:        '660px',
    background:      'var(--bhd-theme-surface)',
    border:          '3px solid var(--bhd-theme-border-strong)',
    boxShadow:       `4px 4px 0 ${C.grey700}`,
    padding:         '20px',
    marginBottom:    '0px',
  },
  label: {
    display:         'block',
    color:           'var(--bhd-theme-muted)',
    fontSize:        '8px',
    marginBottom:    '8px',
    letterSpacing:   '1px',
  },
  select: {
    width:           '100%',
    background:      'var(--bhd-theme-background)',
    color:           'var(--bhd-theme-foreground)',
    border:          '3px solid var(--bhd-theme-border-strong)',
    boxShadow:       `3px 3px 0 ${C.grey700}`,
    padding:         '10px 12px',
    fontFamily:      "'Press Start 2P', monospace",
    fontSize:        '8px',
    borderRadius:    '0',
    cursor:          'pointer',
    appearance:      'none' as const,
    WebkitAppearance:'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpolygon points='0,0 12,0 6,8' fill='%23484f58'/%3E%3C/svg%3E")`,
    backgroundRepeat:'no-repeat',
    backgroundPosition:'calc(100% - 12px) 50%',
    paddingRight:    '32px',
  },
  selectRow: {
    display:         'grid',
    gridTemplateColumns: '1fr 1fr',
    gap:             '20px',
    marginBottom:    '0',
  },
  divider: {
    width:           '100%',
    maxWidth:        '660px',
    height:          '4px',
    background:      `repeating-linear-gradient(90deg, ${C.grey700} 0px, ${C.grey700} 8px, transparent 8px, transparent 16px)`,
    margin:          '0',
  },
  confirmPanel: {
    width:           '100%',
    maxWidth:        '660px',
    background:      'var(--bhd-theme-surface)',
    border:          '3px solid var(--bhd-theme-border-strong)',
    boxShadow:       `4px 4px 0 ${C.grey700}`,
    padding:         '20px',
  },
  confirmGrid: {
    display:         'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap:             '16px',
    marginBottom:    '20px',
  },
  confirmLabel: {
    color:           'var(--bhd-theme-muted)',
    fontSize:        '7px',
    marginBottom:    '6px',
    display:         'block',
    letterSpacing:   '1px',
  },
  confirmValue: {
    color:           'var(--bhd-theme-foreground)',
    fontSize:        '8px',
    lineHeight:      '1.6',
  },
  montoDisplay: {
    color:           'var(--bhd-theme-success)',
    fontSize:        '14px',
    border:          '2px solid var(--bhd-theme-success)',
    padding:         '10px 16px',
    display:         'inline-block',
    boxShadow:       `3px 3px 0 ${C.grey700}`,
  },
  btnTransfer: {
    width:           '100%',
    padding:         '14px',
    background:      `var(--bhd-color-green-600)`,
    color:           `var(--bhd-color-grey-00)`,
    border:          `4px solid ${C.grey700}`,
    boxShadow:       `4px 4px 0 ${C.grey700}`,
    fontFamily:      "'Press Start 2P', monospace",
    fontSize:        '10px',
    cursor:          'pointer',
    letterSpacing:   '1px',
    borderRadius:    '0',
    transition:      'background 0.08s, transform 0.08s, box-shadow 0.08s',
  },
  btnTransferDisabled: {
    background:      'var(--bhd-theme-disabled-background)',
    color:           'var(--bhd-theme-disabled-foreground)',
    cursor:          'not-allowed',
    boxShadow:       'none',
  },
  successScreen: {
    width:           '100%',
    maxWidth:        '660px',
    background:      'var(--bhd-theme-success-soft)',
    border:          '3px solid var(--bhd-theme-success)',
    boxShadow:       `4px 4px 0 ${C.grey700}`,
    padding:         '32px 24px',
    textAlign:       'center' as const,
  },
  mobileMsg: {
    width:           '100%',
    maxWidth:        '660px',
    background:      'var(--bhd-theme-surface)',
    border:          '3px solid var(--bhd-theme-border-strong)',
    padding:         '32px 20px',
    textAlign:       'center' as const,
    color:           'var(--bhd-theme-muted)',
    fontSize:        '9px',
    lineHeight:      '2',
  },
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function App() {
  const [origenId,    setOrigenId]    = useState(CUENTAS[0].id)
  const [destinoId,   setDestinoId]   = useState(CUENTAS[1].id)
  const [finalMonto,  setFinalMonto]  = useState(0)
  const [transferred, setTransferred] = useState(false)
  const [isMobile,    setIsMobile]    = useState(false)
  const [btnHover,    setBtnHover]    = useState(false)
  const [btnActive,   setBtnActive]   = useState(false)
  const [gameKey,     setGameKey]     = useState(0) // para forzar remount del canvas

  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const gsRef      = useRef<GameState>(makeInitialGS())
  const rafRef     = useRef<number>(0)

  // Detectar mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ─── Game loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isMobile) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let lastTime = 0

    const SPEED      = 0.018   // avance z por frame
    const RIVAL_SPEED= 0.011
    const COIN_SPEED = 0.016
    const PLAYER_SPEED = 0.022

    const tick = (now: number) => {
      const gs = gsRef.current
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now
      gs.frameCount++

      // ── blink ──────────────────────────────────────────────────────────────
      gs.blinkTick += dt
      if (gs.blinkTick > 28) { gs.blinkOn = !gs.blinkOn; gs.blinkTick = 0 }

      if (gs.phase === 'playing') {
        // ── mover road ──────────────────────────────────────────────────────
        gs.roadOffset  = (gs.roadOffset  + SPEED * dt * 40)  % (CH / 8)
        gs.grassOffset = (gs.grassOffset + SPEED * dt * 38)  % (CH / 6)

        // ── input del jugador ────────────────────────────────────────────────
        let dx = 0
        if (gs.keysDown.has('ArrowLeft')  || gs.keysDown.has('a')) dx = -1
        if (gs.keysDown.has('ArrowRight') || gs.keysDown.has('d')) dx =  1
        gs.playerX = Math.max(-0.92, Math.min(0.92, gs.playerX + dx * PLAYER_SPEED * dt))
        gs.tilt     = dx * 8

        // ── salida de pista ──────────────────────────────────────────────────
        if (Math.abs(gs.playerX) > 0.88) {
          gs.phase    = 'crashed'
          gs.crashMsg = '¡FUERA DE PISTA!'
          gs.shakeEnd = now + 400
          playCrash()
          setFinalMonto(gs.money)
          return
        }

        // ── spawnear rivales ─────────────────────────────────────────────────
        if (gs.frameCount % 90 === 0 && gs.rivals.length < 5) {
          gs.rivals.push({
            id:    gs.nextRivalId++,
            lane:  ([-1, -0.4, 0, 0.4, 1] as number[])[Math.floor(Math.random() * 5)],
            z:     0.05,
            color: '',
            label: gs.rivals.length + 1,
          })
        }

        // ── mover rivales ────────────────────────────────────────────────────
        gs.rivals = gs.rivals
          .map(r => ({ ...r, z: r.z + RIVAL_SPEED * dt }))
          .filter(r => r.z < 1.15)

        // ── spawnear monedas ─────────────────────────────────────────────────
        if (gs.frameCount % 55 === 0 && gs.coins.length < 8) {
          gs.coins.push({
            id:   gs.nextCoinId++,
            lane: [-0.6, -0.2, 0.2, 0.6][Math.floor(Math.random() * 4)],
            z:    0.05,
          })
        }

        // ── mover monedas ────────────────────────────────────────────────────
        gs.coins = gs.coins
          .map(c => ({ ...c, z: c.z + COIN_SPEED * dt }))
          .filter(c => c.z < 1.05)

        // ── recolectar monedas ───────────────────────────────────────────────
        const toRemove: number[] = []
        gs.coins.forEach(coin => {
          if (coin.z > 0.88 && coin.z < 1.0) {
            const cx = coin.lane
            const dist = Math.abs(cx - gs.playerX)
            if (dist < 0.22) {
              gs.money += 100
              playCoin()
              const screenX = roadXAt(coin.lane, 0.9)
              const screenY = roadYAt(0.9)
              gs.floats.push({
                id:    gs.nextFloatId++,
                x:     screenX,
                y:     screenY,
                alpha: 1,
                text:  '+$100',
              })
              toRemove.push(coin.id)
            }
          }
        })
        gs.coins = gs.coins.filter(c => !toRemove.includes(c.id))

        // ── animar textos flotantes ──────────────────────────────────────────
        gs.floats = gs.floats
          .map(ft => ({ ...ft, y: ft.y - 1.2 * dt, alpha: ft.alpha - 0.025 * dt }))
          .filter(ft => ft.alpha > 0)

        // ── colisión con rivales ─────────────────────────────────────────────
        for (const rival of gs.rivals) {
          if (rival.z > 0.85 && rival.z < 1.08) {
            const dist = Math.abs(rival.lane - gs.playerX)
            if (dist < 0.28) {
              gs.phase    = 'crashed'
              gs.crashMsg = '¡CHOQUE!'
              gs.shakeEnd = now + 400
              playCrash()
              setFinalMonto(gs.money)
              return
            }
          }
        }
      }

      // ── calcular shake ────────────────────────────────────────────────────
      const shaking = now < gs.shakeEnd
      const shake = shaking
        ? { dx: (Math.random() - 0.5) * 10, dy: (Math.random() - 0.5) * 10 }
        : { dx: 0, dy: 0 }

      drawFrame(ctx, gs, shake)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isMobile])

  // ─── Controles de teclado ─────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      gsRef.current.keysDown.add(e.key)
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault()
      }
    }
    const up   = (e: KeyboardEvent) => gsRef.current.keysDown.delete(e.key)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup',   up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup',   up)
    }
  }, [])

  // ─── Click en el canvas ───────────────────────────────────────────────────
  const handleCanvasClick = useCallback(() => {
    const gs = gsRef.current
    if (gs.phase === 'idle' || gs.phase === 'crashed') {
      const fresh = makeInitialGS()
      fresh.phase = 'playing'
      gsRef.current = fresh
      setFinalMonto(0)
    }
  }, [])

  const origen  = CUENTAS.find(c => c.id === origenId)!
  const destino = CUENTAS.find(c => c.id === destinoId)!
  const sameAccount = origenId === destinoId
  const canTransfer = finalMonto > 0 && !sameAccount

  const handleTransfer = () => {
    if (!canTransfer) return
    setTransferred(true)
  }

  const handlePlayAgain = () => {
    // Reset completo del estado del juego
    const fresh = makeInitialGS()
    gsRef.current = fresh
    setFinalMonto(0)
    setGameKey(k => k + 1)
    setTransferred(false)
  }

  // ─── Pantalla de éxito ────────────────────────────────────────────────────
  if (transferred) {
    return (
      <div style={S.app}>
        <div style={S.scanlines} />
        <h1 style={S.title}>BHD — TRANSFERENCIA</h1>
        <div style={S.successScreen}>
          <div style={{ fontSize: '28px', marginBottom: '20px' }}>✓</div>
          <div style={{
            color:        'var(--bhd-theme-success)',
            fontSize:     '13px',
            marginBottom: '16px',
            letterSpacing:'1px',
          }}>
            ¡TRANSFERENCIA EXITOSA!
          </div>
          <div style={{ color: 'var(--bhd-theme-muted)', fontSize: '8px', marginBottom: '8px' }}>
            MONTO TRANSFERIDO
          </div>
          <div style={{
            color:        'var(--bhd-theme-primary)',
            fontSize:     '22px',
            marginBottom: '24px',
            textShadow:   `2px 2px 0 ${C.grey700}`,
          }}>
            {fmt(finalMonto)}
          </div>
          <div style={{ color: 'var(--bhd-theme-muted)', fontSize: '7px', marginBottom: '4px' }}>
            {origen.tipo} {origen.num} → {destino.tipo} {destino.num}
          </div>
          <div style={{ color: 'var(--bhd-theme-muted)', fontSize: '7px', marginBottom: '28px' }}>
            {origen.alias} → {destino.alias}
          </div>
          <button
            onClick={handlePlayAgain}
            style={{
              ...S.btnTransfer,
              background: 'var(--bhd-theme-primary)',
              fontSize:   '9px',
            }}
          >
            ▶ JUGAR DE NUEVO
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.app}>
      {/* Scanlines CRT */}
      <div style={S.scanlines} />

      <h1 style={S.title}>BHD — TRANSFERENCIA</h1>

      {/* ── 1. SELECTORES DE CUENTA ──────────────────────────────────────── */}
      <div style={S.panel}>
        <div style={S.selectRow}>
          {/* Origen */}
          <div>
            <label style={S.label} htmlFor="origen">CUENTA ORIGEN</label>
            <select
              id="origen"
              value={origenId}
              onChange={e => setOrigenId(e.target.value)}
              style={S.select}
            >
              {CUENTAS.map(c => (
                <option key={c.id} value={c.id}>
                  {c.tipo} {c.num} — {c.alias} — ${c.saldo.toLocaleString('es-DO')}
                </option>
              ))}
            </select>
          </div>
          {/* Destino */}
          <div>
            <label style={S.label} htmlFor="destino">CUENTA DESTINO</label>
            <select
              id="destino"
              value={destinoId}
              onChange={e => setDestinoId(e.target.value)}
              style={S.select}
            >
              {CUENTAS.map(c => (
                <option key={c.id} value={c.id}>
                  {c.tipo} {c.num} — {c.alias} — ${c.saldo.toLocaleString('es-DO')}
                </option>
              ))}
            </select>
          </div>
        </div>
        {sameAccount && (
          <div style={{
            marginTop:   '12px',
            color:       'var(--bhd-theme-danger)',
            fontSize:    '7px',
            letterSpacing:'1px',
          }}>
            ⚠ ORIGEN Y DESTINO NO PUEDEN SER IGUALES
          </div>
        )}
      </div>

      {/* Divisor pixelado */}
      <div style={S.divider} />

      {/* ── 2. MINIJUEGO ──────────────────────────────────────────────────── */}
      <div style={{
        width:      '100%',
        maxWidth:   '660px',
        border:     '3px solid var(--bhd-theme-border-strong)',
        boxShadow:  `4px 4px 0 ${C.grey700}`,
        background: C.greyBlue900,
        overflow:   'hidden',
        position:   'relative',
      }}>
        {/* Etiqueta del panel de juego */}
        <div style={{
          background:     'var(--bhd-theme-surface)',
          borderBottom:   '2px solid var(--bhd-theme-border)',
          padding:        '8px 14px',
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
        }}>
          <span style={{ color: 'var(--bhd-theme-muted)', fontSize: '7px', letterSpacing: '1px' }}>
            MONTO DE TRANSFERENCIA
          </span>
          <span style={{ color: C.warning600, fontSize: '10px' }}>
            {fmt(finalMonto || gsRef.current.money)}
          </span>
        </div>

        {isMobile ? (
          <div style={{ ...S.mobileMsg, border: 'none', boxShadow: 'none' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>🖥️</div>
            JUGÁ EN ESCRITORIO<br />
            <span style={{ fontSize: '7px' }}>EL JUEGO REQUIERE UN MONITOR MÁS GRANDE</span>
          </div>
        ) : (
          <canvas
            key={gameKey}
            ref={canvasRef}
            width={CW}
            height={CH}
            onClick={handleCanvasClick}
            style={{
              display:    'block',
              cursor:     gsRef.current.phase === 'playing' ? 'default' : 'pointer',
              imageRendering: 'pixelated',
              width:      '100%',
              height:     'auto',
            }}
          />
        )}

        {/* Instrucciones */}
        {!isMobile && (
          <div style={{
            background:   'var(--bhd-theme-surface)',
            borderTop:    '2px solid var(--bhd-theme-border)',
            padding:      '8px 14px',
            display:      'flex',
            gap:          '24px',
          }}>
            <span style={{ color: 'var(--bhd-theme-muted)', fontSize: '6px', letterSpacing: '1px' }}>
              ← → MOVER
            </span>
            <span style={{ color: 'var(--bhd-theme-muted)', fontSize: '6px', letterSpacing: '1px' }}>
              $ RECOGER MONEDAS (+$100 C/U)
            </span>
            <span style={{ color: C.error600, fontSize: '6px', letterSpacing: '1px' }}>
              ¡EVITÁ LOS AUTOS RIVALES!
            </span>
          </div>
        )}
      </div>

      <div style={S.divider} />

      {/* ── 3. CONFIRMACIÓN ───────────────────────────────────────────────── */}
      <div style={S.confirmPanel}>
        <div style={S.confirmGrid}>
          <div>
            <span style={S.confirmLabel}>ORIGEN</span>
            <div style={S.confirmValue}>
              <div>{origen.tipo} {origen.num}</div>
              <div style={{ color: 'var(--bhd-theme-muted)', fontSize: '7px', marginTop: '4px' }}>
                {origen.alias}
              </div>
              <div style={{ color: 'var(--bhd-theme-muted)', fontSize: '7px', marginTop: '4px' }}>
                Saldo: {fmt(origen.saldo)}
              </div>
            </div>
          </div>
          <div>
            <span style={S.confirmLabel}>DESTINO</span>
            <div style={S.confirmValue}>
              <div>{destino.tipo} {destino.num}</div>
              <div style={{ color: 'var(--bhd-theme-muted)', fontSize: '7px', marginTop: '4px' }}>
                {destino.alias}
              </div>
            </div>
          </div>
          <div>
            <span style={S.confirmLabel}>MONTO</span>
            <div style={S.montoDisplay}>
              {fmt(finalMonto)}
            </div>
          </div>
        </div>

        <button
          onClick={handleTransfer}
          disabled={!canTransfer}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => { setBtnHover(false); setBtnActive(false) }}
          onMouseDown={() => setBtnActive(true)}
          onMouseUp={() => setBtnActive(false)}
          style={{
            ...S.btnTransfer,
            ...(canTransfer ? {} : S.btnTransferDisabled),
            ...(canTransfer && btnHover ? {
              background: `var(--bhd-color-green-400)`,
            } : {}),
            ...(canTransfer && btnActive ? {
              transform:  'translate(2px, 2px)',
              boxShadow:  `2px 2px 0 ${C.grey700}`,
            } : {}),
          }}
        >
          {canTransfer
            ? `TRANSFERIR ${fmt(finalMonto)}`
            : finalMonto === 0
              ? 'JUGÁ PARA DEFINIR EL MONTO'
              : sameAccount
                ? 'SELECCIONÁ CUENTAS DISTINTAS'
                : `TRANSFERIR ${fmt(finalMonto)}`
          }
        </button>
      </div>
    </div>
  )
}
