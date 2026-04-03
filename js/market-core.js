
(() => {
  const getDeps = () => window.AppMarketCoreDeps || {};
  const getState = () => {
    const deps = getDeps();
    return typeof deps.getState === 'function' ? deps.getState() : null;
  };
  const { rand, randomChoice } = window.AppUtils || {};
  const { getPotentialMax } = window.GameCore || {};

  const scoreFreeAgentForTeam = (player, team) => {
    const deps = getDeps();
    const strategy = team.strategy || (deps.getTeamStrategy ? deps.getTeamStrategy(team) : 'balanced');
    const base = deps.playerValue ? deps.playerValue(player, strategy) : player.ovr;
    const need = deps.getNeedMultiplier ? deps.getNeedMultiplier(team, player.pos) : 1;
    const potGap = Math.max(0, (getPotentialMax ? getPotentialMax(player) : player.potential || player.ovr) - player.ovr);
    const potBonus = strategy === 'rebuild' ? potGap * 0.6 : 0;
    const agePenalty = strategy === 'contender' ? Math.max(0, player.age - 29) * 0.8 : 0;
    const salaryPenalty = (player.salary || 0) * 1.4;
    return base * need + potBonus - agePenalty - salaryPenalty;
  };

  const pickSurplusPlayer = (team) => (
    [...team.roster]
      .sort((a, b) => {
        const deps = getDeps();
        const needA = deps.getNeedMultiplier ? deps.getNeedMultiplier(team, a.pos) : 1;
        const needB = deps.getNeedMultiplier ? deps.getNeedMultiplier(team, b.pos) : 1;
        if (needA !== needB) return needA - needB;
        return a.ovr - b.ovr;
      })[0]
  );

  const pickNeedPlayer = (team) => (
    [...team.roster]
      .sort((a, b) => {
        const deps = getDeps();
        const needA = deps.getNeedMultiplier ? deps.getNeedMultiplier(team, a.pos) : 1;
        const needB = deps.getNeedMultiplier ? deps.getNeedMultiplier(team, b.pos) : 1;
        if (needA !== needB) return needB - needA;
        return b.ovr - a.ovr;
      })[0]
  );

  const trimRoster = (team) => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return;
    while (team.roster.length > 15) {
      const cut = [...team.roster].sort((a, b) => (deps.getTradeValue ? deps.getTradeValue(a, team) : a.ovr) - (deps.getTradeValue ? deps.getTradeValue(b, team) : b.ovr))[0];
      if (!cut) break;
      team.roster = team.roster.filter((p) => p.id !== cut.id);
      gameState.market.freeAgents.push(cut);
    }
  };

  const runAIFrontOffice = () => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return;
    gameState.teams.forEach((team) => {
      if (team.id === gameState.userTeamId) return;
      if (Math.random() < 0.2) {
        const first = (deps.FIRST_NAMES || FIRST_NAMES || []);
        const last = (deps.LAST_NAMES || LAST_NAMES || []);
        const pickFirst = deps.randomChoice || randomChoice;
        team.coach = `${pickFirst(first)} ${pickFirst(last)}`;
      }
      if (deps.updateTeamStrategy) deps.updateTeamStrategy(team);
    });

    const aiTeams = gameState.teams.filter((t) => t.id !== gameState.userTeamId);
    for (let i = 0; i < 4; i += 1) {
      const pick = deps.randomChoice || randomChoice;
      const teamA = pick(aiTeams);
      const teamB = pick(aiTeams.filter((t) => t.id !== teamA.id));
      if (!teamA || !teamB) continue;
      const playerA = pickSurplusPlayer(teamA);
      const playerB = pickNeedPlayer(teamB);
      if (!playerA || !playerB) continue;
      const gainA = (deps.getTradeValue ? deps.getTradeValue(playerB, teamA) : playerB.ovr) - (deps.getTradeValue ? deps.getTradeValue(playerA, teamA) : playerA.ovr);
      const gainB = (deps.getTradeValue ? deps.getTradeValue(playerA, teamB) : playerA.ovr) - (deps.getTradeValue ? deps.getTradeValue(playerB, teamB) : playerB.ovr);
      if (gainA > 2 && gainB > 2) {
        teamA.roster = teamA.roster.filter((p) => p.id !== playerA.id).concat(playerB);
        teamB.roster = teamB.roster.filter((p) => p.id !== playerB.id).concat(playerA);
      }
    }

    aiTeams.forEach((team) => {
      trimRoster(team);
      const strategy = team.strategy || (deps.getTeamStrategy ? deps.getTeamStrategy(team) : 'balanced');
      const freeAgents = gameState.market.freeAgents;
      if (!freeAgents.length) return;
      const ranked = freeAgents
        .map((player) => ({ player, score: scoreFreeAgentForTeam(player, team) }))
        .sort((a, b) => b.score - a.score);
      let attempts = 0;
      while (team.roster.length < 12 && attempts < ranked.length) {
        const candidate = ranked[attempts].player;
        const minOvr = strategy === 'contender' ? 68 : strategy === 'balanced' ? 62 : 58;
        const okAge = strategy !== 'rebuild' || candidate.age <= 27 || (getPotentialMax ? getPotentialMax(candidate) : candidate.potential || candidate.ovr) - candidate.ovr >= 8;
        if (candidate.ovr >= minOvr && okAge && team.budget >= candidate.salary) {
          const index = freeAgents.findIndex((p) => p.id === candidate.id);
          if (index >= 0) {
            const hired = freeAgents.splice(index, 1)[0];
            if (Math.random() < 0.25) {
              hired.optionType = Math.random() < 0.5 ? 'team' : 'player';
            }
            team.roster.push(hired);
            team.budget -= hired.salary;
          }
        }
        attempts += 1;
      }
    });
  };

  const applyInterLeagueTransfers = () => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return;
    const otherLeagues = (gameState.worldLeagues || []).filter((l) => l.id !== gameState.league.id);
    if (!otherLeagues.length) return;
    const pick = deps.randomChoice || randomChoice;
    const roll = deps.rand || rand;
    const incoming = roll ? roll(4, 8) : 5;
    for (let i = 0; i < incoming; i += 1) {
      const fromLeague = pick(otherLeagues);
      const fromTeam = pick(fromLeague.teams);
      if (!fromTeam || !fromTeam.roster.length) continue;
      const player = pick(fromTeam.roster);
      fromTeam.roster = fromTeam.roster.filter((p) => p.id !== player.id);
      player.originLeague = fromLeague.id;
      gameState.market.freeAgents.push(player);
    }

    const outgoing = roll ? roll(3, 6) : 4;
    for (let i = 0; i < outgoing; i += 1) {
      const fromTeam = pick(gameState.teams);
      if (!fromTeam || !fromTeam.roster.length) continue;
      const player = pick(fromTeam.roster);
      if (player.starLevel >= 3) continue;
      const toLeague = pick(otherLeagues);
      const toTeam = pick(toLeague.teams);
      fromTeam.roster = fromTeam.roster.filter((p) => p.id !== player.id);
      toTeam.roster.push(player);
    }
    if (typeof deps.logMessage === 'function') {
      deps.logMessage('msg_interleague');
    }
  };

  window.AppMarketCore = {
    scoreFreeAgentForTeam,
    pickSurplusPlayer,
    pickNeedPlayer,
    trimRoster,
    runAIFrontOffice,
    applyInterLeagueTransfers
  };
})();
