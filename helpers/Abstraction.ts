import { Cell as LuxCell, City, Game, Position, Unit } from '@lux-ai/2021-challenge'
import { ChildProcess } from 'child_process'
import { Cell } from '../lux/Cell'
import GAME_CONSTANTS from '../lux/game_constants.json'
import cloneGame from './clone-game'
import { getClusters } from './Cluster'
import Convert from './Convert'
import getGameResults from './getGameResults'
import { otherTeam } from './helpers'
import { chooseRandom } from './util'

function distanceTo(position: Position, target: Position): number {
  return Math.abs(target.x - position.x) + Math.abs(target.y - position.y)
}

export type AbstractGameAction = {
  type: 'bcity' | 'refuel'
  unit: string
  target: Position
  waypoint?: Position
  duration: number
}

export class AbstractGameNode {
  game: Game
  team: 0 | 1
  parent: AbstractGameNode | undefined
  children: AbstractGameNode[] = []
  action: AbstractGameAction | undefined
  plays: number = 0
  wins: number = 0

  /** `∀ u ∈ units (u.turn <= game.turn)` */
  units: UnitLocalState[]

  constructor(game: Game, units: UnitLocalState[] = [], team: 0 | 1, action: AbstractGameAction) {
    this.game = game
    this.units = units
    this.team = team
    this.action = action
  }

  toString(): string {
    let result = ''
    // const units = this.units.map(unit => `{x: ${unit.pos.x}, y: ${unit.pos.y}, turn: ${unit.turn}}`).join(', ')
    // result += `Units (${this.units.length}): ${units}\n`
    if (this.action) 
      result += `Action: ${this.action.unit} ${this.action.type} ${this.action.target.x} ${this.action.target.y}\n`
    result += `Units: ${this.units.length}\n`
    result += `Team: ${this.team}\n`
    result += `Turn: ${this.game.state.turn}\n`
    result += `Citytiles: ${countCityTiles(this.game, 0)}-${countCityTiles(this.game, 1)} \n`
    result += `Children: ${this.children.length}\n`
    return result
  }

  generateEndgameNode(): AbstractGameNode {
    if (this.game.state.turn >= 360) return this

    const gameCopy = cloneGame(this.game)
    Abstraction.advanceGameToTurn(gameCopy, 360)
    const newNode = new AbstractGameNode(gameCopy, this.units, otherTeam(this.team), undefined)
    this.addChild(newNode)
  }

