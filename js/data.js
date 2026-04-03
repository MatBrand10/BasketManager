// Data tables split from app.js for maintainability.
// Loaded before app.js via index.html.

const FORMATIONS = [
  { id: 'balanced', label: 'Equilibrado', atk: 0.0, def: 0.0, pace: 0.0 },
  { id: 'small', label: 'Small Ball', atk: 0.06, def: -0.04, pace: 0.05 },
  { id: 'defense', label: 'Defesa Forte', atk: -0.04, def: 0.08, pace: -0.02 },
  { id: 'offense', label: 'Ofensivo', atk: 0.09, def: -0.06, pace: 0.02 },
  { id: 'pace', label: 'Transicao Total', atk: 0.04, def: -0.03, pace: 0.12 },
  { id: 'inside', label: 'Jogo Interno', atk: 0.05, def: 0.02, pace: -0.05 },
  { id: 'switch', label: 'Trocas Totais', atk: 0.02, def: 0.06, pace: 0.01 }
];

const STRATEGIES = [
  { id: 'fast', label: 'Ataque Rapido', atk: 0.05, def: -0.03, pace: 0.08 },
  { id: 'zone', label: 'Defesa Zona', atk: -0.02, def: 0.06, pace: -0.02 },
  { id: 'half', label: 'Meia Quadra', atk: 0.02, def: 0.02, pace: -0.04 },
  { id: 'press', label: 'Pressao Total', atk: 0.03, def: 0.05, pace: 0.03 },
  { id: 'motion', label: 'Movimentacao', atk: 0.04, def: 0.0, pace: 0.02 },
  { id: 'drop', label: 'Protecao do Garrafao', atk: -0.01, def: 0.07, pace: -0.02 },
  { id: 'iso', label: 'Isolacao', atk: 0.06, def: -0.04, pace: 0.0 }
];

// Tactical profiles used for AI teams and previews.
const TACTICAL_PROFILES = [
  { id: 'run-gun', style: 'style_run_gun', formation: 'pace', strategy: 'fast', strengths: ['pace', 'shooting'] },
  { id: 'grit', style: 'style_grit', formation: 'defense', strategy: 'drop', strengths: ['defense', 'physical'] },
  { id: 'flow', style: 'style_flow', formation: 'balanced', strategy: 'motion', strengths: ['playmaking', 'shooting'] },
  { id: 'inside', style: 'style_inside', formation: 'inside', strategy: 'half', strengths: ['attack', 'physical'] },
  { id: 'switch', style: 'style_switch', formation: 'switch', strategy: 'press', strengths: ['defense', 'pace'] }
];

const TRAINING_FOCUS = [
  { id: 'attack', label: 'Ataque' },
  { id: 'defense', label: 'Defesa' },
  { id: 'physical', label: 'Fisico' },
  { id: 'shooting', label: 'Arremesso' },
  { id: 'passing', label: 'Passe' }
];

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const POSITION_SLOTS = ['PG', 'SG', 'SF', 'PF', 'C'];

const SECONDARY_POSITION_MAP = {
  PG: ['SG'],
  SG: ['PG', 'SF'],
  SF: ['SG', 'PF'],
  PF: ['SF', 'C'],
  C: ['PF']
};

