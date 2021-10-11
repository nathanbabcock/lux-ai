import { Position } from '../lux/Position'

/**
 * Represents a node in a State-Action graph,
 * probably a relevant subset of a full {@link GameState}
 */
export abstract class StateNode {
  cameFrom?: StateNode
  action?: string
  abstract equals(other: StateNode): boolean
}

export class MovementState extends StateNode {
  constructor(
    public pos: Position,
    public canAct: boolean,
    public turn: number = -1,
  ) { super() }

  equals(other: MovementState): boolean {
    return this.pos.equals(other.pos) && this.canAct === other.canAct
  }
}

/**
 * An array-backed mapping from unique {@link StateNode} representations
 * to a number (used for tracking fScores and gScores)
 * @todo rather than a separate map, we could instead build a state-action graph with immediate f and g scores
 * @todo array is an inefficient data structure for this, should use a hashmap instead
 */
export class StateMap<T extends StateNode> {
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