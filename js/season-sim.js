(() => {
  const getDeps = () => window.AppSeasonDeps || {};
  const getState = () => {
    const deps = getDeps();
    return typeof deps.getState === 'function' ? deps.getState() : null;
  };
  const { rand } = window.AppUtils || {};
  const { computeOvr } = window.GameCore || {};
  const { t } = window.AppText || {};

  const getInternationalCycle = (season) => {
    if (season % 4 === 0) return 'Olimpiadas';
    if (season % 4 === 2) return 'Copa do Mundo';
    return null;
  };

  const buildNationalTeams = () => {
    const gameState = getState();
    if (!gameState) return [];
    const playersPool = [];
    if (gameState.worldLeagues) {
      gameState.worldLeagues.forEach((league) => {
        league.teams.forEach((team) => {
          team.roster.forEach((player) => playersPool.push(player));
        });
      });
    } else {
      gameState.teams.forEach((team) => {
        team.roster.forEach((player) => playersPool.push(player));
      });
    }

    return NATIONALITIES.map((nation) => {
      const players = playersPool.filter((player) => player.nationality === nation);
      const top = players.sort((a, b) => computeOvr(b) - computeOvr(a)).slice(0, 12);
      const rating = top.length
        ? Math.round(top.reduce((acc, p) => acc + computeOvr(p), 0) / top.length)
        : 60 + (rand ? rand(-5, 5) : 0);
      return { nation, rating, roster: top };
    }).filter((team) => team.roster.length);
  };

  const simulateInternational = (name) => {
    const teams = buildNationalTeams();
    if (!teams.length) return null;
    const play = (a, b) => {
      const diff = (a.rating - b.rating) * 0.35;
      const roll = (rand ? rand(-8, 8) : Math.floor(Math.random() * 17) - 8);
      return diff + roll >= 0 ? a : b;
    };
    let pool = [...teams];
    while (pool.length > 1) {
      const next = [];
      for (let i = 0; i < pool.length; i += 2) {
        if (!pool[i + 1]) {
          next.push(pool[i]);
        } else {
          next.push(play(pool[i], pool[i + 1]));
        }
      }
      pool = next;
    }
    return { name, champion: pool[0].nation, rating: pool[0].rating };
  };

  const handleInternationalTournament = () => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return;
    const cycle = getInternationalCycle(gameState.season);
    if (!cycle) return;
    const result = simulateInternational(cycle);
    if (!result) return;
    gameState.international = gameState.international || { history: [] };
    gameState.international.history.unshift({
      season: gameState.season,
      name: cycle,
      champion: result.champion
    });
    if (gameState.international.history.length > 12) {
      gameState.international.history = gameState.international.history.slice(0, 12);
    }
    if (typeof deps.logMessage === 'function') {
      deps.logMessage('msg_international_champion', { name: cycle, champion: result.champion });
    } else if (gameState.messages) {
      gameState.messages.unshift(`${cycle}: ${result.champion}`);
    }
  };

  window.AppSeason = {
    getInternationalCycle,
    buildNationalTeams,
    simulateInternational,
    handleInternationalTournament
  };
})();
