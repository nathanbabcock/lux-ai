import { Position } from '../lux/Position'

/** An array-backed mapping from unique {@link Position} representations
 * to a number (used for tracking fScores and gScores)
 * @todo rather than a separate map, we could build a state-action graph
 * with immediate f and g scores
 */
 export class PositionMap {
  data: {
    pos: Position,
    score: number,
  }[] = []

  get(pos: Position): number {
    const existing = this.data.find(node => node.pos.equals(pos))
    if (!existing) return undefined
    return existing.score
  }

  has(pos: Position): boolean {
    const existing = this.data.find(node => node.pos.equals(pos))
    return !!existing
  }

  set(pos: Position, score: number): void {
    const existing = this.data.find(node => node.pos.equals(pos))
    if (existing) existing.score = score
    else this.data.push({pos, score})
  }
}