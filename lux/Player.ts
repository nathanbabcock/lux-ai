import { Type } from "class-transformer";
import 'reflect-metadata';
import { City } from "./City";
import GAME_CONSTANTS from "./game_constants.json";
import { Unit } from "./Unit";

/**
 * holds all data related to a player
 */
export class Player {
  public readonly team: number;
  public researchPoints = 0;
  // Map unit id to the unit

  @Type(() => Unit)
  public units = new Array<Unit>();

  @Type(() => Map)
  public cities = new Map<string, City>();
  public cityTileCount = 0;

  public constructor(teamid: number) {
    this.team = teamid;
  }

  public researchedCoal(): boolean {
    return this.researchPoints >= GAME_CONSTANTS.PARAMETERS.RESEARCH_REQUIREMENTS.COAL;
  }

  public researchedUranium(): boolean {
    return this.researchPoints >= GAME_CONSTANTS.PARAMETERS.RESEARCH_REQUIREMENTS.URANIUM;
  }
}