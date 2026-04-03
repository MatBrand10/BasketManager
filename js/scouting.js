// Scouting and potential evaluation helpers.
// Loaded before app.js and uses window.t / window.GameCore at runtime.

(() => {
  const getTranslator = () => (typeof window.t === 'function' ? window.t : (key) => key);
  const getClamp = () => (window.AppUtils ? window.AppUtils.clamp : (v, min, max) => Math.max(min, Math.min(max, v)));
  const getPotentialMax = (player) => (
    window.GameCore && window.GameCore.getPotentialMax
      ? window.GameCore.getPotentialMax(player)
      : (player.potential || 75)
  );

  const getScoutingLevel = (team, gameState) => {
    const facility = team && team.facilities ? team.facilities.scouting || 1 : 1;
    const gm = gameState && gameState.gmSkills ? gameState.gmSkills.scouting || 1 : 1;
    return Math.max(1, facility + gm - 1);
  };

  const ensureScoutBias = (player) => {
    if (typeof player.scoutBias === 'number') return;
    player.scoutBias = parseFloat((Math.random() * 2 - 1).toFixed(2));
  };

  const getScoutingError = (level) => {
    if (level >= 5) return 0;
    if (level >= 4) return 2;
    if (level >= 3) return 4;
    if (level >= 2) return 6;
    return 10;
  };

  const getScoutedPotentialEstimate = (player, scoutLevel) => {
    const clamp = getClamp();
    ensureScoutBias(player);
    const maxPot = getPotentialMax(player);
    const error = getScoutingError(scoutLevel);
    const estimate = clamp(Math.round(maxPot + player.scoutBias * error), 55, 99);
    return { estimate, error };
  };

  const formatScoutedPotential = (player, scoutLevel) => {
    const clamp = getClamp();
    if (scoutLevel <= 1) return '??';
    const { estimate, error } = getScoutedPotentialEstimate(player, scoutLevel);
    if (error >= 4) {
      return `${clamp(estimate - error, 50, 99)} - ${clamp(estimate + error, 50, 99)}`;
    }
    return `${estimate}`;
  };

  const getVisiblePotentialMax = (player, scoutLevel) => (
    scoutLevel >= 5 ? getPotentialMax(player) : '??'
  );

  const getRiskLabel = (player, scoutLevel) => {
    const t = getTranslator();
    const error = getScoutingError(scoutLevel);
    const agePenalty = player.age >= 29 ? 2 : player.age <= 20 ? -1 : 0;
    const riskScore = error + agePenalty;
    if (riskScore <= 2) return t('risk_low');
    if (riskScore <= 6) return t('risk_med');
    return t('risk_high');
  };

  const getProjectionLabel = (player, scoutLevel) => {
    const t = getTranslator();
    const maxPot = scoutLevel >= 5
      ? getPotentialMax(player)
      : (scoutLevel >= 2 ? getScoutedPotentialEstimate(player, scoutLevel).estimate : 72);
    if (maxPot >= 86) return t('projection_high');
    if (maxPot >= 78) return t('projection_med');
    return t('projection_low');
  };

  const getRecommendationLabel = (player, scoutLevel) => {
    const t = getTranslator();
    const maxPot = scoutLevel >= 5
      ? getPotentialMax(player)
      : (scoutLevel >= 2 ? getScoutedPotentialEstimate(player, scoutLevel).estimate : 72);
    if (player.age >= 30 && maxPot < 78) return t('rec_trade');
    if (player.age <= 26 && maxPot >= 82) return t('rec_develop');
    return t('rec_keep');
  };

  window.Scouting = {
    getScoutingLevel,
    ensureScoutBias,
    getScoutingError,
    getScoutedPotentialEstimate,
    formatScoutedPotential,
    getVisiblePotentialMax,
    getRiskLabel,
    getProjectionLabel,
    getRecommendationLabel
  };
})();