const LEAGUE_NATIONALITY_WEIGHTS = {
  nba: [
    ['Estados Unidos', 64],
    ['Canada', 10],
    ['Franca', 4],
    ['Espanha', 4],
    ['Italia', 3],
    ['Alemanha', 3],
    ['Servia', 4],
    ['Lituania', 3],
    ['Grecia', 2],
    ['Turquia', 2],
    ['Australia', 3],
    ['Brasil', 1],
    ['Argentina', 1],
    ['Nigeria', 2],
    ['Japao', 1],
    ['China', 1]
  ],
  nbb: [
    ['Brasil', 55],
    ['Argentina', 15],
    ['Estados Unidos', 8],
    ['Canada', 4],
    ['Espanha', 4],
    ['Franca', 3],
    ['Italia', 3],
    ['Alemanha', 2],
    ['Servia', 2],
    ['Lituania', 1],
    ['Grecia', 1],
    ['Turquia', 1],
    ['Australia', 1]
  ],
  euroleague: [
    ['Espanha', 14],
    ['Franca', 12],
    ['Italia', 10],
    ['Alemanha', 10],
    ['Servia', 10],
    ['Lituania', 8],
    ['Grecia', 8],
    ['Turquia', 8],
    ['Estados Unidos', 10],
    ['Canada', 4],
    ['Brasil', 3],
    ['Argentina', 3]
  ],
  acb: [
    ['Espanha', 45],
    ['Franca', 10],
    ['Italia', 6],
    ['Alemanha', 6],
    ['Servia', 5],
    ['Lituania', 4],
    ['Grecia', 4],
    ['Turquia', 4],
    ['Estados Unidos', 10],
    ['Canada', 3],
    ['Brasil', 3]
  ],
  lnb: [
    ['Franca', 45],
    ['Espanha', 8],
    ['Italia', 6],
    ['Alemanha', 6],
    ['Servia', 5],
    ['Lituania', 4],
    ['Grecia', 4],
    ['Turquia', 4],
    ['Estados Unidos', 10],
    ['Canada', 3],
    ['Brasil', 3]
  ]
};

const NATIONALITIES = [
  'Brasil', 'Argentina', 'Espanha', 'Franca', 'Italia', 'Alemanha',
  'Canada', 'Estados Unidos', 'Australia', 'Servia', 'Lituania', 'Grecia',
  'Turquia', 'Nigeria', 'Japao', 'China'
];

const ARCHETYPES = [
  { id: 'scorer', label: 'Pontuador', weights: { attack: 1.1, shooting: 1.2, passing: 0.9, defense: 0.9, physical: 0.95 } },
  { id: 'defender', label: 'Defensor', weights: { attack: 0.85, shooting: 0.8, passing: 0.95, defense: 1.25, physical: 1.1 } },
  { id: 'playmaker', label: 'Armador', weights: { attack: 1.0, shooting: 0.95, passing: 1.25, defense: 0.9, physical: 0.9 } },
  { id: 'rebounder', label: 'Reboteiro', weights: { attack: 0.9, shooting: 0.85, passing: 0.85, defense: 1.1, physical: 1.25 } },
  { id: 'two-way', label: 'Two-Way', weights: { attack: 1.0, shooting: 1.0, passing: 1.0, defense: 1.0, physical: 1.0 } }
];

const ROLE_LEVELS = ['Estrela', 'Titular', 'Rotacao', 'Prospecto'];

const MAX_SEASONS = 15;
const MAX_STAFF_LEVEL = 5;
const MAX_GM_SKILL = 5;
const MONTH_LENGTH = 30;

const SPONSORS = [
  { id: 'street', name: 'Street Gear', bonus: 8, fanBoost: 4 },
  { id: 'sportx', name: 'SportX', bonus: 10, fanBoost: 2 },
  { id: 'aeroline', name: 'AeroLine', bonus: 14, fanBoost: -2 },
  { id: 'megabank', name: 'MegaBank', bonus: 12, fanBoost: 0 },
  { id: 'pulse', name: 'Pulse Energy', bonus: 6, fanBoost: 6 }
];

const TEAM_COLOR_PALETTE = [
  ['#4cc3ff', '#ffb347'],
  ['#ff6b6b', '#ffd166'],
  ['#6bff95', '#00b894'],
  ['#a29bfe', '#81ecec'],
  ['#fd79a8', '#ffeaa7'],
  ['#74b9ff', '#55efc4'],
  ['#ffeaa7', '#fab1a0'],
  ['#00cec9', '#0984e3'],
  ['#e17055', '#fdcb6e'],
  ['#6c5ce7', '#00b894']
];

