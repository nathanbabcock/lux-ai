import { Position } from '../lux/Position'
import { KaggleReplay } from '../helpers/KaggleReplay'
import { SerializedState } from '@lux-ai/2021-challenge'

export type UnitAttribution = {
  /** CityTile which birthed this lad */
  parent: CityTileAttribution | null
  reward: number
  id: string
}

export type CityTileAttribution = {
  /** Unit id who founded this city */
  parent: UnitAttribution | null
  reward: number
  pos: Position
  id: string
  // cityId: string
}

export class AttributionGraph {
  units: {
    [unitId: string]: UnitAttribution
  } = {}

  cityTiles: {
    [cityTileId: string]: CityTileAttribution
  } = {}

  nextCityTileId: number = 0

  print() {
    console.log('Units:')
    for (const unitId in this.units) {
      const unit = this.units[unitId]
      console.log(`• ${unitId}: parent = ${unit.parent === null ? 'null' : unit.parent.id}, reward = ${unit.reward}`)
    }

    console.log('CityTiles:')
    for (const cityTileId in this.cityTiles) {
      const cityTile = this.cityTiles[cityTileId]
      console.log(`• ${cityTileId} (${cityTile.pos.x}, ${cityTile.pos.y}): parent = ${cityTile.parent === null ? 'null' : cityTile.parent.id}, reward = ${cityTile.reward}`)
    }
  }

  /**
   * Since citytile IDs are artificial,
   * use this method to find one by position
   * 
   * In the case of multiple citytiles re-built on the same position,
   * it chooses the latest added one (i.e. the one with the highest id)
   */
  getCityTile(x: number, y: number): CityTileAttribution | null {
    return Object.values(this.cityTiles).reverse().find(citytile => citytile.pos.x === x && citytile.pos.y === y)
  }
}

export default class CreditAssignment {
  static computeStep(
    step: KaggleReplay['steps'][number],
    serializedState: SerializedState,
    graph: AttributionGraph,
  ): void {
    for (const playerTurn of step) {
      for (const action of playerTurn.action) {
        const parts = action.split(' ')

        // Attribution for city
        if (parts[0] === 'bcity') {
          const cityTileId = `ct_${graph.nextCityTileId++}`
          const parentId = parts[1]
          let parent = graph.units[parentId]
          if (!parent) {
            parent = graph.units[parentId] = {
              parent: null,
              reward: 0,
              id: parentId,
            }
          }

          const parentUnit = serializedState.teamStates[0].units[parentId] || serializedState.teamStates[1].units[parentId]
          if (!parentUnit) throw new Error(`Could not find parent unit ${parentId}`)

          graph.cityTiles[cityTileId] = {
            parent,
            reward: 0,
            pos: new Position(parentUnit.x, parentUnit.y),
            id:cityTileId
          }
        }

        // Attribution for unit (worker)
        if (parts[0] === 'bw') {
          const x = parseInt(parts[1])
          const y = parseInt(parts[2])

          const teamStates = [serializedState.teamStates[0], serializedState.teamStates[1]]
          const units = teamStates.flatMap(teamState => Object.entries(teamState.units))
          const unitEntry = units.find(([, unit]) => unit.x === x && unit.y === y)
          if (!unitEntry) throw new Error(`Could not find unit at ${x}, ${y}`)

          const unitId = unitEntry[0]

          let cityTile = graph.getCityTile(x, y)
          if (!cityTile) {
            const cityTileId = `ct_${graph.nextCityTileId++}`
            cityTile = graph.cityTiles[cityTileId] = {
              parent: null,
              reward: 0,
              pos: new Position(x, y),
              id: cityTileId,
            }
          }
          if (!cityTile) throw new Error(`Could not find or create cityTile at ${x}, ${y}`)

          graph.units[unitId] = {
            parent: cityTile,
            reward: 0,
            id: unitId,
          }
        }
      }
    }
  }

  /**
   * Given the very last state in a game (and assuming game over),
   * assign reward = 1 to each citytile remaining,
   * and propagate the reward up the attribution tree.
   */
  static backPropagation(serializedState: SerializedState, graph: AttributionGraph): void {
    const cityTiles = Object.values(serializedState.cities).flatMap(city => city.cityCells)

    for (const cityTile of cityTiles) {
      let cityTileAttribution = graph.getCityTile(cityTile.x, cityTile.y)
      if (!cityTileAttribution) {
        console.warn(`Couldn't find any attribution for city tile @ ${cityTile.x}, ${cityTile.y}`)
        continue
      }
      const reward = 1
      let cur: CityTileAttribution | UnitAttribution = cityTileAttribution
      while (cur) {
        cur.reward += reward
        cur = cur.parent
      }
    }
  }
}

// "get the most recent citytile with pos x, y"