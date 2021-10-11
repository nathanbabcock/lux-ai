import { GameState } from '../lux/Agent'
import { Position } from '../lux/Position'
import { Unit } from '../lux/Unit'
import Convert from './Convert'
import { MovementState, StateMap, StateNode } from './StateNode'
import Sim from './Sim'
import { deepClone } from './util'

export default class Pathfinding {
  static reconstruct_path<T extends StateNode>(current: T): T[] {
    const total_path = [current]
    while (current.cameFrom)
      total_path.unshift(current = current.cameFrom as T)
    return total_path
  }

  static manhattan(pos: Position, goal: Position) {
    return Math.abs(pos.x - goal.x) + Math.abs(pos.y - goal.y)
  }

  static turns(startPos: Position, startCanAct: boolean, goalPos: Position, goalCanAct: boolean): number {
    return (Pathfinding.manhattan(startPos, goalPos) * 2) // 1 turn of movement, 1 turn of cooldown, per tile
      + (startCanAct ? 0 : 1) // 1 turn of initial cooldown if can't act
      - (goalCanAct ? 0 : 1) // Whether to wait for cooldown on goal tile
  }

  static async astar_sim_turns(startUnit: Unit, goal: Position, startGameState: GameState, sim: Sim): Promise<MovementState[] | null> {
    /** Heuristic for *minimum* number of turns required to get from @param start state to @param goal state */
    const h = (start: MovementState, goal: MovementState) =>
      Pathfinding.turns(start.pos, start.canAct, goal.pos, goal.canAct)
    
    const startState = new MovementState(startUnit.pos, startUnit.canAct())

    const goalState = new MovementState(goal, false)

    const openSet = [startState]

    const gScore = new StateMap()
    gScore.set(startState, 0)

    const fScore = new StateMap()
    fScore.set(startState, h(startState, goalState))

    while (openSet.length > 0) {
      let cur = openSet[0]
      openSet.forEach(node => {
        if (fScore.get(node) < fScore.get(cur)) cur = node
      })

      if (cur.equals(goalState))
        return Pathfinding.reconstruct_path(cur)

      openSet.splice(openSet.indexOf(cur), 1)
      const curGameState = deepClone(GameState, startGameState)
      const curUnit = curGameState.players[startUnit.team].units.find(unit => unit.id === startUnit.id)
      curGameState.turn = cur.turn
      curUnit.pos.x = cur.pos.x
      curUnit.pos.y = cur.pos.y
      if (cur.canAct) curUnit.cooldown = 0

      const actions: string[] = []
      if (!cur.canAct)
        actions.push(curUnit.move('c'))
      else {
        const directions = ['n', 'e', 's', 'w']
        directions.forEach(dir => actions.push(startUnit.move(dir)))
      }

      for (const action of actions) {
        const serializedState = Convert.toSerializedState(curGameState)
        sim.reset(serializedState)
        const simState = await sim.action(action)
        const newGameState = simState.gameState
        const newUnit = newGameState.players[startUnit.team].units.find(u => u.id === startUnit.id)

        if (!newUnit) {
          //console.warn(`Unit used for pathfinding has disappeared on turn ${curGameState.turn}, presumed DEAD`)
          continue
        }

        if (cur.canAct && newUnit.pos.equals(curUnit.pos)) {
          //console.warn(`Attempted move failed -- skipping to next node`)
          continue
        }

        const neighbor = new MovementState(newUnit.pos, newUnit.canAct(), newGameState.turn)
        neighbor.cameFrom = cur
        neighbor.action = action

        const tentative_gScore = gScore.get(cur) + h(cur, neighbor)
        //console.log(`gScore(${neighbor.pos.x}, ${neighbor.pos.y}, ${neighbor.canAct}) = ${tentative_gScore}`)
        if (tentative_gScore < gScore.get(neighbor) || !gScore.has(neighbor)) {
          gScore.set(neighbor, tentative_gScore)
          fScore.set(neighbor, tentative_gScore + h(neighbor, goalState))
          if (!openSet.find(node => node.equals(neighbor)))
            openSet.push(neighbor)
        }
      }
    }

    return null
  }
}