const LEAGUES = [
  {
    id: 'nba',
    name: 'NBA',
    country: 'EUA',
    gamesPerTeam: 82,
    conferences: ['Leste', 'Oeste'],
    playoffTeams: 16,
    draftLottery: true,
    teams: [
      { city: 'New York', nickname: 'Skyliners' },
      { city: 'Los Angeles', nickname: 'Waves' },
      { city: 'Chicago', nickname: 'Forge' },
      { city: 'Miami', nickname: 'Flames' },
      { city: 'Boston', nickname: 'Harbors' },
      { city: 'Dallas', nickname: 'Outlaws' },
      { city: 'Houston', nickname: 'Comets' },
      { city: 'Phoenix', nickname: 'Suns' },
      { city: 'Denver', nickname: 'Peaks' },
      { city: 'Seattle', nickname: 'Storm' },
      { city: 'Atlanta', nickname: 'Aviators' },
      { city: 'Detroit', nickname: 'Motors' },
      { city: 'Orlando', nickname: 'Wizards' },
      { city: 'Minneapolis', nickname: 'Lakes' },
      { city: 'San Francisco', nickname: 'Bridges' },
      { city: 'San Diego', nickname: 'Tritons' },
      { city: 'Las Vegas', nickname: 'Royals' },
      { city: 'New Orleans', nickname: 'Jazz' },
      { city: 'Philadelphia', nickname: 'Founders' },
      { city: 'Washington', nickname: 'Capitals' },
      { city: 'Charlotte', nickname: 'Rebels' },
      { city: 'Cleveland', nickname: 'Lancers' },
      { city: 'Milwaukee', nickname: 'Bucks' },
      { city: 'Portland', nickname: 'Pines' },
      { city: 'Sacramento', nickname: 'Gold' },
      { city: 'Salt Lake', nickname: 'Summit' },
      { city: 'Memphis', nickname: 'Rhythm' },
      { city: 'Oklahoma City', nickname: 'Thunder' },
      { city: 'Toronto', nickname: 'North' },
      { city: 'Vancouver', nickname: 'Harbors' }
    ]
  },
  {
    id: 'nbb',
    name: 'NBB',
    country: 'Brasil',
    gamesPerTeam: 34,
    conferences: ['Unica'],
    playoffTeams: 8,
    draftLottery: false,
    teams: [
      { city: 'Sao Paulo', nickname: 'Tigres' },
      { city: 'Rio de Janeiro', nickname: 'Marins' },
      { city: 'Belo Horizonte', nickname: 'Mineros' },
      { city: 'Brasilia', nickname: 'Imperiais' },
      { city: 'Fortaleza', nickname: 'Ventos' },
      { city: 'Recife', nickname: 'Tubaroes' },
      { city: 'Salvador', nickname: 'Atunes' },
      { city: 'Curitiba', nickname: 'Pinhais' },
      { city: 'Porto Alegre', nickname: 'Guaranis' },
      { city: 'Campinas', nickname: 'Rockets' },
      { city: 'Florianopolis', nickname: 'Raios' },
      { city: 'Goiania', nickname: 'Cerrado' },
      { city: 'Manaus', nickname: 'Oncas' },
      { city: 'Natal', nickname: 'Dunas' },
      { city: 'Vitoria', nickname: 'Falcoes' },
      { city: 'Joinville', nickname: 'Nortes' }
    ]
  },
  {
    id: 'euroleague',
    name: 'EuroLeague',
    country: 'Europa',
    gamesPerTeam: 34,
    conferences: ['Unica'],
    playoffTeams: 8,
    draftLottery: false,
    teams: [
      { city: 'Madrid', nickname: 'Royals' },
      { city: 'Barcelona', nickname: 'Rays' },
      { city: 'Istanbul', nickname: 'Sultans' },
      { city: 'Athens', nickname: 'Legends' },
      { city: 'Belgrade', nickname: 'Wolves' },
      { city: 'Milan', nickname: 'Arrows' },
      { city: 'Paris', nickname: 'Lions' },
      { city: 'Berlin', nickname: 'Pilots' },
      { city: 'Munich', nickname: 'Knights' },
      { city: 'Tel Aviv', nickname: 'Stars' },
      { city: 'Kaunas', nickname: 'Eagles' },
      { city: 'Lisbon', nickname: 'Sailors' },
      { city: 'Prague', nickname: 'Crowns' },
      { city: 'Vienna', nickname: 'Riders' },
      { city: 'Warsaw', nickname: 'Foxes' },
      { city: 'Zagreb', nickname: 'Dragons' },
      { city: 'Budapest', nickname: 'Bulls' },
      { city: 'Stockholm', nickname: 'Northern' }
    ]
  },
  {
    id: 'acb',
    name: 'Liga ACB',
    country: 'Espanha',
    gamesPerTeam: 34,
    conferences: ['Unica'],
    playoffTeams: 8,
    draftLottery: false,
    teams: [
      { city: 'Madrid', nickname: 'Castillos' },
      { city: 'Barcelona', nickname: 'Toros' },
      { city: 'Valencia', nickname: 'Oranges' },
      { city: 'Sevilla', nickname: 'Mares' },
      { city: 'Bilbao', nickname: 'Basques' },
      { city: 'Malaga', nickname: 'Sol' },
      { city: 'Zaragoza', nickname: 'Winds' },
      { city: 'Murcia', nickname: 'Gardens' },
      { city: 'Granada', nickname: 'Lions' },
      { city: 'Alicante', nickname: 'Shores' },
      { city: 'Palma', nickname: 'Sails' },
      { city: 'Vigo', nickname: 'Celts' },
      { city: 'Valladolid', nickname: 'Knights' },
      { city: 'Cordoba', nickname: 'Horses' },
      { city: 'San Sebastian', nickname: 'Bays' },
      { city: 'Gijon', nickname: 'North' },
      { city: 'Tenerife', nickname: 'Volcanoes' },
      { city: 'Salamanca', nickname: 'Scholars' }
    ]
  },
  {
    id: 'lnb',
    name: 'LNB Pro A',
    country: 'Franca',
    gamesPerTeam: 34,
    conferences: ['Unica'],
    playoffTeams: 8,
    draftLottery: false,
    teams: [
      { city: 'Paris', nickname: 'Royals' },
      { city: 'Lyon', nickname: 'Lynx' },
      { city: 'Marseille', nickname: 'Harbor' },
      { city: 'Lille', nickname: 'Frost' },
      { city: 'Toulouse', nickname: 'Jets' },
      { city: 'Nice', nickname: 'Azur' },
      { city: 'Nantes', nickname: 'Ships' },
      { city: 'Strasbourg', nickname: 'Sentinels' },
      { city: 'Bordeaux', nickname: 'Vines' },
      { city: 'Montpellier', nickname: 'Waves' },
      { city: 'Rennes', nickname: 'Stags' },
      { city: 'Reims', nickname: 'Falcons' },
      { city: 'Le Havre', nickname: 'Seals' },
      { city: 'Dijon', nickname: 'Owls' },
      { city: 'Grenoble', nickname: 'Alps' },
      { city: 'Limoges', nickname: 'Copper' },
      { city: 'Orleans', nickname: 'Knights' },
      { city: 'Tours', nickname: 'Tours' }
    ]
  }
];

