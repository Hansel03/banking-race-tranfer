// Tipos del estado del juego

export type GamePhase = 'idle' | 'playing' | 'crashed' | 'done'

export interface Rival {
  id:     number
  lane:   number
  z:      number
  prevZ?: number  // Z del frame anterior — para detección anti-tunneling
  color:  string
  label:  number
}

export interface Coin {
  id:     number
  lane:   number
  z:      number
  prevZ?: number  // Z del frame anterior — para detección anti-tunneling
}

export interface FloatText {
  id:    number
  x:     number
  y:     number
  alpha: number
  text:  string
}

export interface Shake {
  dx: number
  dy: number
}

export interface GameState {
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

export interface GameProps {
  onGameOver: (finalMoney: number) => void
  gameKey: number
}