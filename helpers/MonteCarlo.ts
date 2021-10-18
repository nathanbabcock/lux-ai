import { Position } from '../lux/Position'

export default class MonteCarlo {
  
}

export class MCNode {
  plays: number = 0
  wins: number = 0

  /** mapping from unit ids to their Missions assigned at this node */
  assignments: Map<string, Mission> = new Map()
  parent?: MCNode
  children: MCNode[] = []
}

export type SettlerMission = {
  unit_id: string
  city_pos: Position
}

export type RefuelMission = {
  unit_id: string
  city_pos: Position
}

export type Mission = SettlerMission | RefuelMission
