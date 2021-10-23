import { Game, Unit } from '@lux-ai/2021-challenge';

export default function getResults(game: Game): any {
  // calculate results
  let winningTeam = Unit.TEAM.A;
  let losingTeam = Unit.TEAM.B;
  figureresults: {
    // count city tiles
    const cityTileCount = [0, 0];
    game.cities.forEach((city) => {
      cityTileCount[city.team] += city.citycells.length;
    });
    if (cityTileCount[Unit.TEAM.A] > cityTileCount[Unit.TEAM.B]) {
      break figureresults;
    } else if (cityTileCount[Unit.TEAM.A] < cityTileCount[Unit.TEAM.B]) {
      winningTeam = Unit.TEAM.B;
      losingTeam = Unit.TEAM.A;
      break figureresults;
    }

    // if tied, count by units
    const unitCount = [
      game.getTeamsUnits(Unit.TEAM.A),
      game.getTeamsUnits(Unit.TEAM.B),
    ];
    if (unitCount[Unit.TEAM.A].size > unitCount[Unit.TEAM.B].size) {
      break figureresults;
    } else if (unitCount[Unit.TEAM.A].size < unitCount[Unit.TEAM.B].size) {
      winningTeam = Unit.TEAM.B;
      losingTeam = Unit.TEAM.A;
      break figureresults;
    }
    // if tied still, return a tie
    const results = {
      ranks: [
        { rank: 1, agentID: winningTeam },
        { rank: 1, agentID: losingTeam },
      ],
      replayFile: null,
    };
    return results;
  }

  const results = {
    ranks: [
      { rank: 1, agentID: winningTeam },
      { rank: 2, agentID: losingTeam },
    ],
    replayFile: null,
  };
  
  return results;
}