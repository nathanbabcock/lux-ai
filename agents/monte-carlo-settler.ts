import { clearLog, log } from '../helpers/logging'
import MonteCarlo, { Mission, TreeNode } from '../helpers/MonteCarlo'
import SettlerAgent from '../helpers/SettlerAgent'
import Sim from '../helpers/Sim'
import { chooseRandom } from '../helpers/util'
import { Agent, annotate } from '../lux/Agent'

const agent = new Agent()
const assignments = new Map<string, Mission>()

async function main() {
  clearLog()
  log('===================')
  log('Monte-Carlo Settler')
  log('===================')
  log(new Date().toLocaleString())

  const sim = await Sim.create()
  agent.run(async gameState => {
    try {
      log(`=== Turn #${gameState.turn} ===`)
      const start = new Date().getTime()
      const player = gameState.players[gameState.id]

      // Clear old assignments if needed
      assignments.forEach((mission, id) => {
        const unit = player.units.find(unit => unit.id === id)
        if (!unit) assignments.delete(id)
        const cell = gameState.map.getCellByPos(mission.city_pos)
        if (!cell || cell.citytile) assignments.delete(id)
      })

      const actions: string[] = []
      const mcts = new MonteCarlo()
      mcts.root = new TreeNode(gameState)
      mcts.root.assignments = MonteCarlo.cloneAssignments(assignments)
      log (`Assignments: ${mcts.root.assignmentsToString()}`)
      MonteCarlo.expansion(mcts.root)

      if (mcts.root.children.length > 0) {
        const TIME_BUDGET = 1000
        let num_playouts = 0
        let now = new Date().getTime()
        while ((now = new Date().getTime()) - start < TIME_BUDGET) {
          num_playouts++
          log(`Playout #${num_playouts} @ ${(now - start)}ms`)
          const child = chooseRandom(mcts.root.children)
          await MonteCarlo.simAndBackProp(sim, child)
          log(`-> done in ${(new Date().getTime() - now)}ms`)
        }

        let bestValue = 0
        let bestAssignments: Map<string, Mission> = undefined
        mcts.root.children.forEach(child => {
          const value = child.wins / child.plays
          if (value > bestValue) {
            bestValue = value
            bestAssignments = child.assignments
          }
        })

        for (const assignment of bestAssignments.values())
          assignments.set(assignment.unit_id, assignment)

        const debug_text_num_playouts = `MCTS had time for ${num_playouts} iterations`
        const debug_text_best_score = `Best assignments had score = ${bestValue}`

        actions.push(annotate.sidetext(debug_text_num_playouts))
        actions.push(annotate.sidetext(debug_text_best_score))

        log(debug_text_num_playouts)
        log(debug_text_best_score)
      } else {
        log(`All units already assigned -- no decisions to be made on this turn`)
      }

      log(`Executing best assignments @ ${new Date().getTime() - start}ms`)
      actions.push(...SettlerAgent.turn(gameState, player, assignments))
      log(`Done @ ${new Date().getTime() - start}ms`)
      return actions
    } catch (e) {
      log(e.stack)
      return []
    }
  })
}

main()

