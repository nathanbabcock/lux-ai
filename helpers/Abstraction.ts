import { Cell, Game, Position } from '@lux-ai/2021-challenge'
import GAME_CONSTANTS from '../lux/game_constants.json'
import cloneGame from './clone-game'

function distanceTo(position: Position, target: Position): number {
  return Math.abs(target.x - position.x) + Math.abs(target.y - position.y)
}

export class AbstractGameNode {
  game: Game
  
  /** `∀ u ∈ units (u.turn <= game.turn)` */
  units: UnitLocalState[]

  parent: AbstractGameNode | undefined

  children: AbstractGameNode[] = []

  constructor(game: Game, units: UnitLocalState[] = []) {
    this.game = game
    this.units = units
  }

  toString(team: 0 | 1): string {
    let result = ''
    // const units = this.units.map(unit => `{x: ${unit.pos.x}, y: ${unit.pos.y}, turn: ${unit.turn}}`).join(', ')
    // result += `Units (${this.units.length}): ${units}\n`
    result += `Units: ${this.units.length}\n`
    result += `Turn: ${this.game.state.turn}\n`
    result += `Citytiles: ${countCityTiles(this.game, team)}\n`
    result += `Children: ${this.children.length}\n`
    return result
  }

  /**
   * Creates all possible children nodes and adds them to `this.children`.
   * Each child uses the unit which will complete the task on the earliest possible turn.
   * Analagous to "move generation" in chess AI.
   * 
   * @param {Position[]} nextCityPositions The list of potential cities to choose from. Exactly one child will be created per position
   * @performance O(units * destinations); polynomial time
   * @returns the created children
   */
  generateChildren(nextCityPositions: Position[]): AbstractGameNode[] {
    for (const cityPos of nextCityPositions) {
      let earliestCompletion = Infinity
      let earliestUnit: UnitLocalState | undefined
      let earliestGame: Game | undefined

      for (const unit of this.units) {
        const gameCopy = cloneGame(this.game)
        const newUnit = Abstraction.simulateBuildingCity(cityPos, unit, gameCopy)
        if (newUnit.turn < earliestCompletion) {
          earliestCompletion = newUnit.turn
          earliestUnit = newUnit
          earliestGame = gameCopy
        }
      }

      if (!earliestUnit) continue
      const newUnits = this.units.filter(u => u.id !== earliestUnit.id)

      // Spawn a new unit from the new city, if possible
      // TODO should we instead choose which city to spawn the unit from?
      if (countCityTiles(earliestGame, earliestUnit.team) > this.units.length) {
        const worker = earliestGame.spawnWorker(earliestUnit.team, cityPos.x, cityPos.y)
        earliestGame.state.turn = Math.max(earliestGame.state.turn, earliestUnit.turn + 1) // Take one more turn to spawn the worker
        const newUnit: UnitLocalState = {
          pos: worker.pos,
          turn: earliestUnit.turn + 1,
          team: worker.team,
          id: worker.id,
        }

        newUnits.push(newUnit)
      }

      const newNode = new AbstractGameNode(earliestGame, [...newUnits, earliestUnit])
      this.addChild(newNode)
    }
    return this.children
  }

  static fromGame(game: Game, team: 0 | 1): AbstractGameNode {
    const units = Array.from(game.state.teamStates[team].units.values())
    const unitStates = units.map(u => ({
      id: u.id,
      team: u.team,
      pos: u.pos,
      turn: game.state.turn,
    }))
    return new AbstractGameNode(game, unitStates)
  }

  addChild(child: AbstractGameNode) {
    child.parent = this
    this.children.push(child)
  }
}

/** Unit location in space *and time (!)* */
export type UnitLocalState = {
  id: string
  team: 0 | 1
  pos: Position
  turn: number
}

/**
 * This class will hold simulation code for a
 * higher-level view of the gameplay, looking only
 * at citytile locations and resulting changes in gamestate.
 * Units will be teleported around accordingly, resources costs
 * will be estimated and deducted, and the day/night cycle will
 * be kept track of.
 * 
 * Tree search (MCTS or alpha-beta) will be used,
 * possibly in combination with RL for gamestate evaluation.
 */
export default class Abstraction {
  /**
   * @param game `game` modified in place (including `game.state.turn`, resources collected, and citytiles built)
   * @returns a the updated state of the {@link UnitLocalState} used to make the move, plus a newly created one if applicable
   */
  static simulateBuildingCity(cityPos: Position, unit: UnitLocalState, game: Game): UnitLocalState | undefined {
    const teamState = game.state.teamStates[unit.team]
    const map = game.map

    const cityCell = map.getCellByPos(cityPos)
    if (cityCell.citytile) return undefined

    const resources = map.resources
    let closestResource: Cell | undefined
    let closestResourceDist = Infinity
    for (const cell of resources) {
      if (cell.resource.type === 'coal' && !teamState.researched.coal) continue
      if (cell.resource.type === 'uranium' && !teamState.researched.wood) continue
      const dist = distanceTo(cell.pos, cityPos)
      if (dist < closestResourceDist) {
        closestResource = cell
        closestResourceDist = dist
      }
    }

    if (!closestResource) return undefined

    const unitDist = distanceTo(unit.pos, closestResource.pos)
    let turnCost = (unitDist + closestResourceDist) * 2
    closestResource.resource.amount = Math.max(closestResource.resource.amount - 100, 0)
    game.spawnCityTile(unit.team, cityPos.x, cityPos.y)

    const updatedUnit: UnitLocalState = {
      pos: cityPos,
      turn: unit.turn + turnCost,
      team: unit.team,
      id: unit.id,
    }
    
    game.state.turn = Math.max(game.state.turn, unit.turn + turnCost)
    return updatedUnit
  }
}

export function isNight(turn: number): boolean {
  const dayLength = GAME_CONSTANTS.PARAMETERS.DAY_LENGTH
  const cycleLength = dayLength + GAME_CONSTANTS.PARAMETERS.NIGHT_LENGTH
  return turn % cycleLength >= dayLength
}

export function countCityTiles(game: Game, team: 0 | 1) {
  const cityTileCount = [0, 0]
  game.cities.forEach((city) => {
    cityTileCount[city.team] += city.citycells.length
  })
  return cityTileCount[team]
}
