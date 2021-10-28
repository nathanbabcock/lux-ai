import { getNeighbors } from '../helpers/helpers'
import Turn from '../helpers/Turn'
import { Position } from '../lux/Position'
import Guard from './Guard'

/** Stay in one spot and constantly mine materials */
export default class Miner extends Guard {
  constructor(target: Position) {
    super(target)
    this.type = 'miner'
  }

  static getAssignments(turn: Turn): Miner[] {
    const assignments: Miner[] = []
    for (const [cityId, city] of turn.player.cities) {
      for (const citytile of city.citytiles) {
        const cell = turn.map.getCellByPos(citytile.pos)
        const adjacent = getNeighbors(cell, turn.map)
        for (const neighbor of adjacent) {
          if (!neighbor.resource || neighbor.resource.amount === 0) continue
          const hasCoal = neighbor.resource.type === 'coal' && turn.player.researchedCoal()
          const hasUranium = neighbor.resource.type === 'uranium' && turn.player.researchedUranium()
          if (!hasCoal && !hasUranium) continue
          const miner = new Miner(citytile.pos)
          assignments.push(miner)
          break
        }
      }
    }
    return assignments
  }
}