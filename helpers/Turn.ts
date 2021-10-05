import { Game, Position } from '@lux-ai/2021-challenge'
import { GameState } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import { GameMap } from '../lux/GameMap'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Player } from '../lux/Player'
import { Unit } from '../lux/Unit'
import Cluster, { getClusters } from './Cluster'
import Convert from './Convert'
import Director from './Director'
import { getPerpendicularDirections, getResources } from './helpers'

export default class Turn {
  gameState: GameState
  actions: string[]
  otherUnitMoves: Position[]
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

  /** Reinitialize existing Turn object from given GameState */
  setFromGameState(gameState: GameState) {
    this.gameState = gameState
    this.actions = []
    this.otherUnitMoves = []
    this.player = gameState.players[gameState.id]
    this.opponent = gameState.players[(gameState.id + 1) % 2]
    this.gameMap = gameState.map
    this.resourceTiles = getResources(gameState.map)
    this.clusters = getClusters(this.gameMap)
    this.director = new Director()
    this.director.setClusters(this.clusters)
  }

  getClosestResourceTile(unit: Unit): Cell | null {
    let closestResourceTile: Cell = null
    let closestDist = 9999999
    this.resourceTiles.forEach((cell) => {
      if (cell.resource.type === GAME_CONSTANTS.RESOURCE_TYPES.COAL && !this.player.researchedCoal()) return
      if (cell.resource.type === GAME_CONSTANTS.RESOURCE_TYPES.URANIUM && !this.player.researchedUranium()) return
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

  wait(unit: Unit){
    this.otherUnitMoves.push(unit.pos)
    return unit.move('center') // instead of adding it directly to actions
  }

  moveUnit(unit: Unit, dir: string): string {
    this.otherUnitMoves.push(unit.pos.translate(dir, 1))
    return unit.move(dir)
  }

  moveWithCollisionAvoidance(unit: Unit, dir: string): string {
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

  gatherClosestResource(unit: Unit): string {
    let closestResourceTile = this.director.getClosestResourceTile(this.resourceTiles, this.player, unit)
    if (closestResourceTile === null) closestResourceTile = this.getClosestResourceTile(unit)
    if (closestResourceTile === null) return
    this.director.resourcePlans.push(closestResourceTile.pos)
    const dir = unit.pos.directionTo(closestResourceTile.pos)
    return this.moveWithCollisionAvoidance(unit, dir)
  }
}