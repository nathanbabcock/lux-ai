import { getNeighbors, getResources } from '../helpers/helpers'
import { clearLog, log } from '../helpers/logging'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Agent, annotate } from '../lux/Agent'
import { Cell } from '../lux/Cell'
import { writeFileSync } from 'fs'
import { Player } from '../lux/Player'
import Turn from '../helpers/Turn'
import { randomActions } from './random'

const agent = new Agent()

async function main() {
  clearLog()
  log('==========================')
  log('Light Level Analysis Agent')
  log('==========================')
  log(new Date().toLocaleString())

  agent.run(async gameState => {
    const actions = []
    // if (gameState.turn  > 0) return actions

    // Let's imagine every entity in the game emits light (it's thematic, after all)
    // The brightness of the light is proportional to the fuel value of the corresponding resource
    // The attenuation of the light is proportional to the quantity of resources in the entity
    // Attenuation may follow an inverse square law, or a simple linear falloff
    // Possibly, shadows could be cast by cities and other obstacles

    const map = gameState.map
    const player = gameState.players[gameState.id]
    const lightLevels = new Map<Cell, number>()
    const resources = getResources(map)

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = map.getCell(x, y)
        lightLevels.set(cell, 0)
      }
    }

    for (const resourceCell of resources) {
      const brightness: number = GAME_CONSTANTS.PARAMETERS.RESOURCE_TO_FUEL_RATE[resourceCell.resource.type.toUpperCase()]
      let researchFactor = 1
      if (resourceCell.resource.type === 'coal')
        researchFactor = player.researchPoints / GAME_CONSTANTS.PARAMETERS.RESEARCH_REQUIREMENTS.COAL
      else if (resourceCell.resource.type === 'uranium')
        researchFactor = player.researchPoints / GAME_CONSTANTS.PARAMETERS.RESEARCH_REQUIREMENTS.URANIUM
      researchFactor = Math.min(researchFactor, 1)
      // if (gameState.turn === 0)
      //   log(`researchFactor is ${researchFactor}`)
      const luminosity = brightness * resourceCell.resource.amount * researchFactor

      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const cell = map.getCell(x, y)
          const distance = cell.pos.distanceTo(resourceCell.pos)
          const attenuation = -100 * brightness * distance // linear, proportional to cost of building city
          const curLightLevel = lightLevels.get(cell)
          const newLightLevel = Math.max(curLightLevel + luminosity + attenuation, 0, curLightLevel)
          lightLevels.set(cell, newLightLevel)
        }
      }
    }

    let maxLightLevel = 0
    lightLevels.forEach(value => {
      if (value > maxLightLevel) maxLightLevel = value
    })

    const levelsArray: number[][] = []
    for (let y = 0; y < map.height; y++) {
      levelsArray.push([])
      for (let x = 0; x < map.width; x++) {
        const cell = map.getCell(x, y)
        const lightLevel = lightLevels.get(cell)
        const normalizedLightLevel = Math.round((lightLevel / maxLightLevel) * 255)
        if (gameState.turn === 0)
          actions.push(annotate.text(cell.pos.x, cell.pos.y, `${normalizedLightLevel}`))
        levelsArray[y].push(normalizedLightLevel)
      }
    }

    if (gameState.turn === 0)
      writeFileSync('../../replays/light-levels.json', JSON.stringify(levelsArray))

    for (const unit of player.units) {
      const cell = map.getCellByPos(unit.pos)
      const adjacent = getNeighbors(cell, map);
      ([ cell, ...adjacent ]).forEach(cell => {
        actions.push(annotate.text(cell.pos.x, cell.pos.y, `${levelsArray[cell.pos.y][cell.pos.x]}`))
      })

      if (!unit.canAct()) continue

      // go towards the light
      let maxLight = 0
      let maxLightCell: Cell = null
      let minLight = Infinity
      let minLightCell: Cell = null
      for (const neighbor of adjacent) {
        const lightLevel = lightLevels.get(neighbor)
        if (lightLevel > maxLight) {
          maxLight = lightLevel
          maxLightCell = neighbor
        }
        if (lightLevel < maxLight) {
          minLight = lightLevel
          minLightCell = neighbor
        }
      }
      if (unit.canAct() && unit.getCargoSpaceLeft() === 0 && unit.canBuild(map)) {
        actions.push(unit.buildCity())
        continue
      }
      if (unit.canAct() && unit.getCargoSpaceLeft() === 0) {
        if (!minLightCell) continue

        const dir = unit.pos.directionTo(minLightCell.pos)
        actions.push(unit.move(dir))
        continue
      }
      if (!maxLightCell) continue
      if (maxLightCell.citytile) continue

      const dir = unit.pos.directionTo(maxLightCell.pos)
      actions.push(unit.move(dir))
    }

    const turn = new Turn(gameState)
    actions.push(turn.autoCities())

    return actions
  })
}

main()

