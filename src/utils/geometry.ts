// Helpers de perspectiva para el juego de carreras
import { CW, CH, HORIZON_Y, ROAD_LEFT_BASE, ROAD_RIGHT_BASE, ROAD_LEFT_HOR, ROAD_RIGHT_HOR } from '../constants/game'

/**
 * Calcula la posición X en el canvas para una coordenada normalizada de pista
 * @param norm -1 = borde izquierdo de la pista, 1 = borde derecho
 * @param z 0 = horizonte, 1 = frente del canvas
 */
export function roadXAt(norm: number, z: number): number {
  const left  = ROAD_LEFT_HOR  + (ROAD_LEFT_BASE  - ROAD_LEFT_HOR)  * z
  const right = ROAD_RIGHT_HOR + (ROAD_RIGHT_BASE - ROAD_RIGHT_HOR) * z
  return (left + (right - left) * ((norm + 1) / 2)) * CW
}

/**
 * Calcula la posición Y en el canvas para una profundidad z
 */
export function roadYAt(z: number): number {
  return HORIZON_Y + (CH - HORIZON_Y) * z
}

/**
 * Calcula el ancho de la pista en una profundidad z
 */
export function roadWidthAt(z: number): number {
  const left  = (ROAD_LEFT_HOR  + (ROAD_LEFT_BASE  - ROAD_LEFT_HOR)  * z) * CW
  const right = (ROAD_RIGHT_HOR + (ROAD_RIGHT_BASE - ROAD_RIGHT_HOR) * z) * CW
  return right - left
}

/**
 * Dadas las coordenadas de pantalla (x,y) y una profundidad z,
 * devuelve el valor normalizado de pista (-1 a 1)
 */
export function screenToLane(x: number, z: number): number {
  const lx = roadXAt(-1, z)
  const rx = roadXAt(1, z)
  return ((x - lx) / (rx - lx)) * 2 - 1
}