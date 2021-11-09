import { SerializedState } from '@lux-ai/2021-challenge'
import { getResourcesSerialized, otherTeam } from './helpers'
import GAME_CONSTANTS from '../lux/game_constants.json'
import { Position } from '../lux/Position'
import { AttributionGraph } from './CreditAssignment'

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
  attributionGraph: AttributionGraph
}

export default class LightLevels {
  static computeAll(serializedState: SerializedState, augMap: AugMap, team: 0 | 1): void {
    LightLevels.computeResources(serializedState, augMap)
    LightLevels.computeWood(serializedState, augMap)
    LightLevels.computeCoal(serializedState, augMap)
    LightLevels.computeUranium(serializedState, augMap)
    LightLevels.computeFriendlyUnits(serializedState, augMap, team)
    LightLevels.computeEnemyUnits(serializedState, augMap, otherTeam(team))
    LightLevels.computeFriendlyCityTiles(serializedState, augMap, team)
    LightLevels.computeEnemyCityTiles(serializedState, augMap, otherTeam(team))
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

  static computeFriendlyUnits(serializedState: SerializedState, augMap: AugMap, team: 0 | 1): void {
    LightLevels.computeUnits(serializedState, augMap, team, 'friendlyUnitLevel')
  }

  static computeEnemyUnits(serializedState: SerializedState, augMap: AugMap, enemyTeam: 0 | 1): void {
    LightLevels.computeUnits(serializedState, augMap, enemyTeam, 'enemyUnitLevel')
  }

  static computeUnits(
    serializedState: SerializedState,
    augMap: AugMap,
    team: number,
    channel: keyof AugMapCell,
  ): void {
    const width = augMap.length
    const units = Object.values(serializedState.teamStates[team as 0 | 1].units)

    for (const unit of units) {
      const brightness = 500 // arbitrary flat number
      const luminosity = brightness
      const unitPos = new Position(unit.x, unit.y)

      for (let y = 0; y < width; y++) {
        for (let x = 0; x < width; x++) {
          const pos = new Position(x, y)
          const augCell = augMap[y][x]
          const distance = pos.distanceTo(unitPos)
          const attenuation = -100 * distance // linear, proportional to cost of building city
          const curLightLevel = augCell[channel]
          const newLightLevel = Math.max(curLightLevel + luminosity + attenuation, 0, curLightLevel)
          augCell[channel] = newLightLevel
        }
      }
    }
  }

  static computeFriendlyCityTiles(serializedState: SerializedState, augMap: AugMap, team: 0 | 1) {
    LightLevels.computeCityTiles(serializedState, augMap, team, 'friendlyCityLevel')
  }

  static computeEnemyCityTiles(serializedState: SerializedState, augMap: AugMap, enemyTeam: 0 | 1) {
    LightLevels.computeCityTiles(serializedState, augMap, enemyTeam, 'enemyCityLevel')
  }

  static computeCityTiles(
    serializedState: SerializedState,
    augMap: AugMap,
    team: 0 | 1,
    channel: keyof AugMapCell,
  ): void {
    const width = augMap.length
    const cities = Object.values(serializedState.cities)
      .filter(city => city.team === team)

    for (const city of cities) {
      for (const cityTile of city.cityCells) {
        const brightness = 1
        const luminosity = 100 + brightness * city.fuel / city.cityCells.length
        const cityTilePos = new Position(cityTile.x, cityTile.y)

        for (let y = 0; y < width; y++) {
          for (let x = 0; x < width; x++) {
            const pos = new Position(x, y)
            const augCell = augMap[y][x]
            const distance = pos.distanceTo(cityTilePos)
            const attenuation = -100 * distance // linear, proportional to cost of building city
            const curLightLevel = augCell[channel]
            const newLightLevel = Math.max(curLightLevel + luminosity + attenuation, 0, curLightLevel)
            augCell[channel] = newLightLevel
          }
        }
      }
    }
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

  static printLightMap(map: AugMap, channel: keyof AugMapCell) {
    for (let y = 0; y < map.length; y++) {
      let row = ''
      for (let x = 0; x < map[y].length; x++) {
        row += new String(Math.round(map[y][x][channel])).padStart(5) + ' '
      }
      console.log(row)
    }
  }
}
