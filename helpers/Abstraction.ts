import { Cell as LuxCell, City, Game, Position, Unit } from '@lux-ai/2021-challenge'
import { ChildProcess } from 'child_process'
import { Cell } from '../lux/Cell'
import GAME_CONSTANTS from '../lux/game_constants.json'
import cloneGame from './clone-game'
import { getClusters } from './Cluster'
import Convert from './Convert'
import getGameResults from './getGameResults'
import { countCityTiles, isNight, otherTeam } from './helpers'
import { chooseRandom } from './util'
import uuid from './uuid'

function distanceTo(position: Position, target: Position): number {
  return Math.abs(target.x - position.x) + Math.abs(target.y - position.y)
}

export type AbstractGameAction = {
  type: 'bcity' | 'refuel'
  unit: string
  target: Position
  duration: number
  city?: string
  waypoint?: Position
}

export class AbstractGameNode {
  // game: Game
  team: 0 | 1
  parent: AbstractGameNode | undefined
  children: AbstractGameNode[] = []
  action: AbstractGameAction | undefined
  plays: number = 0
  wins: number = 0
  turn: number
  terminal: boolean = false
  cityTiles: [number, number] = [0, 0]

  /** `∀ u ∈ units (u.turn <= game.turn)` */
  units: UnitLocalState[]

  constructor(turn: number, units: UnitLocalState[] = [], team: 0 | 1, action: AbstractGameAction) {
    // this.game = game
    this.turn = turn
    this.units = units
    this.team = team
    this.action = action
  }

  /** Recursively renders this node and all its children to a partial DOT graphviz representation */
  render(parent_uuid?: string) {
    let result = ''
    if (!parent_uuid) parent_uuid = uuid()

    let label = ''
    if (this.turn)
      label += `Turn ${this.turn}<br/>`
    if (!this.parent)
      label += 'root\<br/>'
    if (this.action)
      label += `Action: ${this.action.unit} ${this.action.type} ${this.action.target.x} ${this.action.target.y}<br/>`
    label += `<b>${this.wins}/${this.plays}</b>`

    result += `  ${parent_uuid} [label=<${label}>]\n`

    this.children.forEach(child => {
      const child_uuid = uuid()
      result += `  ${parent_uuid} -- ${child_uuid}\n`
      result += child.render(child_uuid)
    })

    return result
  }

  toString(): string {
    let result = ''
    // const units = this.units.map(unit => `{x: ${unit.pos.x}, y: ${unit.pos.y}, turn: ${unit.turn}}`).join(', ')
    // result += `Units (${this.units.length}): ${units}\n`
    if (this.action) 
      result += `Action: ${this.action.unit} ${this.action.type} ${this.action.target.x} ${this.action.target.y}\n`
    result += `Units: ${this.units.length}\n`
    result += `Team: ${this.team}\n`
    result += `Turn: ${this.turn}\n`
    result += `Citytiles: ${this.cityTiles[0]}-${this.cityTiles[1]} \n`
    result += `Children: ${this.children.length}\n`
    result += `Eval: ${this.wins}/${this.plays} (${Math.round((this.wins/this.plays) * 100)}%)`
    return result
  }

  generateEndgameNode(game: Game): AbstractGameNode {
    if (gameOver(game)) {
      this.terminal = true
      return this
    }

    const gameCopy = cloneGame(game)
    Abstraction.advanceGameToTurn(gameCopy, 360)
    const newNode = new AbstractGameNode(gameCopy.state.turn, this.units, otherTeam(this.team), undefined)
    newNode.cityTiles[0] = countCityTiles(gameCopy, 0)
    newNode.cityTiles[1] = countCityTiles(gameCopy, 1)
    newNode.terminal = true
    this.addChild(newNode)
    return newNode
  }

