// Core game helpers (player generation, ratings, nationality).
// Loaded before app.js via index.html.

(() => {
const {
  rand,
  randomChoice,
  createId,
  clamp,
  weightedChoice
} = window.AppUtils || {};

const getSecondaryPositions = (pos) => {
  const options = SECONDARY_POSITION_MAP[pos] || [];
  if (!options.length) return [];
  const count = options.length === 1 ? 1 : (Math.random() < 0.7 ? 1 : 2);
  return [...options].sort(() => Math.random() - 0.5).slice(0, count);
};

const getNationalityForLeague = (leagueId) => {
  const pool = LEAGUE_NATIONALITY_WEIGHTS[leagueId];
  if (!pool) return randomChoice(NATIONALITIES);
  return weightedChoice(pool);
};

const getNamePoolForNationality = (nationality) => (
  NAME_POOLS[nationality] || { first: FIRST_NAMES, last: LAST_NAMES }
);

const buildPlayerName = (nationality) => {
  const pool = getNamePoolForNationality(nationality);
  return `${randomChoice(pool.first)} ${randomChoice(pool.last)}`;
};

const computeOvr = (player) => {
  const total = player.attack + player.defense + player.physical + player.shooting + player.passing;
  return Math.round(total / 5);
};

const getPotentialMax = (player) => {
  const value = typeof player.potentialMax === 'number' ? player.potentialMax : player.potential || 75;
  return clamp(value, 55, 99);
};

const updatePlayerRole = (player) => {
  player.starLevel = player.ovr >= 85 ? 3 : player.ovr >= 78 ? 2 : player.ovr >= 70 ? 1 : 0;
  player.role = player.starLevel >= 3 ? 'Estrela' : player.starLevel === 2 ? 'Titular' : player.starLevel === 1 ? 'Rotacao' : 'Prospecto';
};

const assignTraits = (player) => {
  const traits = [];
  if (player.shooting >= 85) traits.push('Sniper');
  if (player.attack >= 85) traits.push('Atacante');
  if (player.physical >= 85) traits.push('Dunker');
  if (player.defense >= 85) traits.push('Defensor');
  if (player.passing >= 85) traits.push('Playmaker');
  if (player.starLevel >= 3) traits.push('Clutch');
  if (traits.length < 2 && player.archetype) traits.push(player.archetype);
  player.traits = traits.slice(0, 3);
};

const computeEffectiveOvr = (player) => {
  const base = computeOvr(player);
  const staminaFactor = 0.7 + (player.energy / 200);
  return Math.round(base * staminaFactor);
};

const generatePlayer = (pos, ageRange = [19, 34], base = 45, starBoost = 0, leagueId = null) => {
  const age = rand(ageRange[0], ageRange[1]);
  const potential = clamp(rand(55, 99) - Math.max(0, age - 27) * 2 + starBoost, 50, 99);
  const potentialMax = clamp(potential + rand(2, 8) + Math.round(starBoost / 3), potential, 99);
  const archetype = randomChoice(ARCHETYPES);
  const mod = rand(-6, 6);
  const raw = base + rand(0, 40) + mod + starBoost;
  const attack = clamp(Math.round(raw * archetype.weights.attack), 30, 99);
  const defense = clamp(Math.round(raw * archetype.weights.defense), 30, 99);
  const physical = clamp(Math.round(raw * archetype.weights.physical), 30, 99);
  const shooting = clamp(Math.round(raw * archetype.weights.shooting), 30, 99);
  const passing = clamp(Math.round(raw * archetype.weights.passing), 30, 99);

  const salary = clamp(1 + (attack + defense + physical + shooting + passing) / 50, 0.5, 30);
  const overall = Math.round((attack + defense + physical + shooting + passing) / 5);
  const starLevel = overall >= 85 ? 3 : overall >= 78 ? 2 : overall >= 70 ? 1 : 0;
  const role = starLevel >= 3 ? 'Estrela' : starLevel === 2 ? 'Titular' : starLevel === 1 ? 'Rotacao' : 'Prospecto';
  const scoring = clamp((shooting + attack) / 200 + (archetype.id === 'scorer' ? 0.12 : 0), 0.2, 0.95);
  const nationality = getNationalityForLeague(leagueId);

  const player = {
    id: createId(),
    name: buildPlayerName(nationality),
    nationality,
    pos,
    secondaryPos: getSecondaryPositions(pos),
    age,
    potential,
    potentialMax,
    scoutBias: parseFloat((Math.random() * 2 - 1).toFixed(2)),
    archetype: archetype.label,
    role,
    starLevel,
    scoring,
    attack,
    defense,
    physical,
    shooting,
    passing,
    salary: parseFloat(salary.toFixed(1)),
    contractYears: rand(1, 4),
    morale: rand(60, 90),
    moraleState: 'neutral',
    lastMoraleAlertDay: -99,
    seasonStats: {
      gp: 0,
      pts: 0,
      reb: 0,
      ast: 0,
      min: 0,
      tov: 0,
      fouls: 0
    },
    energy: rand(70, 100),
    injuryDays: 0,
    awards: [],
    optionType: null
  };
  player.ovr = overall;
  updatePlayerRole(player);
  assignTraits(player);
  return player;
};

window.GameCore = {
  getSecondaryPositions,
  getNationalityForLeague,
  buildPlayerName,
  computeOvr,
  getPotentialMax,
  computeEffectiveOvr,
  updatePlayerRole,
  assignTraits,
  generatePlayer
};
})();
