import { useEffect, useRef, useCallback } from 'react'
import type { GameState, GameProps } from '../../types/game'
import { CW, CH } from '../../constants/game'
import {
  SPEED,
  RIVAL_SPEED,
  COIN_SPEED,
  PLAYER_SPEED,
  MAX_RIVALS,
  MAX_COINS,
  SPAWN_RIVAL_INTERVAL,
  SPAWN_COIN_INTERVAL,
  COLLISION_DIST_RIVAL,
  COLLISION_DIST_COIN,
  ROAD_BOUND,
  PLAYER_BOUNDS,
} from '../../constants/game'
import { roadXAt, roadYAt } from '../../utils/geometry'
import { playCoin, playCrash } from '../../utils/audio'
import { drawFrame } from '../../utils/drawing'
import { C } from '../../constants/colors'

// El jugador siempre está en z=1 (frente del canvas)
const PLAYER_Z = 1.0

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

// Detecta si un objeto cruzó la Z del jugador entre el frame anterior y el actual.
// Esto evita el "tunneling" cuando el paso de frame es grande.
function crossedPlayerZ(prevZ: number, currZ: number): boolean {
  return prevZ < PLAYER_Z && currZ >= PLAYER_Z
}

const canvasStyle: React.CSSProperties = {
  display:       'block',
  cursor:        'pointer',
  imageRendering:'pixelated',
  width:         '100%',
  height:        'auto',
}

const mobileMsgStyle: React.CSSProperties = {
  width:           '100%',
  maxWidth:        '660px',
  background:      C.surface,
  border:          `3px solid ${C.borderStrong}`,
  padding:         '32px 20px',
  textAlign:       'center' as const,
  color:           C.muted,
  fontSize:        '9px',
  lineHeight:      '2',
}