if (typeof window !== 'undefined') {
  window.LEAGUES = LEAGUES;
  window.TEAM_COLOR_PALETTE = TEAM_COLOR_PALETTE;
  window.__bmDataReady = true;
}

const FIRST_NAMES = [
  'Alex', 'Bruno', 'Caio', 'Davi', 'Elias', 'Felipe', 'Guilherme', 'Henrique',
  'Igor', 'Joao', 'Klaus', 'Lucas', 'Mateus', 'Nicolas', 'Otavio', 'Pedro',
  'Rafael', 'Samuel', 'Thiago', 'Vitor', 'William', 'Yuri', 'Zeca'
];

const LAST_NAMES = [
  'Almeida', 'Barros', 'Cardoso', 'Dias', 'Esteves', 'Ferraz', 'Gomes', 'Horta',
  'Ibrahim', 'Junqueira', 'Klein', 'Lima', 'Macedo', 'Nogueira', 'Oliveira',
  'Pires', 'Queiroz', 'Ramos', 'Santos', 'Teixeira', 'Uchoa', 'Vieira',
  'Xavier', 'Zanetti'
];

const NAME_POOLS = {
  Brasil: {
    first: ['Andre', 'Bruno', 'Caio', 'Diego', 'Eduardo', 'Felipe', 'Gabriel', 'Henrique', 'Igor', 'Joao', 'Lucas', 'Mateus', 'Pedro', 'Rafael', 'Thiago', 'Vinicius', 'Adriano', 'Carlos', 'Cesar', 'Douglas', 'Fernando', 'Gustavo', 'Heitor', 'Leandro', 'Leonardo', 'Marcos', 'Renato', 'Rodrigo', 'Victor', 'Wesley'],
    last: ['Almeida', 'Barbosa', 'Cardoso', 'Dias', 'Ferreira', 'Gomes', 'Lima', 'Macedo', 'Oliveira', 'Pereira', 'Ramos', 'Silva', 'Souza', 'Teixeira', 'Vieira', 'Araujo', 'Costa', 'Rocha', 'Moreira', 'Melo', 'Campos', 'Borges', 'Freitas', 'Carvalho', 'Pinto', 'Ribeiro', 'Tavares', 'Rezende', 'Correia', 'Barros']
  },
  Argentina: {
    first: ['Alejandro', 'Bruno', 'Carlos', 'Diego', 'Emilio', 'Federico', 'Gonzalo', 'Ignacio', 'Javier', 'Lucas', 'Matias', 'Nicolas', 'Pablo', 'Santiago', 'Tomas', 'Valentin', 'Agustin', 'Ezequiel', 'Facundo', 'Franco', 'Hernan', 'Ivan', 'Julian', 'Mariano', 'Sebastian', 'Leonel'],
    last: ['Alvarez', 'Benitez', 'Fernandez', 'Gomez', 'Lopez', 'Martinez', 'Pereyra', 'Ramirez', 'Rojas', 'Romero', 'Sanchez', 'Torres', 'Vega', 'Vargas', 'Diaz', 'Morales', 'Acosta', 'Aguirre', 'Castro', 'Dominguez', 'Herrera', 'Medina', 'Ortega', 'Ruiz', 'Suarez', 'Silva']
  },
  Espanha: {
    first: ['Adrian', 'Alvaro', 'Carlos', 'Daniel', 'Diego', 'Eduardo', 'Fernando', 'Hector', 'Ivan', 'Javier', 'Jorge', 'Lucas', 'Miguel', 'Pablo', 'Rafael', 'Sergio', 'Andres', 'Cristian', 'Enrique', 'Guillermo', 'Jesus', 'Manuel', 'Oscar', 'Raul', 'Ruben', 'Xavier'],
    last: ['Garcia', 'Gonzalez', 'Lopez', 'Martinez', 'Rodriguez', 'Perez', 'Sanchez', 'Ramirez', 'Torres', 'Vazquez', 'Romero', 'Navarro', 'Suarez', 'Dominguez', 'Iglesias', 'Herrera', 'Serrano', 'Molina', 'Castro', 'Ortega', 'Rubio', 'Cruz', 'Marin', 'Gil', 'Flores', 'Reyes']
  },
  Franca: {
    first: ['Adrien', 'Alexis', 'Antoine', 'Benoit', 'Cedric', 'Damien', 'Etienne', 'Florian', 'Hugo', 'Julien', 'Lucas', 'Matthieu', 'Nicolas', 'Olivier', 'Sebastien', 'Theo', 'Baptiste', 'Clement', 'Franck', 'Gregory', 'Jerome', 'Loic', 'Mathis', 'Maxime', 'Quentin', 'Romain'],
    last: ['Bernard', 'Dubois', 'Durand', 'Faure', 'Fontaine', 'Garnier', 'Lefevre', 'Leroy', 'Martin', 'Moreau', 'Petit', 'Roux', 'Simon', 'Thomas', 'Vidal', 'Lambert', 'Boyer', 'Chevalier', 'Dupont', 'Fournier', 'Guerin', 'Lacroix', 'Marchand', 'Picard', 'Renard', 'Vasseur']
  },
  Italia: {
    first: ['Alessandro', 'Andrea', 'Angelo', 'Antonio', 'Carlo', 'Davide', 'Enrico', 'Fabio', 'Giorgio', 'Lorenzo', 'Marco', 'Matteo', 'Paolo', 'Roberto', 'Simone', 'Stefano', 'Daniele', 'Filippo', 'Giovanni', 'Luca', 'Massimo', 'Michele', 'Riccardo', 'Salvatore', 'Vincenzo', 'Gabriele'],
    last: ['Bianchi', 'Conti', 'Costa', 'De Luca', 'Esposito', 'Ferrari', 'Gallo', 'Greco', 'Lombardi', 'Marino', 'Romano', 'Ricci', 'Rossi', 'Russo', 'Santoro', 'Vitale', 'Barone', 'Colombo', 'Dangelo', 'Giordano', 'Longo', 'Moretti', 'Neri', 'Palumbo', 'Pellegrini', 'Rinaldi']
  },
  Alemanha: {
    first: ['Adrian', 'Alexander', 'Andre', 'Daniel', 'David', 'Felix', 'Jan', 'Jonas', 'Julian', 'Lars', 'Leon', 'Lukas', 'Marcel', 'Max', 'Moritz', 'Tobias', 'Bastian', 'Florian', 'Johannes', 'Jens', 'Kai', 'Matthias', 'Niklas', 'Patrick', 'Sebastian', 'Tim'],
    last: ['Becker', 'Fischer', 'Hoffmann', 'Keller', 'Koch', 'Kruger', 'Lang', 'Lehmann', 'Meyer', 'Neumann', 'Richter', 'Schmidt', 'Schneider', 'Schulz', 'Wagner', 'Weber', 'Bauer', 'Feldmann', 'Graf', 'Hartmann', 'Klein', 'Konig', 'Lorenz', 'Muller', 'Roth', 'Wolf']
  },
  Canada: {
    first: ['Aaron', 'Austin', 'Blake', 'Brandon', 'Caleb', 'Cameron', 'Cole', 'Connor', 'Dylan', 'Ethan', 'Gavin', 'Jordan', 'Kyle', 'Logan', 'Mason', 'Tyler', 'Colin', 'Graham', 'Hayden', 'Jared', 'Owen', 'Preston', 'Quinn', 'Ryan', 'Shane', 'Trevor'],
    last: ['Anderson', 'Campbell', 'Carter', 'Clark', 'Collins', 'Cooper', 'Fraser', 'Gray', 'Harrison', 'Martin', 'Miller', 'Parker', 'Reed', 'Scott', 'Turner', 'Walker', 'Bennett', 'Dawson', 'Foster', 'Graham', 'Hamilton', 'Lawson', 'Mitchell', 'Nelson', 'Patterson', 'Sinclair']
  },
  'Estados Unidos': {
    first: ['Anthony', 'Brandon', 'Chris', 'Derrick', 'Evan', 'George', 'Jason', 'Jerome', 'Kevin', 'Marcus', 'Michael', 'Raymond', 'Shawn', 'Terrence', 'Tyrone', 'Zachary', 'Andre', 'Calvin', 'Darius', 'Devin', 'Gregory', 'Isaiah', 'Jamal', 'Jordan', 'Malik', 'Trevor'],
    last: ['Brown', 'Davis', 'Harris', 'Jackson', 'Johnson', 'Jones', 'Miller', 'Moore', 'Robinson', 'Smith', 'Taylor', 'Thomas', 'Walker', 'White', 'Williams', 'Young', 'Adams', 'Allen', 'Baker', 'Carter', 'Clark', 'Collins', 'Cooper', 'Edwards', 'Green', 'Hill']
  },
  Australia: {
    first: ['Aaron', 'Blake', 'Callum', 'Daniel', 'Elliot', 'Harrison', 'Jacob', 'Joshua', 'Lachlan', 'Liam', 'Mitchell', 'Nathan', 'Oscar', 'Riley', 'Sean', 'Tyson', 'Angus', 'Brodie', 'Cody', 'Finn', 'Hayden', 'Jasper', 'Kieran', 'Mason', 'Reece', 'Trent'],
    last: ['Baker', 'Dawson', 'Fletcher', 'Gibson', 'Hayes', 'Hunter', 'Murray', 'Owen', 'Parker', 'Reid', 'Roberts', 'Russell', 'Spencer', 'Thompson', 'Walsh', 'Wilson', 'Abbott', 'Coleman', 'Edwards', 'Foster', 'Hughes', 'Johnson', 'Kelly', 'McDonald', 'Reynolds', 'Stewart']
  },
  Servia: {
    first: ['Aleksandar', 'Bojan', 'Darko', 'Dragan', 'Filip', 'Ivan', 'Milan', 'Marko', 'Milos', 'Nemanja', 'Nikola', 'Ognjen', 'Petar', 'Stefan', 'Uros', 'Vladimir', 'Dusan', 'Goran', 'Jovan', 'Luka', 'Mihajlo', 'Nenad', 'Srdjan', 'Vladan', 'Zoran', 'Dejan'],
    last: ['Jovanovic', 'Markovic', 'Matic', 'Nikolic', 'Petrovic', 'Simic', 'Stojanovic', 'Stojkovic', 'Todorovic', 'Vasiljevic', 'Vukovic', 'Popovic', 'Kovacevic', 'Ilic', 'Pavlovic', 'Milosevic', 'Stankovic', 'Radovic', 'Djordjevic', 'Lazic', 'Bogdanovic', 'Veselinovic', 'Ristic', 'Mitrovic', 'Jankovic', 'Vujacic']
  },
  Lituania: {
    first: ['Adomas', 'Arnas', 'Domantas', 'Dovydas', 'Edgaras', 'Gytis', 'Ignas', 'Jonas', 'Linas', 'Marius', 'Martynas', 'Mindaugas', 'Paulius', 'Tadas', 'Vytautas', 'Zygimantas', 'Antanas', 'Aurimas', 'Darius', 'Gediminas', 'Karolis', 'Mantas', 'Rokas', 'Tomas', 'Vaidotas', 'Saulius'],
    last: ['Brazdeikis', 'Jankunas', 'Jasikevicius', 'Kalnietis', 'Kleiza', 'Kulboka', 'Macijauskas', 'Motiejunas', 'Sabonis', 'Valanciunas', 'Bieliauskas', 'Kavaliauskas', 'Butkevicius', 'Lekavicius', 'Gudaitis', 'Grigonis', 'Bendzius', 'Gecevicius', 'Juskevicius', 'Kuzminskas', 'Lukauskis', 'Macas', 'Masiulis', 'Radzevicius', 'Seibutis', 'Ulanovas']
  },
  Grecia: {
    first: ['Alexandros', 'Christos', 'Dimitris', 'Giorgos', 'Ioannis', 'Kostas', 'Lefteris', 'Manos', 'Michalis', 'Nikos', 'Panagiotis', 'Petros', 'Sotiris', 'Spiros', 'Thanos', 'Vasilis', 'Anastasios', 'Evangelos', 'Giannis', 'Lazaros', 'Marios', 'Pavlos', 'Stelios', 'Theodoros', 'Xenofon', 'Yannis'],
    last: ['Alexiou', 'Georgiou', 'Ioannou', 'Karamitros', 'Katsaros', 'Konstantinou', 'Kyriakou', 'Papadakis', 'Papadopoulos', 'Samaras', 'Stavridis', 'Theodorou', 'Vasiliou', 'Pappas', 'Manolis', 'Zisis', 'Athanasopoulos', 'Christodoulou', 'Doukas', 'Kostopoulos', 'Laskaris', 'Nikolaidis', 'Petridis', 'Sarantis', 'Tsolakis', 'Vlahos']
  },
  Turquia: {
    first: ['Ahmet', 'Ali', 'Can', 'Cem', 'Emre', 'Erdem', 'Hakan', 'Ibrahim', 'Kerem', 'Mehmet', 'Mert', 'Murat', 'Omer', 'Onur', 'Serkan', 'Yusuf', 'Baran', 'Burak', 'Deniz', 'Efe', 'Enes', 'Furkan', 'Kaan', 'Musa', 'Tolga', 'Volkan'],
    last: ['Aydin', 'Celik', 'Demir', 'Erdogan', 'Kaya', 'Kilic', 'Kurt', 'Ozdemir', 'Ozturk', 'Sahin', 'Tas', 'Yilmaz', 'Arslan', 'Guler', 'Koc', 'Polat', 'Aksoy', 'Aslan', 'Bozkurt', 'Eren', 'Gunduz', 'Kaplan', 'Karaman', 'Kaya', 'Ozcan', 'Uysal']
  },
  Nigeria: {
    first: ['Abiola', 'Chinedu', 'Chukwudi', 'Emeka', 'Ifeanyi', 'Kelechi', 'Kunle', 'Nnamdi', 'Obinna', 'Odion', 'Okechukwu', 'Onyeka', 'Seyi', 'Taiwo', 'Tunde', 'Uzoma', 'Chijioke', 'Chima', 'Ikenna', 'Kelechukwu', 'Obi', 'Odunsi', 'Olumide', 'Somto', 'Uchenna', 'Yemi'],
    last: ['Adebayo', 'Adesanya', 'Akinyemi', 'Balogun', 'Chukwu', 'Eze', 'Ibrahim', 'Ike', 'Okafor', 'Okeke', 'Okoro', 'Okoye', 'Onyema', 'Owolabi', 'Uche', 'Uzo', 'Amadi', 'Ekwueme', 'Ezeh', 'Ibeh', 'Iroha', 'Nwankwo', 'Nwosu', 'Okon', 'Onwu', 'Opara']
  },
  Japao: {
    first: ['Akira', 'Daiki', 'Haruto', 'Hiroshi', 'Issei', 'Kaito', 'Kenji', 'Kenta', 'Koji', 'Makoto', 'Naoki', 'Riku', 'Ryota', 'Satoshi', 'Shinji', 'Yuto', 'Haruki', 'Kazuki', 'Masato', 'Ren', 'Shota', 'Taichi', 'Takumi', 'Tatsuya', 'Yasu', 'Yuji'],
    last: ['Fujita', 'Hayashi', 'Higashi', 'Ishikawa', 'Ito', 'Kobayashi', 'Matsumoto', 'Miyamoto', 'Nakamura', 'Saito', 'Sasaki', 'Suzuki', 'Tanaka', 'Watanabe', 'Yamada', 'Yamamoto', 'Aoki', 'Endo', 'Hasegawa', 'Kato', 'Kondo', 'Morita', 'Ono', 'Shimada', 'Yoshida', 'Hashimoto']
  },
  China: {
    first: ['Bo', 'Chang', 'Chao', 'Feng', 'Guang', 'Hao', 'Jian', 'Jie', 'Lei', 'Liang', 'Ming', 'Peng', 'Qiang', 'Tao', 'Wei', 'Yong', 'Bin', 'Cheng', 'Dong', 'Heng', 'Jia', 'Kai', 'Long', 'Qiao', 'Shen', 'Zhi'],
    last: ['Chen', 'Deng', 'Guo', 'Huang', 'Li', 'Liu', 'Wang', 'Wu', 'Xia', 'Xie', 'Xu', 'Yang', 'Zhang', 'Zhao', 'Zhou', 'Zhu', 'Cai', 'Fan', 'Gao', 'He', 'Lin', 'Luo', 'Ma', 'Peng', 'Song', 'Tang']
  }
};
