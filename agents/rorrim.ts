import { clearLog, log } from '../helpers/logging'
import { Agent, annotate, GameState } from '../lux/Agent'
import { Position } from '../lux/Position'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Unit } from '../lux/Unit'
import { isNight } from '../helpers/Abstraction'
import { getNeighbors, getResourceAdjacency } from '../helpers/helpers'

export type MirrorAxis = 'x' | 'y'

let mirrorAxis: MirrorAxis
const unitMirrors = new Map<string, string>()

/** Assign a unit to a mirror based on where they were spawned */
const birthAssignments: {
  pos: Position,
  mirror: string,
}[] = []

function getMirrorPos(pos: Position, mirrorAxis: MirrorAxis, mapSize: number): Position {
  if (mirrorAxis === 'x') return new Position(pos.x, mapSize / 2 - (pos.y - mapSize / 2) - 1)
  else return new Position(mapSize / 2 - (pos.x - mapSize / 2) - 1, pos.y)
}

function tacticalSuicide(unit: Unit, gameState: GameState): string | undefined {
    if (!isNight(gameState.turn)) {
      log(`Suicide is a nighttime activity`)
      return undefined
    }

    // For now, try moving into no-man's-land
    const map = gameState.map
    const cell = map.getCellByPos(unit.pos)
    const neighbors = getNeighbors(cell, map)
    for (const neighbor of neighbors) {
      if (neighbor.citytile) return
      const resourceAdjacency = getResourceAdjacency(neighbor, map)
      if (resourceAdjacency > 0) continue
      return unit.move(unit.pos.directionTo(neighbor.pos))
    }

    // TODO also try moving into a city which will die next turn
    // TODO avoid inconveniencing others via your suicide, which can have an unpleasant ripple effect

    return undefined
}

const agent = new Agent()
async function main() {
  clearLog()
  log('===============')
  log('Mirror | rorriM')
  log('===============')
  log(new Date().toLocaleString())

  agent.run(async gameState => {
    log(`=== TURN ${gameState.turn}`)

    const actions: string[] = []
    const player = gameState.players[gameState.id]
    const opponent = gameState.players[(gameState.id + 1) % 2]
    const map = gameState.map

    if (gameState.turn === 0) {
      const citytile = Array.from(player.cities.values())[0].citytiles[0]
      const otherCitytile = Array.from(opponent.cities.values())[0].citytiles[0]
      if (citytile.pos.x === otherCitytile.pos.x)
        mirrorAxis = 'x'
      else
        mirrorAxis = 'y'

      unitMirrors.set(player.units[0].id, opponent.units[0].id)

      log(`Identified mirror axis = ${mirrorAxis}`)
    }

    for (const unit of player.units) {
      let mirror = unitMirrors.get(unit.id)

      if (!mirror) {
        const birthAssignment = birthAssignments.find(a => a.pos.equals(unit.pos))
        if (!birthAssignment) continue
        birthAssignments.splice(birthAssignments.indexOf(birthAssignment), 1)
        unitMirrors.set(unit.id, birthAssignment.mirror)
        mirror = unitMirrors.get(unit.id)
      }

      const mirrorUnit = opponent.units.find(u => u.id === mirror)
      if (!mirrorUnit) {
        actions.push(annotate.sidetext(`Mirror unit for ${unit.id} not found`))
        log(`Mirror unit for ${unit.id} not found`)
        log(`Tactical suicide initiated`)
        const kms = tacticalSuicide(unit, gameState)
        if (kms) actions.push(kms)
        else log(`Suicide attempt failed`)
        continue
      } else {
        actions.push(annotate.line(unit.pos.x, unit.pos.y,mirrorUnit.pos.x, mirrorUnit.pos.y))
      }

      // If there's a city under an opposing mirrored unit, build one
      const cell = map.getCellByPos(unit.pos)
      const mirrorCell = map.getCellByPos(mirrorUnit.pos)
      if (unit.pos.equals(getMirrorPos(mirrorCell.pos, mirrorAxis, map.width))  && mirrorCell.citytile && !cell.citytile && unit.canAct()) {
        actions.push(unit.buildCity())
        continue
      }
      
      // Mimic movements of mirrored units
      const mirrorPos = getMirrorPos(mirrorUnit.pos, mirrorAxis, map.width)
      if (!unit.pos.equals(mirrorPos) && unit.canAct()) {
        actions.push(unit.move(unit.pos.directionTo(mirrorPos)))
        continue
      }
    }

    const citytiles = Array.from(player.cities.values()).flatMap(c => c.citytiles)
    for (const citytile of citytiles) {
      if (!citytile.canAct()) continue

      const mirrorPos = getMirrorPos(citytile.pos, mirrorAxis, map.width)
      const mirrorCell = map.getCellByPos(mirrorPos)
      if (!mirrorCell.citytile) continue

      const newUnit = opponent.units.find(unit => unit.pos.equals(mirrorPos) && !Array.from(unitMirrors.values()).find(id => id === unit.id))
      if (!newUnit) {
        actions.push(citytile.research())
        continue
      }

      if (newUnit.type === GAME_CONSTANTS.UNIT_TYPES.WORKER)
        actions.push(citytile.buildWorker())
      else 
        actions.push(citytile.buildCart())
      birthAssignments.push({ pos: citytile.pos, mirror: newUnit.id })
    }
    return actions
  })
}

main()
