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

    let lastTime = 0

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

        // Mover rivales
        gs.rivals = gs.rivals
          .map(r => ({ ...r, z: r.z + RIVAL_SPEED * dt }))
          .filter(r => r.z < 1.15)

        // Spawnear monedas
        if (gs.frameCount % SPAWN_COIN_INTERVAL === 0 && gs.coins.length < MAX_COINS) {
          gs.coins.push({
            id:   gs.nextCoinId++,
            lane: [-0.6, -0.2, 0.2, 0.6][Math.floor(Math.random() * 4)],
            z:    0.05,
          })
        }

        // Mover monedas
        gs.coins = gs.coins
          .map(c => ({ ...c, z: c.z + COIN_SPEED * dt }))
          .filter(c => c.z < 1.05)

        // Recolectar monedas
        const toRemove: number[] = []
        gs.coins.forEach(coin => {
          if (coin.z > 0.88 && coin.z < 1.0) {
            const dist = Math.abs(coin.lane - gs.playerX)
            if (dist < COLLISION_DIST_COIN) {
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

        // Animar textos flotantes
        gs.floats = gs.floats
          .map(ft => ({ ...ft, y: ft.y - 1.2 * dt, alpha: ft.alpha - 0.025 * dt }))
          .filter(ft => ft.alpha > 0)

        // Colisión con rivales
        for (const rival of gs.rivals) {
          if (rival.z > 0.85 && rival.z < 1.08) {
            const dist = Math.abs(rival.lane - gs.playerX)
            if (dist < COLLISION_DIST_RIVAL) {
              gs.phase    = 'crashed'
              gs.crashMsg = '¡CHOQUE!'
              gs.shakeEnd = now + 400
              playCrash()
              onGameOver(gs.money)
              return
            }
          }
        }
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