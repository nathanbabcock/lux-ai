import DirectorV2 from '../helpers/DirectorV2'
import { clearLog, log, tryAsync } from '../helpers/logging'
import Pathfinding from '../helpers/Pathfinding'
import Sim from '../helpers/Sim'
import { MovementState as UnitState } from '../helpers/StateNode'
import Turn from '../helpers/Turn'
import { clone } from '../helpers/util'
import { Agent, annotate } from '../lux/Agent'
import GAME_CONSTANTS from '../lux/game_constants.json'

const agent = new Agent()
const director = new DirectorV2()
let sim: Sim

async function updateUnits(turn: Turn) {
  for (const unit of turn.player.units) {
    try {
      if (unit.type === GAME_CONSTANTS.UNIT_TYPES.CART) continue

      const plannedAction = director.getUnitAction(unit.id, turn.gameState.turn)
      if (plannedAction) {
        log(`Unit ${unit.id} has existing assigned action: ${plannedAction}`)
        turn.actions.push(plannedAction)
        continue
      }
      
      log(`Starting pathfinding for ${unit.id}`)
      const result = await Pathfinding.astar_build(unit, clone(turn.gameState), sim, director)
      if (!result || result.path.length === 0){
        log(`Could not find plan for unit ${unit.id}`)
        continue
      }
      const plan = result.path
      const destination = plan[plan.length - 1].pos
      director.setPath(unit.id, plan)
      director.buildAssignments.set(unit.id, destination)
      const firstStep = plan[1].action
      turn.actions.push(firstStep)
      log(`Unit ${unit.id} created new plan to build @ (${destination.x}, ${destination.y})`)
      log(`- Pathfinding took ${result.tries} tries`)
      log(`- Path length = ${plan.length}`)
      log(`- First step: ${firstStep}`)
    } catch (e) {
      log(e.stack)
    }
  }
}

function updateCities(turn: Turn) {
  for (const city of turn.player.cities.values()) {
    for (const citytile of city.citytiles) {
      if (citytile.cooldown > 0) continue
      if (turn.player.units.length < turn.player.cityTileCount)
        turn.actions.push(citytile.buildWorker())
      else
        turn.actions.push(citytile.research())
    }
  }
}

function updateAnnotations(turn: Turn) {
  for (const [unit_id, assignment] of director.buildAssignments) {
    const unit = turn.player.units.find(u => u.id === unit_id)
    if (!unit) continue
    turn.actions.push(annotate.line(unit.pos.x, unit.pos.y, assignment.x, assignment.y))
  }
}

async function main() {
  clearLog()
  log('===========================')
  log('A-Star Greedy Builder Agent')
  log('===========================')
  log(new Date().toLocaleString())

  sim = await Sim.create()

  agent.run(async gameState => {
    const turn = new Turn(gameState)
    log(`=== TURN #${gameState.turn} ===`)

    await updateUnits(turn)
    updateCities(turn)
    updateAnnotations(turn)

    //director.clearAssignments(gameState.turn)

    return turn.actions
  })
}

main()
