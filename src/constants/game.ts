// Constantes del canvas y del juego
export const CW = 636
export const CH = 300

// Línea de horizonte (42% de la altura)
export const HORIZON_Y = CH * 0.42

// Puntos de fuga de la pista
export const ROAD_LEFT_BASE  = 0.01  // fracción del ancho en la base del canvas
export const ROAD_RIGHT_BASE = 0.99
export const ROAD_LEFT_HOR   = 0.35  // punto de fuga izquierdo
export const ROAD_RIGHT_HOR  = 0.65  // punto de fuga derecho

// Velocidades del juego
export const SPEED      = 0.018   // avance z por frame
export const RIVAL_SPEED = 0.011
export const COIN_SPEED = 0.016
export const PLAYER_SPEED = 0.022

// Parámetros de colisión
export const COLLISION_DIST_RIVAL = 0.32  // Un poco más amplio
export const COLLISION_DIST_COIN = 0.28   // Un poco más amplio
export const COLLISION_Z_MIN = 0.82        // Inicio más temprano
export const COLLISION_Z_MAX = 1.15        // Hasta que pase completamente
export const ROAD_BOUND = 0.88
export const PLAYER_BOUNDS = { min: -0.92, max: 0.92 }

// Spawns
export const MAX_RIVALS = 5
export const MAX_COINS = 8
export const SPAWN_RIVAL_INTERVAL = 90
export const SPAWN_COIN_INTERVAL = 55