import { Game } from '@lux-ai/2021-challenge'
import { turn } from '../agents/tree-search'
import { annotate, GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import { GameMap } from '../lux/GameMap'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Player } from '../lux/Player'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Cluster, { getClusters } from './Cluster'
import Convert from './Convert'
import Director from './Director'
import { getPerpendicularDirections, getResourceAdjacency, getResources } from './helpers'
import { log, tryAsync } from './logging'
import Sim, { Assignments } from './Sim'
import { clone } from './util'

export default class Turn {
  gameState: GameState
  actions: string[]
  otherUnitMoves: Position[]
  cityPlans: Position[]
  player: Player
  opponent: Player
  gameMap: GameMap
  resourceTiles: Cell[]
  clusters: Cluster[]
  director: Director

  constructor(gameState: GameState) {
    this.setFromGameState(gameState)
  }

  update(game: Game) {
    const gameState = Convert.toGameState(game, this.gameState.id)
    this.setFromGameState(gameState)
  }

  sidetext(...messages: any[]) {
    this.actions.push(annotate.sidetext(`${messages.join(' ')}`))
  }

  /** Reinitialize existing Turn object from given GameState */
  setFromGameState(gameState: GameState) {
    this.gameState = gameState
    this.actions = []
    this.otherUnitMoves = []
    this.cityPlans = []
    this.player = gameState.players[gameState.id]
    this.opponent = gameState.players[(gameState.id + 1) % 2]
    this.gameMap = gameState.map
    this.resourceTiles = getResources(gameState.map)
    this.clusters = getClusters(this.gameMap)
    for (const cluster of this.clusters)
      cluster.units = cluster.getUnits(gameState)
    this.director = new Director()
    this.director.setClusters(this.clusters)
  }

  getClosestResourceTile(unit: Unit, type?: 'wood' | 'coal' | 'uranium' | undefined): Cell | null {
    let closestResourceTile: Cell = null
    let closestDist = Infinity
    this.resourceTiles.forEach((cell) => {
      if (cell.resource.type === GAME_CONSTANTS.RESOURCE_TYPES.COAL && !this.player.researchedCoal()) return
      if (cell.resource.type === GAME_CONSTANTS.RESOURCE_TYPES.URANIUM && !this.player.researchedUranium()) return
      if (type && cell.resource.type !== type) return
      const dist = cell.pos.distanceTo(unit.pos)
      if (dist < closestDist) {
        closestDist = dist
        closestResourceTile = cell
      }
    })
  
    return closestResourceTile
  }

  sidestep(unit: Unit, dir: string): string | false {
    // Move perpendicular if you're blocked
    const alternatives = getPerpendicularDirections(dir)
    for (let i = 0; i < alternatives.length; i++) {
      const alternative = alternatives[i]
      const alternativeDestination = unit.pos.translate(alternative, 1)
      if (!this.otherUnitMoves.some((pos) => pos.equals(alternativeDestination))) {
        this.otherUnitMoves.push(alternativeDestination)
        return unit.move(alternative)
      }
    }
    return false
  }

  wait(unit: Unit): undefined {
    this.otherUnitMoves.push(unit.pos)
    return undefined
    //return unit.move('center') // instead of adding it directly to actions
  }

  moveUnit(unit: Unit, dir: string): string {
    this.otherUnitMoves.push(unit.pos.translate(dir, 1))
    return unit.move(dir)
  }

  moveWithCollisionAvoidance(unit: Unit, dir: string): string | undefined {
    const destination = unit.pos.translate(dir, 1)
    const teamUnitCollision = this.otherUnitMoves
      .some((pos) => pos.equals(destination))
    const cityCollision = this.gameState.players
      .map(player => Array.from(player.cities.values())).flat() 
      .map(city => city.citytiles).flat()
      .some(citytile => citytile.pos.equals(destination))
    if (teamUnitCollision || cityCollision)
      return this.sidestep(unit, dir) || this.wait(unit)
    else
      return this.moveUnit(unit, dir)
  }

  moveTo(unit: Unit, pos: Position): string | undefined {
    const dist = pos.distanceTo(unit.pos)
    if (dist === 0 || !unit.canAct())
      return unit.move(GAME_CONSTANTS.DIRECTIONS.CENTER)
    
    const dir = unit.pos.directionTo(pos)
    return this.moveWithCollisionAvoidance(unit, dir)
  }

  gatherClosestResource(unit: Unit): string {
    if (!unit.canAct()) return this.idle(unit)
    let closestResourceTile = this.director.getClosestResourceTile(this.resourceTiles, this.player, unit)
    if (closestResourceTile === null) closestResourceTile = this.getClosestResourceTile(unit)
    if (closestResourceTile === null) return
    this.director.resourcePlans.push(closestResourceTile.pos)
    const dir = unit.pos.directionTo(closestResourceTile.pos)
    return this.moveWithCollisionAvoidance(unit, dir)
  }

  idle(unit: Unit): string {
    return this.moveWithCollisionAvoidance(unit, GAME_CONSTANTS.DIRECTIONS.CENTER)
  }

  /**
   * - Gather resources if necessary
   * - Walk to city position
   * - Build city
   */
  buildCity(unit: Unit, pos: Position): string {
    if (!unit) return
    if (!unit.canAct())
      return this.idle(unit)
    if (unit.getCargoSpaceLeft() > 0)
      return this.gatherClosestResource(unit)
    if (unit.pos.distanceTo(pos) === 0)
      return unit.buildCity()
    return this.moveTo(unit, pos)
  }

