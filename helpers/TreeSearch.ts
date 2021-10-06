import { Game, LuxDesignLogic, LuxMatchState, SerializedState, Unit as LuxUnit } from '@lux-ai/2021-challenge'
import { Match } from 'dimensions-ai'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Unit } from '../lux/Unit'
import { log } from './logging'

export function countCities(cities: Game['cities'], team: LuxUnit.TEAM) {
  let count = 0

  cities.forEach((city) => {
    if (city.team === team) count++
  })

  return count
}

/**
 * Depth-first tree search for the fastest plan to build the first city
 * @todo this should definitely be a BREADTH-first search (duh)
 * @returns an array of actions (one per turn) to be executed
 */
export async function firstCityTreeSearch(
  match: Match,
  unit: Unit,
  serializedState: SerializedState,
  depth: number = 1,
  pastActions: string[] = [],
): Promise<string[] | false> {
  try {
    const start = new Date().getTime()
    // log('treeSearch')
  
    const state = match.state as LuxMatchState
    const matchUnit = state.game.getUnit(unit.team, unit.id)
    if (!matchUnit) {
      log('treeSearch: unit died in this branch')
      return null
    }

    // Base case
    const num_cities = countCities(state.game.cities, unit.team)
    if (depth === 0) {
      // log('=== Hit the base case ===')

      const Δx = matchUnit.pos.x - unit.pos.x
      const Δy = matchUnit.pos.y - unit.pos.y
      const Δwood = matchUnit.cargo.wood - unit.cargo.wood

      // log(`The unit moved by delta_x=${Δx} and delta_y=${Δy}`)
      // log(`The unit collected ${Δwood} wood`)
      // log(`Team has ${num_cities} cities`)

      if (num_cities === 2) return pastActions
      else return false
    }

    const actions = []
    if (matchUnit.canAct()) {
      actions.push(...Object.entries(GAME_CONSTANTS.DIRECTIONS).map(entry => unit.move(entry[1])))
      actions.push(unit.buildCity()) // TODO unit.canBuild() requires an updated gameMap
    } else {
      actions.push(unit.move(GAME_CONSTANTS.DIRECTIONS.CENTER))
    }

    // log(`Actions (${actions.length}): [${actions.map(action => `"${action}"`).join(', ')}]`)

    // if (actions.length === 1)
    //   log('On cooldown this turn')

    const possiblePlans: Array<Array<string>> = []

    // Try all possible actions each turn
    for (const action of actions) {
      LuxDesignLogic.reset(match, serializedState)
      await LuxDesignLogic.update(match, [{
        agentID: unit.team,
        command: action,
      }])
      const newState = state.game.toStateObject()
      const plan = await firstCityTreeSearch(match, unit, newState, depth - 1, [...pastActions, action])
      if (plan) possiblePlans.push(plan)
    }

    if (possiblePlans.length > 0) {
      log(`treeSearch found ${possiblePlans.length} solutions in ${new Date().getTime() - start}ms`)
      possiblePlans.sort((a, b) => a.length - b.length)
      return possiblePlans[0]
    }

    // log(`treeSearch done in ${new Date().getTime() - start}ms`)
    return false
  } catch (e) {
    log(e.stack || e.message)
    return false
  }
}