  generateRefuelNode(game: Game, cityId: string, team: 0 | 1 = otherTeam(this.team)): { node: AbstractGameNode, game: Game } | undefined {
    const city = Array.from(game.cities.values()).find(c => c.id === cityId)
    const units = this.units.filter(u => u.team === team)

    let earliestCompletion = Infinity
    let earliestUnit: UnitLocalState | undefined
    let earliestGame: Game | undefined
    let earliestDuration = Infinity
    let earliestCityPos: Position = undefined

    for (const unit of units) {
      const gameCopy = cloneGame(game)
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

    if (!earliestUnit) return
    const newUnits = this.units.filter(u => u.id !== earliestUnit.id)
    newUnits.push(earliestUnit)

    const action: AbstractGameAction = {
      unit: earliestUnit.id,
      city: city.id,
      type: 'refuel',
      target: earliestCityPos,
      duration: earliestDuration,
    }

    const newNode = new AbstractGameNode(earliestGame.state.turn, newUnits, earliestUnit.team, action)
    newNode.cityTiles[0] = countCityTiles(earliestGame, 0)
    newNode.cityTiles[1] = countCityTiles(earliestGame, 1)
    // this.addChild(newNode)
    return {
      node: newNode,
      game: earliestGame,
    }
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
  generateBuildCityNode(game: Game, cityPos: Position, team: 0 | 1 = otherTeam(this.team)): { node: AbstractGameNode, game: Game } | undefined {
    const units = this.units.filter(u => u.team === team)
    let earliestCompletion = Infinity
    let earliestUnit: UnitLocalState | undefined
    let earliestGame: Game | undefined
    let earliestDuration = Infinity

    for (const unit of units) {
      const gameCopy = cloneGame(game)
      const newUnit = Abstraction.simulateBuildingCity(cityPos, unit, gameCopy)
      if (newUnit.turn < earliestCompletion) {
        earliestCompletion = newUnit.turn
        earliestUnit = newUnit
        earliestGame = gameCopy
        earliestDuration = newUnit.turn - unit.turn
      }
    }

    if (!earliestUnit) return
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

    const newNode = new AbstractGameNode(earliestGame.state.turn, newUnits, earliestUnit.team, action)
    newNode.cityTiles[0] = countCityTiles(earliestGame, 0)
    newNode.cityTiles[1] = countCityTiles(earliestGame, 1)
    // this.addChild(newNode)
    return {
      node: newNode,
      game: earliestGame,
    }
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
    const node = new AbstractGameNode(game.state.turn, unitStates, team, undefined)
    node.cityTiles[0] = countCityTiles(game, 0)
    node.cityTiles[1] = countCityTiles(game, 1)
    return node
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
   * - Research point gen
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
  
    // Assumes constant research point rate and ignores cost of spawning units
    for (const team of [0, 1]) {
      const teamState: Game.TeamState = game.state.teamStates[team]
      teamState.researchPoints += countCityTiles(game, team as 0 | 1) * numTurns / 10
      if (teamState.researchPoints >= GAME_CONSTANTS.PARAMETERS.RESEARCH_REQUIREMENTS.COAL)
        teamState.researched.coal = true
      if (teamState.researchPoints >= GAME_CONSTANTS.PARAMETERS.RESEARCH_REQUIREMENTS.URANIUM)
        teamState.researched.uranium = true
    }

    game.state.turn = turn
  }

  static getAllPerimeterCells(game: Game, team: 0 | 1) {
    const gameState = Convert.toGameState(game, team)
    const teamState = game.state.teamStates[team]
    const clusters = getClusters(gameState.map)
      .filter(cluster => teamState.researched[cluster.type]) // only clusters of a researched resource type
    const perimeter: Cell[] = []
    clusters
      .flatMap(c => c.getPerimeter(gameState.map))
      .forEach(c => {
        if (!perimeter.find(p => p.pos.equals(c.pos)))
          perimeter.push(c)
      })
    return perimeter
  }

  /** Expands every possible child node */
  static expansion(game: Game, node: AbstractGameNode) {
    if (node.children.length > 0) return
    const team = otherTeam(node.team)
    const newCityPositions = Abstraction.getAllPerimeterCells(game, team).map(c => c.pos)

    newCityPositions.forEach(cityPos => node.generateBuildCityNode(game, cityPos))
    Array.from(game.cities.values()).forEach(city => node.generateRefuelNode(game, city.id, team))

    if (node.children.length === 0 && game.state.turn < 360)
      node.generateEndgameNode(game)
  }

  /**
   * Selects a random child node of the given node,
   * generating a new one if necessary
   */
  static randomChild(game: Game, node: AbstractGameNode): { node: AbstractGameNode, game: Game } | null {
    const team = otherTeam(node.team)
    const newCityPositions = Abstraction.getAllPerimeterCells(game, team).map(c => c.pos)
    const cities = Array.from(game.cities.values()).filter(c => c.team === team)

    const possibleActions: AbstractGameAction[] = [
      ...newCityPositions.map(pos => ({
        type: 'bcity',
        target: pos,
        duration: undefined,
        unit: undefined,
      } as AbstractGameAction)),
      ...cities.map(c => ({
        type: 'refuel',
        city: c.id,
        target: undefined,
        unit: undefined,
        duration: undefined,
      } as AbstractGameAction))
    ]

    if (possibleActions.length === 0) return null

    const chosenAction = chooseRandom(possibleActions)

    const existingNode = node.children.find(c => c.action
        && c.action.type === chosenAction.type
        && (
          (chosenAction.city && c.action.city === chosenAction.city)
          || (chosenAction.target && c.action.target.equals(chosenAction.target))
        )
      )

    let newChild: { node: AbstractGameNode, game: Game }
    if (chosenAction.type === 'bcity')
      newChild = node.generateBuildCityNode(game, chosenAction.target)
    else if (chosenAction.type === 'refuel')
      newChild = node.generateRefuelNode(game, chosenAction.city)

    if (!newChild) return null

    if (existingNode)
      newChild.node = existingNode
    else
      node.addChild(newChild.node)

    return newChild
  }

  /**
   * Do a full light playout, recursively generating
   * children and then choosing a random one to expand again,
   * until no more moves can be found for any unit.
   */
  static expandLightPlayout(game: Game, root: AbstractGameNode): {depth: number, value: number} {
   
    let node = root
    let depth = 0
    let curGame = game
    while (node && !node.terminal) {
      depth++
      const child = Abstraction.randomChild(curGame, node)
      if (!child) break
      node = child.node
      curGame = child.game
    }

    if (curGame.state.turn < 360)
      node = node.generateEndgameNode(curGame)

    const value = Abstraction.getGameValue(curGame, node.team)
    Abstraction.backpropagation(node, value)

    return { depth, value }
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

  static renderGraphViz(root: AbstractGameNode) {
    let result = 'graph {\n'
    result += `  node [shape=circle fontname="CMU Serif"]\n`
    result += root.render()
    result += '}\n'
    return result
  }
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