  annotateClusters(unit: Unit): string[] {
    const annotations = []
    this.clusters.forEach(cluster => {
      // actions.push(annotate.line(unit.pos.x, unit.pos.y, cluster.getCenter().x, cluster.getCenter().y))

      cluster.cells.forEach(cell => {
        annotations.push(annotate.text(cell.pos.x, cell.pos.y, `${getResourceAdjacency(cell, this.gameMap)}`))
      })

      const perimeter = cluster.getPerimeter(this.gameMap)
      perimeter.forEach(cell => {
        annotations.push(annotate.circle(cell.pos.x, cell.pos.y))
        annotations.push(annotate.text(cell.pos.x, cell.pos.y, `${getResourceAdjacency(cell, this.gameMap)}`))
      })

      const citySite = cluster.getCitySite(this.gameMap)
      if (citySite) annotations.push(annotate.line(unit.pos.x, unit.pos.y, citySite.pos.x, citySite.pos.y))
    })
    return annotations
  }

  countCities(): number {
    return Array.from(this.player.cities.entries()).length
  }

  /** Automatically build workers & research every turn */
  autoCities(): string[] {
    const actions = []
    this.player.cities.forEach((city) => {
      city.citytiles.forEach((citytile) => {
        if (citytile.cooldown >= 1) return
        if (this.player.units.length < this.player.cityTileCount)
          actions.push(citytile.buildWorker())
        else
          actions.push(citytile.research())
      })
    })
    return actions
  }

  buildClosestCity(unit: Unit): string {
    const closestEmptyTile = this.director.getClosestCityPos(this.gameState.map, unit.pos)
    if (!closestEmptyTile) {
      log('no empty tile found')
      return
    }
    this.director.cityPlans.push(closestEmptyTile.pos)
  
    if (unit.pos.distanceTo(closestEmptyTile.pos) === 0) {
      return unit.buildCity()
    } else {
      const dir = unit.pos.directionTo(closestEmptyTile.pos)
      return this.moveWithCollisionAvoidance(unit, dir)
    }
  }

  //// why
  async settlerTreeSearch(
    sim: Sim,
    assignments: Assignments = {},
    endTurn: number = -1,
    depth: number = 0,
  ): Promise<Array<string>> {
    const SIM_DURATION = 20
    const actions = this.actions
  
    actions.push(...this.autoCities())

    for (const unit of this.player.units) {
      if (!unit.canAct()) {
        actions.push(this.idle(unit))
        continue
      }
  
      if (unit.getCargoSpaceLeft() > 0) {
        actions.push(this.gatherClosestResource(unit))
        continue
      }
  
      let assignment = assignments[unit.id]
      if (assignment && this.gameMap.getCellByPos(assignment).citytile) {
        delete assignments[unit.id]
      } else if (assignment) {
        actions.push(annotate.circle(assignment.x, assignment.y))
        actions.push(this.buildCity(unit, assignment))
        continue
      }

      // no assignment -- let's initiate a search tree to find one!
      if (depth === 2) {
        log(`Tree search already went to max depth = ${depth}; building closest city`)
        this.sidetext(`Depth limit - No valid assignments found for unit ${unit.id}; building closest city instead`)
        actions.push(this.buildClosestCity(unit))
        continue
      }

      let bestScore = -1
      let bestAssignments: Assignments | null = null
      for (let i = 0; i < this.clusters.length; i++) {
        const cluster = this.clusters[i]
        log(`Simulating mission to cluster ${i} ===`)
  
        const citySite = cluster.getCitySite(this.gameMap)
        if (!citySite) {
          log(`No valid city site for cluster ${i}`)
          return
        }
  
        actions.push(annotate.line(unit.pos.x, unit.pos.y, citySite.pos.x, citySite.pos.y))
        actions.push(annotate.text(citySite.pos.x, citySite.pos.y, `#${i}`))
  
        await tryAsync(async () => {
          const simAssignments = clone(assignments)
          simAssignments[unit.id] = citySite.pos
          if (endTurn === -1) endTurn = this.gameState.turn + SIM_DURATION
          const simResults = await sim.assignments(
            simAssignments,
            sim,
            this.gameState,
            endTurn,
            depth + 1,
          )

          this.sidetext(`Cluster ${i} has score ${simResults.gameStateValue}`)

          const tieBreaker = simResults.gameStateValue === bestScore
            && bestAssignments[unit.id]
            && simResults.assignments[unit.id]
            && simResults.assignments[unit.id].distanceTo(unit.pos)
              < bestAssignments[unit.id].distanceTo(unit.pos)

          if (simResults.gameStateValue > bestScore || tieBreaker) {
            bestScore = simResults.gameStateValue
            bestAssignments = simResults.assignments
            // this.sidetext('new best assgnmnt involving units: ', Object.keys(bestAssignments).join(' '))
          }
        })
      }

      // This repeats the block from before the FOR loop -- TODO DRY?
      if (!bestAssignments) {
        this.sidetext(`No valid assignments`)
        actions.push(this.buildClosestCity(unit))
        continue
      }
      assignment = bestAssignments[unit.id]
  
      if (assignment) {
        actions.push(this.buildCity(unit, assignment))
        actions.push(annotate.circle(assignment.x, assignment.y))
        continue
      } else {
        this.sidetext(`Assignments existed, but none for unit ${unit.id}; building closest city instead`)
        actions.push(this.buildClosestCity(unit))
        continue
      }
    }
    
    return actions
  }
}