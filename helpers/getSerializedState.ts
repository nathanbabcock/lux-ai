import { SerializedState, Unit as LuxUnit, Resource as LuxResource } from '@lux-ai/2021-challenge'
import { GameState } from '../lux/Agent'
import { log } from './logging'

/**
 * Reverse engineer the internal Lux AI game state
 * @param {GameState} gameState the simplified Typescript object model
 * @returns {SerializedState} The full internal state of the game used by the Lux AI runner
 */
export default function getSerializedState(gameState: GameState): SerializedState {
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

  const cities: any = {}
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