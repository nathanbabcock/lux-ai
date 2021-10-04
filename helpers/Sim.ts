import { LuxDesignLogic, LuxMatchState } from '@lux-ai/2021-challenge'
import { Match } from 'dimensions-ai'
import { turn } from '../agents/tree-search'
import { annotate, GameState } from '../lux/Agent'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Convert from './Convert'
import { log } from './logging'
import { clone } from './util'

export type MissionSimulation = {
  gameState: GameState
  plan: string[]
  annotations: string[]
}

export async function simulateSettlerMission(
  unit: Unit,
  destination: Position,
  gameState: GameState,
  match: Match,
  getActions: typeof turn
): Promise<MissionSimulation> {
  try {
    const MAX_SIM_TURNS = 40

    gameState = clone(gameState)
    const plan: string[] = []
    const annotations: string[] = [
      annotate.line(unit.pos.x, unit.pos.y, destination.x, destination.y)
    ]
    const serializedState = Convert.toSerializedState(gameState)
    LuxDesignLogic.reset(match, serializedState)
    let cityBuilt = false
    let unitDied = false
    let simTurns = 0

    const getMatchUnit = () =>
      (match.state as LuxMatchState).game.getUnit(unit.team, unit.id)

    while (!cityBuilt && !unitDied && simTurns < MAX_SIM_TURNS) {
      const actions = await getActions(gameState, destination)
      actions.forEach(action => {
        if (action.includes(unit.id))
          plan.push(action)
      })
      const commands = actions.map(action => ({
        agentID: unit.team,
        command: action,
      }))

      await LuxDesignLogic.update(match, commands)
      Convert.updateGameState(gameState, (match.state as LuxMatchState).game)
      simTurns++

      if (!getMatchUnit()) {
        unitDied = true
        break
      }

      annotations.push(annotate.circle(getMatchUnit().pos.x, getMatchUnit().pos.y))
      annotations.push(annotate.text(getMatchUnit().pos.x, getMatchUnit().pos.y, `#${simTurns}`))

      const cityTile = gameState.map.getCellByPos(destination).citytile
      if (cityTile && cityTile.team === unit.team) {
        cityBuilt = true
        break
      } else if (cityTile && cityTile.team !== unit.team) {
        log('simulateSettlerMission: enemy built city on destination tile')
        break
      }
    }

    if (cityBuilt) log('simulateSettlerMission: city built on this mission')
    if (unitDied) log('simulateSettlerMission: unit died on this mission')
    if (!cityBuilt && !unitDied) log('simulateSettlerMission: nothing happened')
    
    return {
      gameState,
      plan,
      annotations,
    }
  } catch (e) {
    log(e.stack || e.message)
  }
}