  generateRefuelNodes(team: 0 | 1 = otherTeam(this.team)): AbstractGameNode[] {
    const cities = Array.from(this.game.cities)
      .filter(([_, city]) => city.team === team)
      .map(([_, city]) => city)
    const units = this.units.filter(u => u.team === team)

    for (const city of cities) {
      let earliestCompletion = Infinity
      let earliestUnit: UnitLocalState | undefined
      let earliestGame: Game | undefined
      let earliestDuration = Infinity
      let earliestCityPos: Position = undefined

      for (const unit of units) {
        const gameCopy = cloneGame(this.game)
        const refuel = Abstraction.simulateRefuel(city, unit, gameCopy)
        if (!refuel) continue

        const newUnit = refuel.unit
        const cityPos = refuel.cityPos
        if (newUnit.turn < earliestCompletion) {
          earliestCompletion = newUnit.turn
          earliestUnit = newUnit
          earliestGame = gameCopy
          earliestDuration = newUnit.turn - unit.turn
          earliestCityPos = cityPos
        }
      }

      if (!earliestUnit) continue
      const newUnits = this.units.filter(u => u.id !== earliestUnit.id)
      newUnits.push(earliestUnit)

      const action: AbstractGameAction = {
        unit: earliestUnit.id,
        type: 'refuel',
        target: earliestCityPos,
        duration: earliestDuration,
      }

      const newNode = new AbstractGameNode(earliestGame, newUnits, earliestUnit.team, action)
      this.addChild(newNode)
    }
    return this.children
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
  generateBuildCityNodes(nextCityPositions: Position[], team: 0 | 1 = otherTeam(this.team)): AbstractGameNode[] {
    const units = this.units.filter(u => u.team === team)
    for (const cityPos of nextCityPositions) {
      let earliestCompletion = Infinity
      let earliestUnit: UnitLocalState | undefined
      let earliestGame: Game | undefined
      let earliestDuration = Infinity

      for (const unit of units) {
        const gameCopy = cloneGame(this.game)
        const newUnit = Abstraction.simulateBuildingCity(cityPos, unit, gameCopy)
        if (newUnit.turn < earliestCompletion) {
          earliestCompletion = newUnit.turn
          earliestUnit = newUnit
          earliestGame = gameCopy
          earliestDuration = newUnit.turn - unit.turn
        }
      }

      if (!earliestUnit) continue
      const newUnits = this.units.filter(u => u.id !== earliestUnit.id)
      newUnits.push(earliestUnit)

      // Spawn a new unit from the new city, if possible
      // TODO should we instead choose which city to spawn the unit from?
      if (countCityTiles(earliestGame, earliestUnit.team) > this.units.filter(u => u.team === earliestUnit.team).length) {
        const worker = earliestGame.spawnWorker(earliestUnit.team, cityPos.x, cityPos.y)

        Abstraction.advanceGameToTurn(earliestGame, earliestUnit.turn + 1) // Take one more turn to spawn the worker
        // earliestGame.state.turn = Math.max(earliestGame.state.turn, earliestUnit.turn + 1) 
        
        const newUnit: UnitLocalState = {
          pos: worker.pos,
          turn: earliestUnit.turn + 1,
          team: worker.team,
          id: worker.id,
        }

        newUnits.push(newUnit)
      }

      const action: AbstractGameAction = {
        unit: earliestUnit.id,
        type: 'bcity',
        target: cityPos,
        duration: earliestDuration,
      }

      const newNode = new AbstractGameNode(earliestGame, newUnits, earliestUnit.team, action)
      this.addChild(newNode)
    }
    return this.children
  }

  static fromGame(game: Game, team: 0 | 1): AbstractGameNode {
    const units = [
      ...Array.from(game.state.teamStates[0].units.values()),
      ...Array.from(game.state.teamStates[1].units.values()),
    ]
    const unitStates = units.map(u => ({
      id: u.id,
      team: u.team,
      pos: u.pos,
      turn: game.state.turn,
    }))
    return new AbstractGameNode(game, unitStates, team, undefined)
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
  static simulateRefuel(city: City, unit: UnitLocalState, game: Game): { unit: UnitLocalState, cityPos: Position, resourcePos: Position } | undefined {
    let avgCityPos = new Position(0, 0)
    city.citycells.forEach(c => {
      avgCityPos.x += c.pos.x
      avgCityPos.y += c.pos.y
    })
    avgCityPos.x /= city.citycells.length
    avgCityPos.y /= city.citycells.length

    const teamState = game.state.teamStates[unit.team]
    const map = game.map
    const resources = map.resources
    let closestResource: LuxCell | undefined
    let closestResourceDist = Infinity
    for (const cell of resources) {
      if (cell.resource.type === 'coal' && !teamState.researched.coal) continue
      if (cell.resource.type === 'uranium' && !teamState.researched.wood) continue
      if (cell.resource.amount <= 0) continue
      const dist = distanceTo(cell.pos, avgCityPos)
      if (dist < closestResourceDist) {
        closestResource = cell
        closestResourceDist = dist
      }
    }

    if (!closestResource) return undefined

    const unitDist = distanceTo(unit.pos, closestResource.pos)
    let turnCost = (unitDist + closestResourceDist) * 2
    closestResource.resource.amount = Math.max(closestResource.resource.amount - 100, 0)

    let closestCityCell = undefined
    let closestCityCellDist = Infinity
    for (const cell of city.citycells) {
      const dist = distanceTo(cell.pos, closestResource.pos)
      if (dist < closestCityCellDist) {
        closestCityCell = cell
        closestCityCellDist = dist
      }
    }

    const gameUnit = teamState.units.get(unit.id)
    gameUnit.pos = closestCityCell.pos
    gameUnit.cargo[closestResource.resource.type] = 100 // This is gonna be most accurate for wood, and least for uranium
    game.handleResourceDeposit(gameUnit)

    const updatedUnit: UnitLocalState = {
      pos: closestCityCell.pos,
      turn: unit.turn + turnCost,
      team: unit.team,
      id: unit.id,
    }
    
    Abstraction.advanceGameToTurn(game, unit.turn + turnCost)
    return {
      unit: updatedUnit,
      resourcePos: closestResource.pos,
      cityPos: closestCityCell.pos,
    }
  }

  /**
   * @param game `game` modified in place (including `game.state.turn`, resources collected, and citytiles built)
   * @returns the updated state of the {@link UnitLocalState} used to make the move
   */
  static simulateBuildingCity(cityPos: Position, unit: UnitLocalState, game: Game): UnitLocalState | undefined {
    const teamState = game.state.teamStates[unit.team]
    const map = game.map

    const cityCell = map.getCellByPos(cityPos)
    if (cityCell.citytile) return undefined

    const resources = map.resources
    let closestResource: LuxCell | undefined
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
    
    Abstraction.advanceGameToTurn(game, unit.turn + turnCost)
    return updatedUnit
  }

  /**
   * Handles updating a gamestate to skip ahead ("time-travel") to some future turn.
   * 
   * Currently handles ONLY:
   * - City light upkeep and destruction
   * 
   * Ignored or not handled:
   * - Unit upkeep and death
   * - Cooldowns
   * - Variance in resource levels or upkeep requirement during a single invocation
   *   (since the whole point is to batch it and get a rough estimate)
   * 
   * Possible future TODO:
   * - Tree regrowth
   * 
   * @source F:\git\Lux-Design-2021\src\logic.ts:461
   * @param game 
   * @param turn 
   */
   static advanceGameToTurn(game: Game, turn: number) {
    const startTurn = game.state.turn
    const numTurns = turn - startTurn
    if (numTurns <= 0) return

    // calculate number of turns which are at night
    let numNightTurns = 0
    for (let curTurn = startTurn; curTurn < turn; curTurn++) {
      if (isNight(curTurn))
        numNightTurns++
    }

    game.cities.forEach((city) => {
      const upkeep = city.getLightUpkeep() * numNightTurns
      if (city.fuel < upkeep)
        game.destroyCity(city.id)
      else
        city.fuel -= upkeep
    })

    game.state.turn = turn
  }

  static getAllPerimeterCells(game: Game) {
    const gameState = Convert.toGameState(game, 0)
    const clusters = getClusters(gameState.map)
    const perimeter: Cell[] = []
    clusters
      .flatMap(c => c.getPerimeter(gameState.map))
      .forEach(c => {
        if (!perimeter.find(p => p.pos.equals(c.pos)))
          perimeter.push(c)
      })
    return perimeter
  }

  /**
   * Do a full light playout, recursively generating
   * children and then choosing a random one to expand again,
   * until no more moves can be found for any unit.
   */
  static expandLightPlayout(root: AbstractGameNode) {
    let node = root
    while (node && !gameOver(node.game)) {
      const newCityPositions = Abstraction.getAllPerimeterCells(node.game).map(c => c.pos)
      node.generateBuildCityNodes(newCityPositions)
      node.generateRefuelNodes()
      if (node.children.length === 0)
        node.generateEndgameNode()
      const child = chooseRandom(node.children)
      node = child
    }

    Abstraction.backpropagation(node, Abstraction.getGameValue(node.game, node.team))
  }

  static backpropagation(node: AbstractGameNode, value: 0 | 0.5 | 1) {
    let curNode = node
    while (curNode) {
      curNode.plays++
      if (curNode.team === node.team)
        curNode.wins += value
      else
        curNode.wins += 1 - value
      curNode = curNode.parent
    }
  }

  static getGameValue(game: Game, team: 0 | 1): 0 | 1 | 0.5 {
    const results = getGameResults(game)
    const tie = results.ranks[0].rank === results.ranks[1].rank
    if (tie)
      return 0.5
    if (results.ranks[0].agentID === team)
      return 1
    else
      return 0
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

/** @source F:\git\Lux-Design-2021\src\logic.ts */
export function gameOver(game: Game): boolean {
  if (game.state.turn >= GAME_CONSTANTS.PARAMETERS.MAX_DAYS - 1)
    return true
  
  // over if at least one team has no units left or city tiles
  const teams = [Unit.TEAM.A, Unit.TEAM.B]
  const cityCount = [0, 0]

  game.cities.forEach((city) => cityCount[city.team])

  for (const team of teams) {
    if (game.getTeamsUnits(team).size + cityCount[team] === 0)
      return true
  }
}