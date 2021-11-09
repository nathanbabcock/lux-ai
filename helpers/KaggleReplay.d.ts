import { KaggleObservation } from '@lux-ai/2021-challenge/lib/es5/Replay/parseKaggleObs';

export type KaggleReplay = {
  "configuration": {
    "actTimeout": number
    "agentTimeout": number
    "annotations": boolean
    "episodeSteps": number
    "height": number
    "loglevel": number
    "mapType": string
    "runTimeout": number
    "seed": number
    "width": number
  },
  "description": string
  "id": string,
  "info": {
    "EpisodeId": number
    "LiveVideoPath": null
    "TeamNames": string[]
  },
  "name": string,
  "rewards": number[],
  "schema_version": number,
  "specification": any,
  "statuses": string[]
  "steps": {
    "action": string[]
    "info": any
    "observation": KaggleObservation
    "reward": number
    "status": string
  }[][]
}