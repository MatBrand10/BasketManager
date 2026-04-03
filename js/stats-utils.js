(() => {
  const computeTeamTotals = (stats) => stats.reduce((acc, item) => {
    acc.points += item.points || 0;
    acc.rebounds += item.rebounds || 0;
    acc.assists += item.assists || 0;
    acc.turnovers += item.turnovers || 0;
    acc.fouls += item.fouls || 0;
    return acc;
  }, {
    points: 0,
    rebounds: 0,
    assists: 0,
    turnovers: 0,
    fouls: 0
  });

  const estimatePossessions = (teamPoints, oppPoints, turnovers) => {
    const base = (teamPoints + oppPoints) / 2;
    return Math.max(60, Math.round(base + turnovers * 0.7));
  };

  const formatPct = (value) => `${(value * 100).toFixed(1)}%`;

  window.StatsUtils = {
    computeTeamTotals,
    estimatePossessions,
    formatPct
  };
})();
