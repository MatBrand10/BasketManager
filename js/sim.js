// Simulation helpers (games and stats).
// Loaded before app.js; uses window.GameSimDeps at runtime.

(() => {
const { rand, clamp } = window.AppUtils || {};

const getDeps = () => window.GameSimDeps || {};

const generateGameStats = (home, away, homeScore, awayScore) => {
  const deps = getDeps();
  const ensureRotation = deps.ensureRotation || (() => {});
  const localClamp = clamp || ((value, min, max) => Math.max(min, Math.min(max, value)));
  const localRand = rand || ((min, max) => Math.floor(Math.random() * (max - min + 1)) + min);
  const allPlayers = [];

  const buildStatsForTeam = (team, scoreTarget) => {
    ensureRotation(team);
    const starters = team.rotation.starters
      .map((id) => team.roster.find((p) => p.id === id))
      .filter((p) => p && p.injuryDays === 0);
    const bench = team.roster.filter((p) => !team.rotation.starters.includes(p.id) && p.injuryDays === 0);
    const players = [...starters, ...bench];

    const stats = players.map((player, index) => {
      const baseMinutes = index < 5 ? localRand(30, 36) : localRand(8, 22);
      const usage = localClamp(((player.shooting + player.attack + player.passing) / 300)
        + (player.scoring || 0) * 0.2 + (player.starLevel || 0) * 0.04, 0.25, 0.85);
      const points = Math.max(0, Math.round(baseMinutes * usage * localRand(1, 3)));
      const rebounds = Math.max(0, Math.round(baseMinutes * (player.physical / 110) * localRand(0.5, 1.2)));
      const assists = Math.max(0, Math.round(baseMinutes * (player.passing / 120) * localRand(0.4, 1.0)));
      const turnovers = localClamp(Math.round(baseMinutes * (1 - player.passing / 120) * localRand(0.25, 0.7)), 0, 6);
      const fouls = localClamp(Math.round(baseMinutes * (player.defense / 130) * localRand(0.2, 0.7)), 0, 6);
      return {
        playerId: player.id,
        name: player.name,
        minutes: baseMinutes,
        points,
        rebounds,
        assists,
        turnovers,
        fouls
      };
    });

    const total = stats.reduce((acc, item) => acc + item.points, 0) || 1;
    stats.forEach((item) => {
      item.points = Math.round((item.points / total) * scoreTarget);
    });

    const adjust = scoreTarget - stats.reduce((acc, item) => acc + item.points, 0);
    if (stats[0]) {
      stats[0].points += adjust;
    }

    return stats;
  };

  const homeStats = buildStatsForTeam(home, homeScore);
  const awayStats = buildStatsForTeam(away, awayScore);

  homeStats.forEach((s) => allPlayers.push(s));
  awayStats.forEach((s) => allPlayers.push(s));

  const stars = [...allPlayers].sort((a, b) => (
    b.points + b.rebounds + b.assists - (a.points + a.rebounds + a.assists)
  )).slice(0, 3);

  return {
    home: homeStats,
    away: awayStats,
    stars
  };
};

const simulateGame = (game, log = []) => {
  const deps = getDeps();
  const gameState = deps.getState ? deps.getState() : null;
  if (!gameState) return;

  const {
    getTeamById,
    computeTeamOvr,
    applyTacticModifiers,
    updateFanFeedback,
    updateMoraleAfterGame,
    applyFatigueAndInjury,
    buildLiveNarrative
  } = deps;

  const localClamp = clamp || ((value, min, max) => Math.max(min, Math.min(max, value)));
  const localRand = rand || ((min, max) => Math.floor(Math.random() * (max - min + 1)) + min);

  const home = getTeamById(game.home);
  const away = getTeamById(game.away);

  const homeOvr = computeTeamOvr(home);
  const awayOvr = computeTeamOvr(away);

  const homeMods = applyTacticModifiers(home);
  const awayMods = applyTacticModifiers(away);

  const homeBoost = 1.04 + homeMods.attack - awayMods.defense + localRand(-2, 2) / 100;
  const awayBoost = 1.01 + awayMods.attack - homeMods.defense + localRand(-2, 2) / 100;

  const pace = localClamp(1 + homeMods.pace + awayMods.pace, 0.85, 1.2);

  const homeScore = Math.round((88 + homeOvr * 0.65) * homeBoost * pace + localRand(-6, 6));
  const awayScore = Math.round((86 + awayOvr * 0.65) * awayBoost * pace + localRand(-6, 6));

  game.scoreHome = homeScore;
  game.scoreAway = awayScore;
  game.played = true;

  if (homeScore > awayScore) {
    home.wins += 1;
    away.losses += 1;
  } else {
    away.wins += 1;
    home.losses += 1;
  }

  const updateFanMood = (team, won) => {
    const delta = won ? localRand(1, 3) : -localRand(1, 3);
    team.fanMood = localClamp(team.fanMood + delta, 30, 99);
  };
  updateFanMood(home, homeScore > awayScore);
  updateFanMood(away, awayScore > homeScore);
  updateFanFeedback(home);
  updateFanFeedback(away);

  const ticketRevenue = (team, isHome) => {
    const financeSkill = gameState.gmSkills ? gameState.gmSkills.finance : 1;
    const financeStaff = gameState.staff ? gameState.staff.finance : 0;
    const financeBonus = 1 + (financeSkill - 1) * 0.03 + financeStaff * 0.02;
    const base = 0.6 + team.fanBase / 90 + team.fanMood / 120;
    const arenaFactor = 1 + (team.facilities ? team.facilities.arena : 1) * 0.18;
    const homeFactor = isHome ? 1.15 : 0.6;
    return parseFloat((base * arenaFactor * homeFactor * financeBonus).toFixed(2));
  };
  home.budget += ticketRevenue(home, true);
  away.budget += ticketRevenue(away, false);

  const stats = generateGameStats(home, away, homeScore, awayScore);
  game.stats = stats;
  const addSeasonStats = (team, items) => {
    items.forEach((stat) => {
      const player = team.roster.find((p) => p.id === stat.playerId);
      if (!player) return;
      if (!player.seasonStats) {
        player.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, min: 0, tov: 0, fouls: 0 };
      }
      if (typeof player.seasonStats.tov !== 'number') player.seasonStats.tov = 0;
      if (typeof player.seasonStats.fouls !== 'number') player.seasonStats.fouls = 0;
      player.seasonStats.gp += 1;
      player.seasonStats.pts += stat.points;
      player.seasonStats.reb += stat.rebounds;
      player.seasonStats.ast += stat.assists;
      player.seasonStats.min += stat.minutes;
      player.seasonStats.tov += stat.turnovers || 0;
      player.seasonStats.fouls += stat.fouls || 0;
    });
  };
  addSeasonStats(home, stats.home);
  addSeasonStats(away, stats.away);
  updateMoraleAfterGame(home, stats.home, homeScore > awayScore);
  updateMoraleAfterGame(away, stats.away, awayScore > homeScore);
  applyFatigueAndInjury(home, stats.home, home.id === gameState.userTeamId);
  applyFatigueAndInjury(away, stats.away, away.id === gameState.userTeamId);

  if (log) {
    log.meta = {
      day: game.day,
      league: gameState.league ? gameState.league.name : '',
      homeId: home.id,
      awayId: away.id,
      homeName: home.name,
      awayName: away.name,
      homeScore,
      awayScore,
      stats
    };
    const narrative = buildLiveNarrative(home, away, homeScore, awayScore, stats, pace);
    log.meta.quarters = narrative.quarters;
    narrative.lines.forEach((line) => log.push(line));
  }

  if (Math.random() < 0.12) {
    const bonus = localRand(1, 3);
    home.budget += bonus;
    away.budget += bonus;
  }
};

window.GameSim = {
  simulateGame,
  generateGameStats
};
})();
