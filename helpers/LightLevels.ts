import { SerializedState } from '@lux-ai/2021-challenge'
import { getResourcesSerialized } from './helpers'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Position } from '../lux/Position'

export type AugMapCell = {
  woodLevel: number
  coalLevel: number
  uraniumLevel: number
  resourceLevel: number
  enemyCityLevel: number
  enemyUnitLevel: number
  friendlyCityLevel: number
  friendlyUnitLevel: number
}

export type AugMap = AugMapCell[][]

export type AugReplay = {
  turns: AugMap[]
  // attributionGraph
}

export default class LightLevels {
  static printLightMap(map: AugMap, channel: keyof AugMapCell) {
    for (let y = 0; y < map.length; y++) {
      let row = ''
      for (let x = 0; x < map[y].length; x++) {
        row += new String(map[y][x][channel]).padStart(5) + ' '
      }
      console.log(row)
    }
  }

  static computeAll(serializedState: SerializedState, augMap: AugMap) {
    LightLevels.computeResources(serializedState, augMap)
    LightLevels.computeWood(serializedState, augMap)
    LightLevels.computeCoal(serializedState, augMap)
    LightLevels.computeUranium(serializedState, augMap)
  }

  /** Computes and writes all resource light level data into the given AugMap */
  static computeResources(serializedState: SerializedState, augMap: AugMap): void {
    const width = augMap.length
    const resources = getResourcesSerialized(serializedState.map, width)

    for (const resourceCell of resources) {
      const brightness: number = GAME_CONSTANTS.PARAMETERS.RESOURCE_TO_FUEL_RATE[resourceCell.resource.type.toUpperCase()]
      let researchFactor = 1
      // if (resourceCell.resource.type === 'coal')
      //   researchFactor = player.researchPoints / GAME_CONSTANTS.PARAMETERS.RESEARCH_REQUIREMENTS.COAL
      // else if (resourceCell.resource.type === 'uranium')
      //   researchFactor = player.researchPoints / GAME_CONSTANTS.PARAMETERS.RESEARCH_REQUIREMENTS.URANIUM
      researchFactor = Math.min(researchFactor, 1)
      const luminosity = brightness * resourceCell.resource.amount * researchFactor

      for (let y = 0; y < width; y++) {
        for (let x = 0; x < width; x++) {
          const pos = new Position(x, y)
          const augCell = augMap[y][x]
          const distance = pos.distanceTo(resourceCell.pos)
          const attenuation = -100 * brightness * distance // linear, proportional to cost of building city
          const curLightLevel = augCell.resourceLevel
          const newLightLevel = Math.max(curLightLevel + luminosity + attenuation, 0, curLightLevel)
          augCell.resourceLevel = newLightLevel
        }
      }
    }
  }

  static computeWood(serializedState: SerializedState, augMap: AugMap): void {
    LightLevels.computeSpecificResource(serializedState, augMap, 'wood', 'woodLevel')
  }

  static computeCoal(serializedState: SerializedState, augMap: AugMap): void {
    LightLevels.computeSpecificResource(serializedState, augMap, 'coal', 'coalLevel')
  }

  static computeUranium(serializedState: SerializedState, augMap: AugMap): void {
    LightLevels.computeSpecificResource(serializedState, augMap, 'uranium', 'uraniumLevel')
  }

  static computeSpecificResource(
    serializedState: SerializedState,
    augMap: AugMap,
    resourceType: string,
    channel: keyof AugMapCell,
  ): void {
    const width = augMap.length
    const resources = getResourcesSerialized(serializedState.map, width)

    for (const resourceCell of resources) {
      if (!resourceCell.resource || resourceCell.resource.type !== resourceType) continue
      const brightness: number = GAME_CONSTANTS.PARAMETERS.RESOURCE_TO_FUEL_RATE[resourceCell.resource.type.toUpperCase()]
      const luminosity = brightness * resourceCell.resource.amount

      for (let y = 0; y < width; y++) {
        for (let x = 0; x < width; x++) {
          const pos = new Position(x, y)
          const augCell = augMap[y][x]
          const distance = pos.distanceTo(resourceCell.pos)
          const attenuation = -100 * brightness * distance // linear, proportional to cost of building city
          const curLightLevel = augCell[channel]
          const newLightLevel = Math.max(curLightLevel + luminosity + attenuation, 0, curLightLevel)
          augCell[channel] = newLightLevel
        }
      }
    }
  }
}
