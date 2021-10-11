export interface Equalable {
  equals(other: Equalable): boolean
}

/** An array-backed mapping from unique {@link Position} representations
 * to a number (used for tracking fScores and gScores)
 * @todo rather than a separate map, we could build a state-action graph
 * with immediate f and g scores
 */
 export class UniqueMap<T extends Equalable> {
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