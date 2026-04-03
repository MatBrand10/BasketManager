
(() => {
  const getDeps = () => window.AppSeasonCoreDeps || {};
  const getState = () => {
    const deps = getDeps();
    return typeof deps.getState === 'function' ? deps.getState() : null;
  };
  const { rand, randomChoice, clamp } = window.AppUtils || {};
  const { computeOvr, getPotentialMax } = window.GameCore || {};
  const { t } = window.AppText || {};

  const getTotalDays = () => {
    const gameState = getState();
    if (!gameState) return 0;
    const last = gameState.schedule.reduce((acc, g) => Math.max(acc, g.day), 0);
    return last + 1;
  };

  const awardPlayer = (playerId, label) => {
    const gameState = getState();
    if (!gameState) return;
    gameState.teams.forEach((team) => {
      const player = team.roster.find((p) => p.id === playerId);
      if (player) {
        if (!player.awards) player.awards = [];
        player.awards.unshift(`${label} T${gameState.season}`);
      }
    });
  };

  const simulateAllStar = () => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return;
    const players = [];
    gameState.teams.forEach((team) => {
      team.roster.forEach((player) => players.push({ ...player, teamId: team.id }));
    });
    const stars = players.sort((a, b) => b.ovr - a.ovr).slice(0, 24);
    const teamA = stars.slice(0, 12);
    const teamB = stars.slice(12, 24);
    const ratingA = teamA.reduce((acc, p) => acc + p.ovr, 0) / teamA.length;
    const ratingB = teamB.reduce((acc, p) => acc + p.ovr, 0) / teamB.length;
    const scoreA = Math.round(95 + ratingA + (rand ? rand(-6, 6) : 0));
    const scoreB = Math.round(95 + ratingB + (rand ? rand(-6, 6) : 0));
    const winner = scoreA >= scoreB ? 'Team A' : 'Team B';
    const mvp = stars.sort((a, b) => (b.ovr + b.scoring * 20) - (a.ovr + a.scoring * 20))[0];
    if (mvp) awardPlayer(mvp.id, 'All-Star MVP');
    gameState.allStar.history.unshift({
      season: gameState.season,
      winner,
      mvp: mvp ? mvp.name : '-'
    });
    if (deps.logMessage) deps.logMessage('msg_allstar', { team: winner, player: mvp ? mvp.name : '-' });
    gameState.allStar.done = true;
  };

  const calculateAwards = () => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return null;
    const players = [];
    gameState.teams.forEach((team) => {
      team.roster.forEach((player) => players.push({ ...player, teamId: team.id }));
    });
    const byScore = (fn) => [...players].sort((a, b) => fn(b) - fn(a))[0];
    const mvp = byScore((p) => p.ovr + p.scoring * 20 + p.starLevel * 6);
    const dpoy = byScore((p) => p.defense * 0.8 + p.physical * 0.6);
    const scorer = byScore((p) => p.attack * 0.6 + p.shooting * 0.8 + p.scoring * 20);
    const rookies = players.filter((p) => p.age <= 22);
    const roy = rookies.length ? rookies.sort((a, b) => b.ovr - a.ovr)[0] : mvp;
    if (mvp) awardPlayer(mvp.id, 'MVP');
    if (dpoy) awardPlayer(dpoy.id, 'DPOY');
    if (roy) awardPlayer(roy.id, 'ROY');
    if (scorer) awardPlayer(scorer.id, 'Scoring');
    return {
      season: gameState.season,
      mvp: mvp ? `${mvp.name} (${deps.getTeamById(mvp.teamId).name})` : '-',
      dpoy: dpoy ? `${dpoy.name} (${deps.getTeamById(dpoy.teamId).name})` : '-',
      roy: roy ? `${roy.name} (${deps.getTeamById(roy.teamId).name})` : '-',
      scorer: scorer ? `${scorer.name} (${deps.getTeamById(scorer.teamId).name})` : '-'
    };
  };

  const buildSeasonRecap = (awards) => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return null;
    const userTeam = deps.getTeamById(gameState.userTeamId);
    const standings = getStandings();
    const confTable = standings[userTeam.conf] || standings.Unica || [];
    const seedIndex = confTable.findIndex((item) => item.id === userTeam.id);
    const players = [];
    gameState.teams.forEach((team) => {
      team.roster.forEach((player) => players.push({ ...player, teamId: team.id }));
    });
    const scoreValue = (player) => player.ovr + (player.scoring || 0) * 20 + (player.starLevel || 0) * 6;
    const used = new Set();
    const pickByPos = (pos) => {
      const candidates = players.filter((p) => p.pos === pos && !used.has(p.id));
      if (!candidates.length) return null;
      const best = candidates.sort((a, b) => scoreValue(b) - scoreValue(a))[0];
      used.add(best.id);
      return best;
    };
    const allTeam = POSITIONS.map((pos) => {
      let pick = pickByPos(pos);
      if (!pick) {
        const fallback = players.filter((p) => !used.has(p.id)).sort((a, b) => scoreValue(b) - scoreValue(a))[0];
        if (fallback) {
          used.add(fallback.id);
          pick = fallback;
        }
      }
      return pick ? {
        pos: pick.pos,
        name: pick.name,
        team: deps.getTeamById(pick.teamId).name,
        ovr: pick.ovr
      } : null;
    }).filter(Boolean);
    const topPlayers = players
      .sort((a, b) => scoreValue(b) - scoreValue(a))
      .slice(0, 3)
      .map((player) => ({
        name: player.name,
        team: deps.getTeamById(player.teamId).name,
        ovr: player.ovr,
        archetype: player.archetype
      }));
    return {
      season: gameState.season,
      league: gameState.league ? gameState.league.name : '-',
      champion: gameState.playoffs ? gameState.playoffs.champion : '-',
      user: {
        wins: userTeam.wins,
        losses: userTeam.losses,
        seed: seedIndex >= 0 ? seedIndex + 1 : null
      },
      awards,
      topPlayers,
      allTeam,
      playIn: gameState.playoffs ? gameState.playoffs.playIn : null,
      finalsMvp: gameState.playoffs ? gameState.playoffs.finalsMvp : null
    };
  };

  const applyProgression = (team) => {
    const deps = getDeps();
    const facilityBonus = team.facilities ? team.facilities.training - 1 : 0;
    team.roster.forEach((player) => {
      const stats = player.seasonStats || { gp: 0, pts: 0, min: 0 };
      const avgMin = stats.gp > 0 ? stats.min / stats.gp : 0;
      const morale = typeof player.morale === 'number' ? player.morale : 70;
      const moraleBonus = morale >= 75 ? 1 : morale <= 40 ? -1 : 0;
      const usageBonus = avgMin >= 28 ? 1 : avgMin <= 10 ? -1 : 0;
      const performanceBonus = stats.gp > 0 && (stats.pts / stats.gp) >= 18 ? 1 : 0;
      const injuryPenalty = player.injuryDays > 0 ? -Math.min(2, Math.ceil(player.injuryDays / 15)) : 0;
      const baseGrowth = player.age <= 23 ? (rand ? rand(1, 4) : 2)
        : player.age <= 27 ? (rand ? rand(0, 3) : 1)
          : player.age <= 31 ? (rand ? rand(-1, 2) : 0)
            : -(rand ? rand(1, 3) : 1);
      const potentialFactor = Math.max(0, (getPotentialMax ? getPotentialMax(player) : player.potential || player.ovr) - 60) / 35;
      let delta = Math.round(baseGrowth + potentialFactor * (rand ? rand(0, 2) : 1) + facilityBonus + moraleBonus + usageBonus + performanceBonus + injuryPenalty);
      if ((getPotentialMax ? getPotentialMax(player) : player.potential || player.ovr) - player.ovr <= 0 && delta > 0) {
        delta = -(rand ? rand(0, 2) : 1);
      }
      const attrs = ['attack', 'defense', 'physical', 'shooting', 'passing'];
      attrs.forEach((attr) => {
        const drift = delta + (rand ? rand(-1, 1) : 0);
        if (deps.applyAttributeDelta) deps.applyAttributeDelta(player, attr, drift);
      });
      if (deps.computeOvr) {
        player.ovr = deps.computeOvr(player);
      } else if (computeOvr) {
        player.ovr = computeOvr(player);
      }
      if (deps.updatePlayerRole) deps.updatePlayerRole(player);
      if (deps.assignTraits) deps.assignTraits(player);
      player.age += 1;
      player.energy = clamp ? clamp(player.energy + 10, 50, 100) : player.energy;
    });
  };

  const processContractsForOffseason = () => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return;
    gameState.teams.forEach((team) => {
      const remaining = [];
      team.roster.forEach((player) => {
        player.contractYears -= 1;
        if (player.contractYears > 0) {
          remaining.push(player);
        } else if (player.optionType) {
          const keepByPlayer = player.optionType === 'player' && (player.ovr < 78);
          const keepByTeam = player.optionType === 'team' && (player.ovr >= 72);
          if (keepByPlayer || keepByTeam) {
            player.contractYears = 1;
            player.optionType = null;
            remaining.push(player);
          } else {
            player.originLeague = gameState.league.id;
            gameState.market.freeAgents.push(player);
          }
        } else {
          if (team.id !== gameState.userTeamId) {
            const keepChance = clamp ? clamp(0.35 + player.starLevel * 0.15 + (player.ovr - 70) / 100, 0.2, 0.85) : 0.5;
            const raise = 1.08 + player.starLevel * 0.04;
            const newSalary = parseFloat((player.salary * raise).toFixed(1));
            if (Math.random() < keepChance && team.budget >= newSalary) {
              player.salary = newSalary;
              player.contractYears = rand ? rand(1, 3) : 2;
              player.optionType = null;
              remaining.push(player);
              return;
            }
          }
          player.originLeague = gameState.league.id;
          gameState.market.freeAgents.push(player);
        }
      });
      team.roster = remaining;
    });
  };

  const beginOffseason = () => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return;
    processContractsForOffseason();
    if (deps.createDraftPool) {
      gameState.market.draftPool = deps.createDraftPool(60, gameState.league ? gameState.league.id : null);
    }
    gameState.draftState = null;
    if (deps.runAIFrontOffice) deps.runAIFrontOffice();
    if (deps.applyInterLeagueTransfers) deps.applyInterLeagueTransfers();
  };

  const getCurrentDay = () => {
    const gameState = getState();
    if (!gameState) return 0;
    const nextGame = gameState.schedule.find((g) => !g.played);
    return nextGame ? nextGame.day : gameState.day;
  };

  const buildRoundLog = (games, day) => {
    const gameState = getState();
    const deps = getDeps();
    const lines = [];
    if (!games.length || !gameState) return lines;
    lines.push(`Rodada ${day + 1}  ${gameState.league ? gameState.league.name : ''}`);
    games.forEach((game) => {
      const home = deps.getTeamById(game.home);
      const away = deps.getTeamById(game.away);
      const score = `${game.scoreHome} x ${game.scoreAway}`;
      lines.push(`${home.name} ${score} ${away.name}`);
      if (game.stats && game.stats.stars && game.stats.stars[0]) {
        const star = game.stats.stars[0];
        lines.push(`Destaque: ${star.name} (${star.points} pts, ${star.rebounds} reb, ${star.assists} ast)`);
      }
    });
    return lines;
  };

  const getNextUserGame = () => {
    const gameState = getState();
    if (!gameState) return null;
    return gameState.schedule.find(
      (g) => !g.played && (g.home === gameState.userTeamId || g.away === gameState.userTeamId)
    );
  };

  const getStandings = () => {
    const gameState = getState();
    if (!gameState) return null;
    const standings = gameState.teams.map((team) => ({
      id: team.id,
      name: team.name,
      conf: team.conf,
      wins: team.wins,
      losses: team.losses,
      ovr: team.ovr || 0
    }));

    if (gameState.league && gameState.league.conferences.length > 1) {
      return {
        Leste: standings.filter((team) => team.conf === 'Leste').sort((a, b) => b.wins - a.wins),
        Oeste: standings.filter((team) => team.conf === 'Oeste').sort((a, b) => b.wins - a.wins)
      };
    }
    return {
      Unica: standings.sort((a, b) => b.wins - a.wins)
    };
  };

  const startPlayoffs = () => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return;
    gameState.phase = 'playoffs';
    const standings = getStandings();
    const playoffTeams = gameState.league ? gameState.league.playoffTeams : 8;
    const usePlayIn = gameState.league && gameState.league.id === 'nba' && standings.Leste && standings.Oeste;

    const bracket = {
      east: [],
      west: [],
      rounds: [],
      playIn: null,
      champion: null
    };

    const simulateSingleGame = (teamA, teamB) => {
      const dummyGame = { home: teamA.id, away: teamB.id, played: false };
      if (window.GameSim) window.GameSim.simulateGame(dummyGame);
      return dummyGame.scoreHome >= dummyGame.scoreAway ? teamA : teamB;
    };

    const runPlayIn = (confTeams, confName) => {
      const seeds = confTeams.slice(0, 10).map((item) => deps.getTeamById(item.id));
      if (seeds.length < 10) {
        return { seeds: confTeams.slice(0, playoffTeams / 2), result: null };
      }
      const seed7 = seeds[6];
      const seed8 = seeds[7];
      const seed9 = seeds[8];
      const seed10 = seeds[9];
      const winner7 = simulateSingleGame(seed7, seed8);
      const loser7 = winner7.id === seed7.id ? seed8 : seed7;
      const winner9 = simulateSingleGame(seed9, seed10);
      const winner8 = simulateSingleGame(loser7, winner9);
      const result = { conf: confName, seed7: winner7.name, seed8: winner8.name };
      if (deps.logMessage) deps.logMessage('msg_playin', result);
      return {
        seeds: [...seeds.slice(0, 6).map((team) => ({ id: team.id })), { id: winner7.id }, { id: winner8.id }],
        result
      };
    };

    let east = [];
    let west = [];
    let playInResults = null;
    if (standings.Leste) {
      if (usePlayIn) {
        const output = runPlayIn(standings.Leste, 'Leste');
        east = output.seeds;
        playInResults = { ...(playInResults || {}), east: output.result };
      } else {
        east = standings.Leste.slice(0, playoffTeams / 2);
      }
    }
    if (standings.Oeste) {
      if (usePlayIn) {
        const output = runPlayIn(standings.Oeste, 'Oeste');
        west = output.seeds;
        playInResults = { ...(playInResults || {}), west: output.result };
      } else {
        west = standings.Oeste.slice(0, playoffTeams / 2);
      }
    }

    bracket.east = east;
    bracket.west = west;
    bracket.playIn = playInResults;

    const simulateSeries = (teamA, teamB) => {
      let winsA = 0;
      let winsB = 0;
      const gamesToWin = 4;
      while (winsA < gamesToWin && winsB < gamesToWin) {
        const dummyGame = { home: teamA.id, away: teamB.id, played: false };
        if (window.GameSim) window.GameSim.simulateGame(dummyGame);
        if (dummyGame.scoreHome > dummyGame.scoreAway) {
          winsA += 1;
        } else {
          winsB += 1;
        }
      }
      return winsA > winsB ? teamA : teamB;
    };

    const rounds = [];

    const runConference = (teams) => {
      let current = teams.map((item) => deps.getTeamById(item.id));
      const confRounds = [];
      while (current.length > 1) {
        const next = [];
        for (let i = 0; i < current.length; i += 2) {
          const winner = simulateSeries(current[i], current[i + 1]);
          confRounds.push({
            match: `${current[i].name} vs ${current[i + 1].name}`,
            winner: winner.name
          });
          next.push(winner);
        }
        current = next;
      }
      return { winner: current[0], confRounds };
    };

    let finalsWinner = null;
    if (standings.Unica) {
      const allTeams = standings.Unica.slice(0, playoffTeams);
      const result = runConference(allTeams);
      finalsWinner = result.winner;
      rounds.push(...result.confRounds);
    } else {
      const eastResult = runConference(east);
      const westResult = runConference(west);
      finalsWinner = simulateSeries(eastResult.winner, westResult.winner);
      rounds.push(...eastResult.confRounds, ...westResult.confRounds, {
        match: `${eastResult.winner.name} vs ${westResult.winner.name}`,
        winner: finalsWinner.name
      });
    }

    bracket.rounds = rounds;
    bracket.champion = finalsWinner ? finalsWinner.name : null;
    if (finalsWinner) {
      const candidates = finalsWinner.roster.map((player) => ({
        ...player,
        score: player.ovr + (player.scoring || 0) * 20 + (player.starLevel || 0) * 6
      }));
      const finalsMvp = candidates.sort((a, b) => b.score - a.score)[0];
      if (finalsMvp) {
        bracket.finalsMvp = finalsMvp.name;
        awardPlayer(finalsMvp.id, 'Finals MVP');
        if (deps.logMessage) deps.logMessage('msg_finals_mvp', { name: finalsMvp.name });
      }
    }
    gameState.playoffs = bracket;
    gameState.phase = 'offseason';
    if (deps.logMessage) deps.logMessage('msg_champion', { team: finalsWinner.name });
    gameState.skillPoints += 1;
    beginOffseason();
  };

  const simulateWorldLeaguesSeason = () => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return [];
    const leagues = gameState.worldLeagues || [];
    if (!leagues.length) return [];

    const getTeamByIdFromList = (teams, id) => teams.find((team) => team.id === id);

    const resetTeamSeasonStats = (team) => {
      team.wins = 0;
      team.losses = 0;
      team.roster.forEach((player) => {
        player.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, min: 0, tov: 0, fouls: 0 };
      });
    };

    const addSeasonStatsLite = (team, stats) => {
      stats.forEach((stat) => {
        const player = team.roster.find((p) => p.id === stat.playerId);
        if (!player) return;
        if (!player.seasonStats) {
          player.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, min: 0, tov: 0, fouls: 0 };
        }
        player.seasonStats.gp += 1;
        player.seasonStats.pts += stat.points;
        player.seasonStats.reb += stat.rebounds;
        player.seasonStats.ast += stat.assists;
        player.seasonStats.min += stat.minutes;
        player.seasonStats.tov += stat.turnovers || 0;
        player.seasonStats.fouls += stat.fouls || 0;
      });
    };

    const simulateGameLite = (game, teams) => {
      const home = getTeamByIdFromList(teams, game.home);
      const away = getTeamByIdFromList(teams, game.away);
      if (!home || !away) return;

      const homeOvr = deps.computeTeamOvr(home);
      const awayOvr = deps.computeTeamOvr(away);
      const homeMods = deps.applyTacticModifiers(home);
      const awayMods = deps.applyTacticModifiers(away);
      const homeBoost = 1.02 + homeMods.attack - awayMods.defense + (rand ? rand(-2, 2) : 0) / 100;
      const awayBoost = 1.0 + awayMods.attack - homeMods.defense + (rand ? rand(-2, 2) : 0) / 100;
      const pace = clamp ? clamp(1 + homeMods.pace + awayMods.pace, 0.85, 1.2) : 1;

      const homeScore = Math.round((86 + homeOvr * 0.62) * homeBoost * pace + (rand ? rand(-6, 6) : 0));
      const awayScore = Math.round((84 + awayOvr * 0.62) * awayBoost * pace + (rand ? rand(-6, 6) : 0));

      game.scoreHome = homeScore;
      game.scoreAway = awayScore;
      game.played = true;
      if (homeScore >= awayScore) {
        home.wins += 1;
        away.losses += 1;
      } else {
        away.wins += 1;
        home.losses += 1;
      }

      const stats = window.GameSim ? window.GameSim.generateGameStats(home, away, homeScore, awayScore) : null;
      if (!stats) return;
      game.stats = stats;
      addSeasonStatsLite(home, stats.home);
      addSeasonStatsLite(away, stats.away);
    };

    const getStandingsForLeague = (teams, league) => {
      const sortTeams = (list) => [...list].sort((a, b) => b.wins - a.wins || deps.computeTeamOvr(b) - deps.computeTeamOvr(a));
      if (league.conferences && league.conferences.length > 1) {
        const standings = {};
        league.conferences.forEach((conf) => {
          standings[conf] = sortTeams(teams.filter((team) => team.conf === conf));
        });
        return standings;
      }
      return { Unica: sortTeams(teams) };
    };

    const simulateSeriesLite = (teamA, teamB) => {
      let winsA = 0;
      let winsB = 0;
      while (winsA < 4 && winsB < 4) {
        const scoreA = deps.computeTeamOvr(teamA) + (rand ? rand(-6, 6) : 0);
        const scoreB = deps.computeTeamOvr(teamB) + (rand ? rand(-6, 6) : 0);
        if (scoreA >= scoreB) winsA += 1;
        else winsB += 1;
      }
      return { winner: winsA >= winsB ? teamA : teamB, winsA, winsB };
    };

    const simulateLeaguePlayoffs = (league, teams, standings) => {
      const rounds = [];
      const getRoundLabel = (count) => {
        if (count >= 8) return 'Quartas';
        if (count === 4) return 'Semifinal';
        if (count === 2) return 'Final';
        return 'Rodada';
      };
      const playoffTeams = league.playoffTeams || Math.min(8, teams.length);
      if (standings.Unica) {
        let round = standings.Unica.slice(0, playoffTeams);
        while (round.length > 1) {
          const next = [];
          for (let i = 0; i < Math.floor(round.length / 2); i += 1) {
            const teamA = round[i];
            const teamB = round[round.length - 1 - i];
            const result = simulateSeriesLite(teamA, teamB);
            rounds.push({
              round: getRoundLabel(round.length),
              match: `${teamA.name} vs ${teamB.name}`,
              winner: result.winner.name,
              score: `${result.winsA}-${result.winsB}`
            });
            next.push(result.winner);
          }
          round = next;
        }
        return { champion: round[0], rounds };
      }
      const confCount = league.conferences.length;
      const perConf = Math.max(1, Math.floor(playoffTeams / confCount));
      const confWinners = league.conferences.map((conf) => {
        let round = (standings[conf] || []).slice(0, perConf);
        while (round.length > 1) {
          const next = [];
          for (let i = 0; i < Math.floor(round.length / 2); i += 1) {
            const teamA = round[i];
            const teamB = round[round.length - 1 - i];
            const result = simulateSeriesLite(teamA, teamB);
            rounds.push({
              round: `${conf} ${getRoundLabel(round.length)}`,
              match: `${teamA.name} vs ${teamB.name}`,
              winner: result.winner.name,
              score: `${result.winsA}-${result.winsB}`
            });
            next.push(result.winner);
          }
          round = next;
        }
        return round[0];
      }).filter(Boolean);
      if (confWinners.length === 1) return { champion: confWinners[0], rounds };
      const finals = simulateSeriesLite(confWinners[0], confWinners[1]);
      rounds.push({
        round: 'Final',
        match: `${confWinners[0].name} vs ${confWinners[1].name}`,
        winner: finals.winner.name,
        score: `${finals.winsA}-${finals.winsB}`
      });
      return { champion: finals.winner, rounds };
    };

    const computeLeagueAwards = (teams) => {
      const players = teams.flatMap((team) => team.roster.map((player) => ({ ...player, teamId: team.id })));
      const getPpg = (player) => (player.seasonStats && player.seasonStats.gp)
        ? player.seasonStats.pts / player.seasonStats.gp
        : 0;
      const getRpg = (player) => (player.seasonStats && player.seasonStats.gp)
        ? player.seasonStats.reb / player.seasonStats.gp
        : 0;
      const getApg = (player) => (player.seasonStats && player.seasonStats.gp)
        ? player.seasonStats.ast / player.seasonStats.gp
        : 0;

      const scorer = [...players].sort((a, b) => getPpg(b) - getPpg(a) || computeOvr(b) - computeOvr(a))[0];
      const mvp = [...players].sort((a, b) => {
        const teamA = getTeamByIdFromList(teams, a.teamId);
        const teamB = getTeamByIdFromList(teams, b.teamId);
        const scoreA = getPpg(a) * 1.4 + getApg(a) * 0.6 + getRpg(a) * 0.4 + computeOvr(a) * 0.2 + (teamA ? teamA.wins : 0) * 0.05;
        const scoreB = getPpg(b) * 1.4 + getApg(b) * 0.6 + getRpg(b) * 0.4 + computeOvr(b) * 0.2 + (teamB ? teamB.wins : 0) * 0.05;
        return scoreB - scoreA;
      })[0];
      return {
        mvp: mvp ? `${mvp.name} (${getTeamByIdFromList(teams, mvp.teamId).name})` : '-',
        scorer: scorer ? `${scorer.name} (${getTeamByIdFromList(teams, scorer.teamId).name})` : '-'
      };
    };

    const simulateLeagueSeason = (league, teams) => {
      teams.forEach((team) => resetTeamSeasonStats(team));
      const schedule = deps.createSchedule(teams, league);
      schedule.forEach((game) => simulateGameLite(game, teams));
      const standings = getStandingsForLeague(teams, league);
      const playoffResult = simulateLeaguePlayoffs(league, teams, standings);
      const champion = playoffResult ? playoffResult.champion : null;
      const awards = computeLeagueAwards(teams);
      return { champion, awards, rounds: playoffResult ? playoffResult.rounds : [] };
    };

    return leagues.map((league) => {
      if (league.id === gameState.league.id) {
        const championName = gameState.playoffs ? gameState.playoffs.champion : '-';
        const championTeam = gameState.playoffs
          ? gameState.teams.find((team) => team.name === gameState.playoffs.champion)
          : null;
        const currentAwards = gameState.awardsHistory && gameState.awardsHistory.length
          ? gameState.awardsHistory[0]
          : null;
        const playoffsRounds = gameState.playoffs && gameState.playoffs.rounds ? gameState.playoffs.rounds : [];
        return {
          id: league.id,
          name: league.name,
          champion: championName,
          ovr: championTeam ? deps.computeTeamOvr(championTeam) : 0,
          mvp: currentAwards ? currentAwards.mvp : '-',
          scorer: currentAwards ? currentAwards.scorer : '-',
          playoffs: playoffsRounds
        };
      }
      const result = simulateLeagueSeason(league, league.teams);
      const champion = result.champion;
      return {
        id: league.id,
        name: league.name,
        champion: champion ? champion.name : '-',
        ovr: champion ? deps.computeTeamOvr(champion) : 0,
        mvp: result.awards.mvp,
        scorer: result.awards.scorer,
        playoffs: result.rounds || []
      };
    });
  };

  const simulateDay = (day, liveLog = null) => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return false;
    const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (deps.applyDailyRecovery) deps.applyDailyRecovery();
    const games = gameState.schedule.filter((g) => g.day === day && !g.played);
    games.forEach((game) => {
      const log = liveLog && (game.home === gameState.userTeamId || game.away === gameState.userTeamId) ? liveLog : null;
      if (window.GameSim) window.GameSim.simulateGame(game, log);
    });
    gameState.day = day + 1;
    if (gameState.day % 7 === 0) {
      if (deps.applyWeeklyProgression) deps.applyWeeklyProgression();
    }
    if (gameState.day > 0 && gameState.day % MONTH_LENGTH === 0) {
      if (deps.applyMonthlyFinance) deps.applyMonthlyFinance();
    }
    if (gameState.allStar && !gameState.allStar.done) {
      const mid = Math.floor(getTotalDays() / 2);
      if (gameState.day >= mid) {
        simulateAllStar();
      }
    }
    if (deps.updateLeagueStrategies) deps.updateLeagueStrategies();
    const endTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const elapsed = Math.max(0, endTime - startTime);
    if (gameState.performanceStats) {
      gameState.performanceStats.lastSimMs = elapsed;
      gameState.performanceStats.simDayTimes = (gameState.performanceStats.simDayTimes || []).concat(elapsed).slice(-30);
    }
    if (deps.hasActiveHumanGameOnDay && deps.hasActiveHumanGameOnDay(day)) {
      if (deps.queueHotseatSwitch) deps.queueHotseatSwitch();
      return true;
    }
    return false;
  };

  const evaluateObjectives = () => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return;
    const team = deps.getTeamById(gameState.userTeamId);
    const obj = gameState.objectives;
    if (!obj) return;
    const standings = getStandings();
    const confTable = standings[team.conf] || standings.Unica || [];
    const cutoff = gameState.league ? gameState.league.playoffTeams : 8;
    const reachedPlayoffs = confTable.slice(0, cutoff).some((item) => item.id === team.id);
    let success = true;
    if (team.wins < obj.targetWins) success = false;
    if (obj.reachPlayoffs && !reachedPlayoffs) success = false;
    if (team.budget < obj.targetBudget) success = false;
    if (success) {
      team.budget += 10;
      if (deps.logMessage) deps.logMessage('msg_board_happy');
      gameState.skillPoints += 1;
    } else {
      team.budget = Math.max(0, team.budget - 6);
      if (deps.logMessage) deps.logMessage('msg_board_unhappy');
    }
  };

  const handleEndSeason = () => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return;
    if (deps.logMessage) deps.logMessage('msg_offseason_process');
    evaluateObjectives();
    if (deps.handleInternationalTournament) deps.handleInternationalTournament();
    const awards = calculateAwards();
    gameState.awardsHistory.unshift(awards);
    const recap = buildSeasonRecap(awards);
    if (!gameState.seasonRecaps) gameState.seasonRecaps = [];
    gameState.seasonRecaps.unshift(recap);
    if (gameState.seasonRecaps.length > 5) {
      gameState.seasonRecaps = gameState.seasonRecaps.slice(0, 5);
    }
    const worldResults = simulateWorldLeaguesSeason();
    if (worldResults.length) {
      if (!gameState.worldLeaguesHistory) gameState.worldLeaguesHistory = [];
      gameState.worldLeaguesHistory.unshift({ season: gameState.season, leagues: worldResults });
      if (gameState.worldLeaguesHistory.length > 10) {
        gameState.worldLeaguesHistory = gameState.worldLeaguesHistory.slice(0, 10);
      }
    }

    gameState.teams.forEach((team) => {
      while (team.roster.length < 12) {
        if (deps.generatePlayer) {
          team.roster.push(deps.generatePlayer(randomChoice(POSITIONS), [19, 33], 46, 0, team.leagueId));
        }
      }

      applyProgression(team);
      team.roster.forEach((player) => {
        player.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, min: 0, tov: 0, fouls: 0 };
        player.seasonStartOvr = player.ovr;
        player.seasonStartAttrs = {
          attack: player.attack,
          defense: player.defense,
          physical: player.physical,
          shooting: player.shooting,
          passing: player.passing
        };
        player.lastTrainingGain = 0;
        player.lastTrainingAttr = null;
        player.ovrHistory = [player.ovr];
      });
      team.wins = 0;
      team.losses = 0;
    });

    gameState.season += 1;
    if (gameState.season > MAX_SEASONS) {
      gameState.phase = 'retired';
      if (deps.logMessage) deps.logMessage('msg_career_end');
      return;
    }
    gameState.phase = 'regular';
    if (deps.createSchedule) gameState.schedule = deps.createSchedule(gameState.teams, gameState.league);
    gameState.day = 0;
    if (deps.generateObjectives) {
      gameState.objectives = deps.generateObjectives(deps.getTeamById(gameState.userTeamId), gameState.league);
    }
    gameState.draftState = null;
    gameState.allStar = { season: gameState.season, done: false, history: gameState.allStar ? gameState.allStar.history : [] };
    gameState.trainingLog = [];
    gameState.progressLog = [];
    gameState.trainingFocus = null;
    gameState.trainingFilter = 'all';
    gameState.trainingSort = 'progress';

    if (deps.buildPickAssets) gameState.pickAssets = deps.buildPickAssets(gameState.teams, gameState.season);
    if (deps.createDraftPool) gameState.market.draftPool = deps.createDraftPool(60, gameState.league ? gameState.league.id : null);

    if (gameState.sponsor && gameState.sponsor.yearsLeft > 0) {
      const team = deps.getTeamById(gameState.userTeamId);
      team.budget += gameState.sponsor.bonus;
      team.fanMood = clamp ? clamp(team.fanMood + gameState.sponsor.fanBoost, 30, 99) : team.fanMood;
      gameState.sponsor.yearsLeft -= 1;
      if (gameState.sponsor.yearsLeft <= 0) {
        gameState.sponsor = null;
      }
    }
    if (deps.createBackup) deps.createBackup();
  };

  window.AppSeasonCore = {
    simulateDay,
    getCurrentDay,
    buildRoundLog,
    getNextUserGame,
    getStandings,
    startPlayoffs,
    simulateWorldLeaguesSeason,
    handleEndSeason
  };
})();
