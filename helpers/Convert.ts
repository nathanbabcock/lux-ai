import { Game, Resource as LuxResource, SerializedState, Unit as LuxUnit } from '@lux-ai/2021-challenge'
import { GameState } from '../lux/Agent'
import { City } from '../lux/City'
import { GameMap } from '../lux/GameMap'
import { Player } from '../lux/Player'
import { Unit } from '../lux/Unit'

export const TEAMS = [LuxUnit.TEAM.A, LuxUnit.TEAM.B]

/** Convert between different game state representations */
export default class Convert {

  /**
   * GameState => SerializedState
   * @param {GameState} gameState the simplified Typescript object model
   * @returns {SerializedState} The full internal state of the game used by the Lux AI runner
   */
  static toSerializedState(gameState: GameState): SerializedState {
    const turn: SerializedState['turn'] = gameState.turn
    const globalCityIDCount: SerializedState['globalCityIDCount'] = gameState.players.reduce((numCities, player) => numCities + player.cities.size, 0)
    const globalUnitIDCount: SerializedState['globalUnitIDCount'] = gameState.players.reduce((numUnits, player) => numUnits + player.units.length, 0)

    const teamStates: any = {}
    for (const team in LuxUnit.TEAM) {
      const teamNumber = parseInt(team)
      if (isNaN(teamNumber)) continue
      const units = {}
      gameState.players[teamNumber].units.forEach(unit => {
        const unitState: SerializedState['teamStates'][LuxUnit.TEAM]['units'][string] = {
          cargo: unit.cargo as LuxUnit.Cargo,
          cooldown: unit.cooldown,
          x: unit.pos.x,
          y: unit.pos.y,
          type: unit.type as LuxUnit.Type,
        }
        units[unit.id] = unitState
      })

      const teamState: SerializedState['teamStates'][LuxUnit.TEAM] = {
        researchPoints: gameState.players[team].researchPoints,
        units,
        researched: {
          [LuxResource.Types.WOOD]: true,
          [LuxResource.Types.COAL]: gameState.players[team].researchedCoal(),
          [LuxResource.Types.URANIUM]: gameState.players[team].researchedUranium(),
        }
      }
      teamStates[team] = teamState
    }

    const map: SerializedState['map'] = []
    for (let y = 0; y < gameState.map.height; y++) {
      const row = []
      for (let x = 0; x < gameState.map.width; x++) {
        const cell = gameState.map.getCell(x, y)
        row.push({
          road: cell.road,
          resource: cell.resource,
        })
      }
      map.push(row)
    }

    const cities: SerializedState['cities'] = {}
    gameState.players.forEach(player => {
      player.cities.forEach(city => {
        const cityCells: any = []
        city.citytiles.forEach(citytile => {
          const cityCell: SerializedState['cities'][string]['cityCells'][number] = {
            x: citytile.pos.x,
            y: citytile.pos.y,
            cooldown: citytile.cooldown,
          }
          cityCells.push(cityCell)
        })

        const cityState: SerializedState['cities'][string] = {
          cityCells,
          id: city.cityid,
          fuel: city.fuel,
          lightupkeep: city.lightUpkeep,
          team: city.team,
        }

        cities[city.cityid] = cityState
      })
    })

    const serializedState: SerializedState = {
      turn,
      globalCityIDCount,
      globalUnitIDCount,
      teamStates,
      map,
      cities,
    }

    return serializedState
  }

  /**
   * Game => GameState
   * @source Adapted from /lux/agent.ts:114 (retrieveUpdates())
   * @param {GameState} gameState (updated in place)
   * @param {Game} game (source of truth)
   */
  static updateGameState(gameState: GameState, game: Game): void {
    const map = gameState.map = new GameMap(game.map.width, game.map.height)
    gameState.players.forEach(player => {
      player.units = []
      player.cities = new Map()
      player.cityTileCount = 0
    })
    gameState.turn = game.state.turn
    gameState.seed = game.configs.seed

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = game.map.getCell(x, y)
        if (cell.resource)
          map._setResource(cell.resource.type, x, y, cell.resource.amount)
        map.getCell(x, y).road = cell.road
      }
    }

    TEAMS.forEach(team => {
      const teamState: Game.TeamState = game.state.teamStates[team]
      const player = gameState.players[team]
      player.researchPoints = teamState.researchPoints

      teamState.units.forEach(unit => {
        player.units.push(
          new Unit(
            unit.team,
            unit.type,
            unit.id,
            unit.pos.x,
            unit.pos.y,
            unit.cooldown,
            unit.cargo.wood,
            unit.cargo.coal,
            unit.cargo.uranium,
          )
        )
      })
    })

    game.cities.forEach(city => {
      const newCity: City = new City(
        city.team,
        city.id,
        city.fuel,
        city.getLightUpkeep(),
      )
      gameState.players[city.team].cities.set(city.id, newCity)

      city.citycells.forEach(citycell => {
        const cityTile = newCity.addCityTile(citycell.pos.x, citycell.pos.y, citycell.citytile.cooldown)
        gameState.map.getCell(cityTile.pos.x, cityTile.pos.y).citytile = cityTile
        gameState.players[city.team].cityTileCount++
      })
    })
  }

  static initGameState(playerid: LuxUnit.TEAM): GameState {
    const gameState = new GameState()
    gameState.map = new GameMap(0, 0)
    gameState.players = TEAMS.map(team => new Player(team))
    gameState.id = playerid
    return gameState
  }

  /** Game => GameState */
  static toGameState(game: Game, playerid: LuxUnit.TEAM): GameState {
    const gameState = Convert.initGameState(playerid)
    Convert.updateGameState(gameState, game)
    return gameState
  }
}