export function GameCanvas({ onGameOver, gameKey }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef      = useRef<GameState>(makeInitialGS())
  const rafRef     = useRef<number>(0)
  const isMobile   = useRef(window.innerWidth < 700)

  // Detectar mobile
  useEffect(() => {
    const check = () => { isMobile.current = window.innerWidth < 700 }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Reiniciar cuando cambia gameKey
  useEffect(() => {
    gsRef.current = makeInitialGS()
  }, [gameKey])

  // Game loop
  useEffect(() => {
    if (isMobile.current) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let lastTime = performance.now()

    const tick = (now: number) => {
      const gs = gsRef.current
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now
      gs.frameCount++

      // blink
      gs.blinkTick += dt
      if (gs.blinkTick > 28) { gs.blinkOn = !gs.blinkOn; gs.blinkTick = 0 }

      if (gs.phase === 'playing') {
        // Mover road
        gs.roadOffset  = (gs.roadOffset  + SPEED * dt * 40)  % (CH / 8)
        gs.grassOffset = (gs.grassOffset + SPEED * dt * 38)  % (CH / 6)

        // Input del jugador
        let dx = 0
        if (gs.keysDown.has('ArrowLeft')  || gs.keysDown.has('a')) dx = -1
        if (gs.keysDown.has('ArrowRight') || gs.keysDown.has('d')) dx =  1
        gs.playerX = Math.max(PLAYER_BOUNDS.min, Math.min(PLAYER_BOUNDS.max, gs.playerX + dx * PLAYER_SPEED * dt))
        gs.tilt     = dx * 8

        // Salida de pista
        if (Math.abs(gs.playerX) > ROAD_BOUND) {
          gs.phase    = 'crashed'
          gs.crashMsg = '¡FUERA DE PISTA!'
          gs.shakeEnd = now + 400
          playCrash()
          onGameOver(gs.money)
          return
        }

        // Spawnear rivales
        if (gs.frameCount % SPAWN_RIVAL_INTERVAL === 0 && gs.rivals.length < MAX_RIVALS) {
          gs.rivals.push({
            id:    gs.nextRivalId++,
            lane:  ([-1, -0.4, 0, 0.4, 1] as number[])[Math.floor(Math.random() * 5)],
            z:     0.05,
            color: '',
            label: gs.rivals.length + 1,
          })
        }

        // Mover rivales — guardamos prevZ para detectar tunneling
        const movedRivals = gs.rivals.map(r => ({
          ...r,
          prevZ: r.z,
          z: r.z + RIVAL_SPEED * dt,
        }))

        // Spawnear monedas
        if (gs.frameCount % SPAWN_COIN_INTERVAL === 0 && gs.coins.length < MAX_COINS) {
          gs.coins.push({
            id:   gs.nextCoinId++,
            lane: [-0.6, -0.2, 0.2, 0.6][Math.floor(Math.random() * 4)],
            z:    0.05,
          })
        }

        // Mover monedas — guardamos prevZ para detectar tunneling
        const movedCoins = gs.coins.map(c => ({
          ...c,
          prevZ: c.z,
          z: c.z + COIN_SPEED * dt,
        }))

        // ── Colisión con rivales ──────────────────────────────────────────
        // Un rival choca si cruzó la Z del jugador Y está en el mismo carril
        for (const rival of movedRivals) {
          const crossed = crossedPlayerZ(rival.prevZ ?? rival.z - RIVAL_SPEED * dt, rival.z)
          const close   = Math.abs(rival.lane - gs.playerX) < COLLISION_DIST_RIVAL
          if (crossed && close) {
            gs.phase    = 'crashed'
            gs.crashMsg = '¡CHOQUE!'
            gs.shakeEnd = now + 400
            playCrash()
            onGameOver(gs.money)
            return
          }
        }

        // ── Recolección de monedas ────────────────────────────────────────
        const toRemove: number[] = []
        for (const coin of movedCoins) {
          const crossed = crossedPlayerZ(coin.prevZ ?? coin.z - COIN_SPEED * dt, coin.z)
          const close   = Math.abs(coin.lane * 0.45 - gs.playerX) < COLLISION_DIST_COIN
          if (crossed && close) {
            gs.money += 100
            playCoin()
            gs.floats.push({
              id:    gs.nextFloatId++,
              x:     roadXAt(coin.lane, 0.92),
              y:     roadYAt(0.92),
              alpha: 1,
              text:  '+$100',
            })
            toRemove.push(coin.id)
          }
        }

        // Actualizar listas limpias
        gs.rivals = movedRivals.filter(r => r.z < 1.3)
        gs.coins  = movedCoins.filter(c => c.z < 1.3 && !toRemove.includes(c.id))

        // Animar textos flotantes
        gs.floats = gs.floats
          .map(ft => ({ ...ft, y: ft.y - 1.2 * dt, alpha: ft.alpha - 0.025 * dt }))
          .filter(ft => ft.alpha > 0)
      }

      // Calcular shake
      const shaking = now < gs.shakeEnd
      const shake = shaking
        ? { dx: (Math.random() - 0.5) * 10, dy: (Math.random() - 0.5) * 10 }
        : { dx: 0, dy: 0 }

      drawFrame(ctx, gs, shake)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [onGameOver])

  // Controles de teclado
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

  const handleClick = useCallback(() => {
    const gs = gsRef.current
    if (gs.phase === 'idle' || gs.phase === 'crashed') {
      gsRef.current = { ...makeInitialGS(), phase: 'playing' }
    }
  }, [])

  if (isMobile.current) {
    return (
      <div style={mobileMsgStyle}>
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>🖥️</div>
        JUGÁ EN ESCRITORIO<br />
        <span style={{ fontSize: '7px' }}>EL JUEGO REQUIERE UN MONITOR MÁS GRANDE</span>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      onClick={handleClick}
      style={{
        ...canvasStyle,
        cursor: gsRef.current.phase === 'playing' ? 'default' : 'pointer',
      }}
    />
  )
}