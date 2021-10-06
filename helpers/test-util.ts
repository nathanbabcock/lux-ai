import { GameMap } from '@lux-ai/2021-challenge'
import Sim from './Sim'

export const initDebug = async (replay?: string) =>
  await Sim.create({
    storeReplay: !!replay,
    out: replay,
    debugAnnotations: true,
    width: 16,
    height: 16,
    mapType: GameMap.Types.DEBUG,
  })

export const initSeed = async (replay?: string) => 
  await Sim.create({
    storeReplay: !!replay,
    out: replay,
    debugAnnotations: true,
    mapType: GameMap.Types.RANDOM,
    width: 12,
    height: 12,
    seed: 123456789,
  })
