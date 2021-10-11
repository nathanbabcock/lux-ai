import { Position } from '../lux/Position'

export interface Equalable<T> {
  equals(other: T): boolean
}

export class PositionActionState implements Equalable<PositionActionState> {
  pos: Position
  canAct: boolean

  constructor(pos: Position, canAct: boolean) {
    this.pos = pos
    this.canAct = canAct
  }

  equals(other: PositionActionState): boolean {
    return this.pos.equals(other.pos) && this.canAct === other.canAct
  }
}

/** An array-backed mapping from unique {@link Position} representations
 * to a number (used for tracking fScores and gScores)
 * @todo rather than a separate map, we could build a state-action graph
 * with immediate f and g scores
 */
 export class UniqueMap<T extends Equalable<any>> {
  data: {
    key: T,
    value: number,
  }[] = []

  get(pos: T): number {
    const existing = this.data.find(node => node.key.equals(pos))
    if (!existing) return undefined
    return existing.value
  }

  has(pos: T): boolean {
    const existing = this.data.find(node => node.key.equals(pos))
    return !!existing
  }

  set(pos: T, score: number): void {
    const existing = this.data.find(node => node.key.equals(pos))
    if (existing) existing.value = score
    else this.data.push({key: pos, value: score})
  }
}