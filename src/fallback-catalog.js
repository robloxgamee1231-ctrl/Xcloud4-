/* SPDX-License-Identifier: GPL-3.0-only */
/* Rich fallback catalog & bespoke SVG artwork generator for offline / sandboxed previews. */

export const FALLBACK_TITLES = [
  {
    productId: 'BT5P2X999VH2',
    titleId: 'Fortnite',
    title: 'Fortnite',
    publisher: 'Epic Games',
    developer: 'Epic Games',
    category: 'Shooter',
    year: '2017',
    releaseDate: '2017-07-21',
    ageRating: 'T',
    freeToPlay: true,
    attributes: ['Online multiplayer (2-100)', 'Cross-platform multiplayer', '60 fps+', 'Cloud saves'],
    shortDescription: 'Create, play, and battle with friends for free in Fortnite across Battle Royale, Zero Build, LEGO Fortnite, and Festival.',
    description: 'Create, play, and battle with friends for free in Fortnite. Be the last player standing in Battle Royale and Zero Build, explore and survive in LEGO Fortnite, blast to the finish with Rocket Racing, or headline a concert with Fortnite Festival. No Game Pass subscription required on Xbox Cloud Gaming.',
    palette: ['#0E2448', '#2A6BFF', '#32F38B'],
    glyph: 'FN',
    shelves: ['free', 'popular'],
  },
  {
    productId: '9PP5G1F0C2B6',
    titleId: 'HaloInfinite',
    title: 'Halo Infinite',
    publisher: 'Xbox Game Studios',
    developer: '343 Industries',
    category: 'Shooter',
    year: '2021',
    releaseDate: '2021-12-08',
    ageRating: 'T',
    freeToPlay: false,
    attributes: ['Online multiplayer (2-24)', '60 fps+', 'Cloud saves', 'HDR10'],
    shortDescription: 'When all hope is lost and humanity’s fate hangs in the balance, the Master Chief is ready to confront the most ruthless foe he’s ever faced.',
    description: 'The legendary Halo series returns with the most expansive Master Chief campaign yet and a groundbreaking free-to-play multiplayer experience across Zeta Halo.',
    palette: ['#0C1D24', '#1D6B4A', '#32F38B'],
    glyph: 'HI',
    shelves: ['popular'],
  },
  {
    productId: '9NNX1VVR3KNQ',
    titleId: 'ForzaHorizon5',
    title: 'Forza Horizon 5',
    publisher: 'Xbox Game Studios',
    developer: 'Playground Games',
    category: 'Racing & flying',
    year: '2021',
    releaseDate: '2021-11-09',
    ageRating: 'E',
    freeToPlay: false,
    attributes: ['Online multiplayer (2-12)', 'Co-op', '60 fps+', 'HDR10'],
    shortDescription: 'Your Ultimate Horizon Adventure awaits! Explore the vibrant open world landscapes of Mexico with limitless driving action.',
    description: 'Lead breathtaking expeditions across the vibrant and ever-evolving open world landscapes of Mexico with limitless, fun driving action in hundreds of the world’s greatest cars.',
    palette: ['#2D102C', '#D9436A', '#FFAC3E'],
    glyph: 'FH5',
    shelves: ['popular'],
  },
  {
    productId: '9NCJSXWZTP88',
    titleId: 'Starfield',
    title: 'Starfield',
    publisher: 'Bethesda Softworks',
    developer: 'Bethesda Game Studios',
    category: 'Role playing',
    year: '2023',
    releaseDate: '2023-09-06',
    ageRating: 'M',
    freeToPlay: false,
    attributes: ['Single player', 'Cloud saves', 'HDR10'],
    shortDescription: 'In this next generation role-playing game set amongst the stars, create any character you want and explore with unparalleled freedom.',
    description: 'Starfield is the first new universe in over 25 years from Bethesda Game Studios. Embark on an epic journey to answer humanity’s greatest mystery across more than 1,000 planets.',
    palette: ['#091326', '#214A82', '#F5A623'],
    glyph: 'SF',
    shelves: ['popular'],
  },
  {
    productId: '9N5B1L6Q9P01',
    titleId: 'IndianaJonesGC',
    title: 'Indiana Jones and the Great Circle',
    publisher: 'Bethesda Softworks',
    developer: 'MachineGames',
    category: 'Action & adventure',
    year: '2024',
    releaseDate: '2024-12-09',
    ageRating: 'T',
    freeToPlay: false,
    attributes: ['Single player', '60 fps+', 'Cloud saves'],
    shortDescription: 'Uncover one of history’s greatest mysteries in a first-person, single-player adventure set between Raiders of the Lost Ark and The Last Crusade.',
    description: 'Set in 1937, sinister forces are scouring the globe for the secret to an ancient power connected to the Great Circle, and only one person can stop them — Indiana Jones.',
    palette: ['#28180C', '#A66324', '#F5C451'],
    glyph: 'IJ',
    shelves: ['new', 'popular'],
  },
  {
    productId: '9N4X8J7W2K3M',
    titleId: 'HellbladeII',
    title: "Senua's Saga: Hellblade II",
    publisher: 'Xbox Game Studios',
    developer: 'Ninja Theory',
    category: 'Action & adventure',
    year: '2024',
    releaseDate: '2024-05-21',
    ageRating: 'M',
    freeToPlay: false,
    attributes: ['Single player', 'Cloud saves', 'Spatial audio'],
    shortDescription: 'Senua returns in a brutal journey of survival through the myth and torment of Viking Iceland.',
    description: 'Intent on saving those who have fallen victim to the horrors of tyranny, Senua faces a battle of overcoming the darkness within and without in Viking-age Iceland.',
    palette: ['#131820', '#4A637D', '#C5D8E8'],
    glyph: 'HB2',
    shelves: ['new'],
  },
  {
    productId: '9P2G3M8N5R1Q',
    titleId: 'STALKER2',
    title: 'S.T.A.L.K.E.R. 2: Heart of Chornobyl',
    publisher: 'GSC Game World',
    developer: 'GSC Game World',
    category: 'Shooter',
    year: '2024',
    releaseDate: '2024-11-20',
    ageRating: 'M',
    freeToPlay: false,
    attributes: ['Single player', 'Cloud saves'],
    shortDescription: 'Discover the vast Chornobyl Exclusion Zone full of dangerous enemies, deadly anomalies, and powerful artifacts.',
    description: 'Unveil your own epic story as you make your way to the Heart of Chornobyl. Make your choices wisely, as they will determine your fate in the end.',
    palette: ['#181F12', '#4D6E33', '#D6B747'],
    glyph: 'S2',
    shelves: ['new', 'popular'],
  },
  {
    productId: '9P6T1X4L8Z9W',
    titleId: 'Palworld',
    title: 'Palworld',
    publisher: 'Pocketpair',
    developer: 'Pocketpair',
    category: 'Action & adventure',
    year: '2024',
    releaseDate: '2024-01-19',
    ageRating: 'T',
    freeToPlay: false,
    attributes: ['Online multiplayer (2-32)', 'Co-op', 'Cloud saves'],
    shortDescription: 'Fight, farm, build, and work alongside mysterious creatures called Pals in this completely new multiplayer, open-world survival crafting game.',
    description: 'Explore a vast world inhabited by over 100 unique Pals. Capture, train, build bases, and take on towering Syndicate bosses alone or with friends.',
    palette: ['#0B2738', '#1E8FA8', '#52F29D'],
    glyph: 'PW',
    shelves: ['popular'],
  },
  {
    productId: '9P5M3C7F8D2V',
    titleId: 'SeaOfThieves',
    title: 'Sea of Thieves',
    publisher: 'Xbox Game Studios',
    developer: 'Rare',
    category: 'Action & adventure',
    year: '2018',
    releaseDate: '2018-03-20',
    ageRating: 'T',
    freeToPlay: false,
    attributes: ['Online multiplayer (2-24)', 'Co-op', 'Cross-platform multiplayer', '60 fps+'],
    shortDescription: 'Sea of Thieves offers the essential pirate experience, from sailing and fighting to exploring and looting.',
    description: 'Set sail across shared oceans, hunt cursed treasure, battle skeletal fleets, and forge your legend on the high seas solo or in a crew.',
    palette: ['#07262A', '#0E6B73', '#32F38B'],
    glyph: 'SOT',
    shelves: ['popular'],
  },
  {
    productId: '9PM7H8K9J4X2',
    titleId: 'FlightSim2024',
    title: 'Microsoft Flight Simulator 2024',
    publisher: 'Xbox Game Studios',
    developer: 'Asobo Studio',
    category: 'Simulation',
    year: '2024',
    releaseDate: '2024-11-19',
    ageRating: 'E',
    freeToPlay: false,
    attributes: ['Online multiplayer', 'Cloud saves', 'HDR10'],
    shortDescription: 'Explore the world with our largest fleet of aircraft and take simulation to new heights while pursuing your aviation career.',
    description: 'Take off anywhere on Earth in photorealistic detail with dynamic weather, live air traffic, and career missions spanning aerial firefighting, search and rescue, and commercial transport.',
    palette: ['#091D34', '#2A72B5', '#91D6FF'],
    glyph: 'FS24',
    shelves: ['new'],
  },
  {
    productId: '9N8Z3Q1W6Y4C',
    titleId: 'Persona3Reload',
    title: 'Persona 3 Reload',
    publisher: 'SEGA',
    developer: 'ATLUS',
    category: 'Role playing',
    year: '2024',
    releaseDate: '2024-02-02',
    ageRating: 'M',
    freeToPlay: false,
    attributes: ['Single player', '60 fps+', 'Cloud saves'],
    shortDescription: 'Step into the shoes of a transfer student thrust into an unexpected fate when entering the hour "hidden" between one day and the next.',
    description: 'A captivating reimagining of the genre-defining RPG, rebuilt for the modern era with razor-sharp UI, revamped audio, and expanded social links.',
    palette: ['#071836', '#1652D1', '#4DF0FF'],
    glyph: 'P3R',
    shelves: ['new'],
  },
  {
    productId: '9N1R5K4P8L7M',
    titleId: 'HiFiRUSH',
    title: 'Hi-Fi RUSH',
    publisher: 'Bethesda Softworks',
    developer: 'Tango Gameworks',
    category: 'Music',
    year: '2023',
    releaseDate: '2023-01-25',
    ageRating: 'T',
    freeToPlay: false,
    attributes: ['Single player', '60 fps+', 'Cloud saves'],
    shortDescription: 'Feel the beat as wannabe rockstar Chai and his ragtag team of allies fight against an evil robotics enhancement megacorp with raucous rhythm combat!',
    description: 'Every attack, dodge, parry, and environmental hazard syncs automatically to an infectious soundtrack in this vibrant cel-shaded rhythm action hit.',
    palette: ['#280E1E', '#DF3B57', '#38F2AF'],
    glyph: 'HFR',
    shelves: ['popular'],
  },
  {
    productId: '9P9B2V6C3N8T',
    titleId: 'Gears5',
    title: 'Gears 5',
    publisher: 'Xbox Game Studios',
    developer: 'The Coalition',
    category: 'Shooter',
    year: '2019',
    releaseDate: '2019-09-10',
    ageRating: 'M',
    freeToPlay: false,
    attributes: ['Online multiplayer (2-10)', 'Co-op', 'Split-screen', '60 fps+'],
    shortDescription: 'With all-out war descending, Kait Diaz breaks away to uncover her connection to the enemy and discovers the true danger to Sera.',
    description: 'From one of gaming’s most acclaimed sagas, Gears is bigger than ever with five thrilling modes and the deepest campaign yet.',
    palette: ['#241114', '#9A252C', '#F28F3B'],
    glyph: 'G5',
    shelves: ['popular'],
  },
  {
    productId: '9N7C2M4P5V9B',
    titleId: 'OriWillOfWisps',
    title: 'Ori and the Will of the Wisps',
    publisher: 'Xbox Game Studios',
    developer: 'Moon Studios',
    category: 'Platformer',
    year: '2020',
    releaseDate: '2020-03-11',
    ageRating: 'E',
    freeToPlay: false,
    attributes: ['Single player', '60 fps+', 'HDR10', 'Cloud saves'],
    shortDescription: 'Embark on a new journey in a vast, exotic world where you’ll encounter towering enemies and challenging puzzles on your quest to unravel Ori’s destiny.',
    description: 'Play the critically acclaimed masterpiece. Journey across hand-painted forests, glowing caverns, and windswept ruins in fluid 60fps platforming action.',
    palette: ['#0B1B2E', '#1F6C99', '#6BF5D8'],
    glyph: 'ORI',
    shelves: ['popular'],
  },
  {
    productId: '9N3K6D8L2F5H',
    titleId: 'MinecraftLegends',
    title: 'Minecraft Legends',
    publisher: 'Xbox Game Studios',
    developer: 'Mojang Studios',
    category: 'Strategy',
    year: '2023',
    releaseDate: '2023-04-18',
    ageRating: 'E10+',
    freeToPlay: false,
    attributes: ['Online multiplayer (2-8)', 'Co-op', 'Cross-platform multiplayer'],
    shortDescription: 'Discover the mysteries of Minecraft Legends, a new action strategy game. Lead your allies in heroic battles to defend the Overworld.',
    description: 'Raise your banner high and unite the Overworld mobs against the destructive piglin invasion in tactical real-time action strategy.',
    palette: ['#132A16', '#2A8C4A', '#6CF78B'],
    glyph: 'MCL',
    shelves: ['leaving'],
  },
  {
    productId: '9PH4X9W1C2B7',
    titleId: 'DeadCells',
    title: 'Dead Cells',
    publisher: 'Motion Twin',
    developer: 'Motion Twin',
    category: 'Platformer',
    year: '2018',
    releaseDate: '2018-08-07',
    ageRating: 'T',
    freeToPlay: false,
    attributes: ['Single player', '60 fps+', 'Cloud saves'],
    shortDescription: 'Dead Cells is a rogue-lite, metroidvania inspired, action-platformer. You’ll explore a sprawling, ever-changing castle.',
    description: 'No checkpoints. Kill, die, learn, repeat. Master crisp 2D combat across dozens of weapons, mutations, and branching biomes.',
    palette: ['#1E0F24', '#8A2B6B', '#FF6675'],
    glyph: 'DC',
    shelves: ['leaving'],
  },
  {
    productId: '9P8M2Q5K9L1X',
    titleId: 'Grounded',
    title: 'Grounded',
    publisher: 'Xbox Game Studios',
    developer: 'Obsidian Entertainment',
    category: 'Action & adventure',
    year: '2022',
    releaseDate: '2022-09-27',
    ageRating: 'T',
    freeToPlay: false,
    attributes: ['Online multiplayer (2-4)', 'Co-op', 'Cross-platform multiplayer', '60 fps+'],
    shortDescription: 'The world is a vast, beautiful, and dangerous place – especially when you have been shrunk to the size of an ant.',
    description: 'Explore, build, and survive together in this cooperative backyard survival-adventure packed with insect ecosystems and secret labs.',
    palette: ['#0F291A', '#2B8A56', '#9BF252'],
    glyph: 'GRD',
    shelves: ['popular'],
  },
  {
    productId: '9N9R4B7V2K6D',
    titleId: 'AgeOfEmpiresIV',
    title: 'Age of Empires IV: Anniversary Edition',
    publisher: 'Xbox Game Studios',
    developer: "Relic Entertainment / World's Edge",
    category: 'Strategy',
    year: '2023',
    releaseDate: '2023-08-22',
    ageRating: 'T',
    freeToPlay: false,
    attributes: ['Online multiplayer (2-8)', 'Cloud saves'],
    shortDescription: 'One of the most beloved real-time strategy games returns to glory with Age of Empires IV, putting you at the center of epic historical battles.',
    description: 'Command diverse historical civilizations with intuitive controller tactics, gripping documentaries, and massive siege warfare.',
    palette: ['#221B11', '#8F6A31', '#F5CE6C'],
    glyph: 'AOE4',
    shelves: ['leaving'],
  },
  {
    productId: '9N5T3P8W6C1Z',
    titleId: 'DoomEternal',
    title: 'DOOM Eternal',
    publisher: 'Bethesda Softworks',
    developer: 'id Software',
    category: 'Shooter',
    year: '2020',
    releaseDate: '2020-03-20',
    ageRating: 'M',
    freeToPlay: false,
    attributes: ['Online multiplayer (2-3)', '60 fps+', 'HDR10'],
    shortDescription: 'Hell’s armies have invaded Earth. Become the Slayer in an epic single-player campaign to conquer demons across dimensions.',
    description: 'Experience the ultimate combination of speed and power with push-forward combat and relentless heavy-metal momentum.',
    palette: ['#260D0D', '#A3231D', '#FF683B'],
    glyph: 'DOOM',
    shelves: ['leaving'],
  },
  {
    productId: '9N2V7L4N9M3K',
    titleId: 'Psychonauts2',
    title: 'Psychonauts 2',
    publisher: 'Xbox Game Studios',
    developer: 'Double Fine Productions',
    category: 'Platformer',
    year: '2021',
    releaseDate: '2021-08-25',
    ageRating: 'T',
    freeToPlay: false,
    attributes: ['Single player', '60 fps+', 'HDR10'],
    shortDescription: 'Combining quirky missions and mysterious conspiracies, Psychonauts 2 is a platform-adventure game with cinematic style and customizable psychic powers.',
    description: 'Razputin Aquato dives into eccentric minds full of humor, heart, and inventive platforming challenges.',
    palette: ['#191433', '#6142B8', '#3EEB9F'],
    glyph: 'PSY2',
    shelves: ['new'],
  },
  {
    productId: '9P1H6B3T8M4N',
    titleId: 'HaloMCC',
    title: 'Halo: The Master Chief Collection',
    publisher: 'Xbox Game Studios',
    developer: '343 Industries',
    category: 'Shooter',
    year: '2019',
    releaseDate: '2019-12-03',
    ageRating: 'M',
    freeToPlay: false,
    attributes: ['Online multiplayer (2-16)', 'Co-op', 'Split-screen', '60 fps+'],
    shortDescription: 'For the first time, the Master Chief’s iconic saga comes together with six classic Halo titles optimized for modern play.',
    description: 'Experience Halo: Reach, Halo: Combat Evolved Anniversary, Halo 2: Anniversary, Halo 3, Halo 3: ODST, and Halo 4.',
    palette: ['#0B1B29', '#1D527A', '#32F38B'],
    glyph: 'MCC',
    shelves: [],
  },
  {
    productId: '9N4F8K1W2C7P',
    titleId: 'FallGuysFree',
    title: 'Fall Guys',
    publisher: 'Epic Games',
    developer: 'Mediatonic',
    category: 'Family & kids',
    year: '2022',
    releaseDate: '2022-06-21',
    ageRating: 'E',
    freeToPlay: true,
    attributes: ['Online multiplayer (2-60)', 'Cross-platform multiplayer', '60 fps+'],
    shortDescription: 'Stumble through chaotic obstacle courses and claim the Crown for free with cross-play squads!',
    description: 'Compete in hilarious round-by-round free-for-all madness with seasonal shows and creator levels.',
    palette: ['#231138', '#A63EC5', '#34F2C6'],
    glyph: 'FG',
    shelves: ['free'],
  },
  {
    productId: '9N9Z5Q7B3H8L',
    titleId: 'RocketLeagueFree',
    title: 'Rocket League',
    publisher: 'Psyonix',
    developer: 'Psyonix',
    category: 'Sports',
    year: '2020',
    releaseDate: '2020-09-23',
    ageRating: 'E',
    freeToPlay: true,
    attributes: ['Online multiplayer (2-8)', 'Cross-platform multiplayer', '60 fps+'],
    shortDescription: 'High-powered hybrid of arcade-style soccer and vehicular mayhem with easy-to-understand controls and fluid competition.',
    description: 'Take to the pitch in supersonic rocket-powered battle-cars across competitive playlists and seasonal tournaments.',
    palette: ['#0C1C38', '#1F6FEB', '#FF8E3C'],
    glyph: 'RL',
    shelves: ['free'],
  },
  {
    productId: '9P3C7V5M1K9D',
    titleId: 'Hades',
    title: 'Hades',
    publisher: 'Supergiant Games',
    developer: 'Supergiant Games',
    category: 'Role playing',
    year: '2021',
    releaseDate: '2021-08-13',
    ageRating: 'T',
    freeToPlay: false,
    attributes: ['Single player', '60 fps+', 'Cloud saves'],
    shortDescription: 'Defy the god of the dead as you hack and slash out of the Underworld in this award-winning rogue-like dungeon crawler.',
    description: 'Wield the powers and mythic weapons of Olympus to break free from the clutches of the Underworld while growing stronger every escape attempt.',
    palette: ['#2B0E14', '#B52E31', '#F5A623'],
    glyph: 'HDS',
    shelves: ['new', 'popular'],
  },
];

export const FALLBACK_REGIONS = [
  { name: 'EastUS', baseUri: 'https://eus.core.gssv-play-prod.xboxlive.com', networkTestHostname: 'eus.gssv-fastlane-prod.xboxlive.com', isDefault: true, continent: 'america', simLatencyMs: 18 },
  { name: 'EastUS2', baseUri: 'https://eus2.core.gssv-play-prod.xboxlive.com', networkTestHostname: 'eus2.gssv-fastlane-prod.xboxlive.com', isDefault: false, continent: 'america', simLatencyMs: 24 },
  { name: 'WestUS2', baseUri: 'https://wus2.core.gssv-play-prod.xboxlive.com', networkTestHostname: 'wus2.gssv-fastlane-prod.xboxlive.com', isDefault: false, continent: 'america', simLatencyMs: 68 },
  { name: 'BrazilSouth', baseUri: 'https://brs.core.gssv-play-prod.xboxlive.com', networkTestHostname: 'brs.gssv-fastlane-prod.xboxlive.com', isDefault: false, continent: 'america', simLatencyMs: 112 },
  { name: 'WestEurope', baseUri: 'https://weu.core.gssv-play-prod.xboxlive.com', networkTestHostname: 'weu.gssv-fastlane-prod.xboxlive.com', isDefault: false, continent: 'europe', simLatencyMs: 84 },
  { name: 'UKSouth', baseUri: 'https://uks.core.gssv-play-prod.xboxlive.com', networkTestHostname: 'uks.gssv-fastlane-prod.xboxlive.com', isDefault: false, continent: 'europe', simLatencyMs: 79 },
  { name: 'SpainCentral', baseUri: 'https://mad.core.gssv-play-prod.xboxlive.com', networkTestHostname: 'mad.gssv-fastlane-prod.xboxlive.com', isDefault: false, continent: 'europe', simLatencyMs: 92 },
  { name: 'JapanEast', baseUri: 'https://jpe.core.gssv-play-prod.xboxlive.com', networkTestHostname: 'jpe.gssv-fastlane-prod.xboxlive.com', isDefault: false, continent: 'asia', simLatencyMs: 164 },
  { name: 'KoreaCentral', baseUri: 'https://krc.core.gssv-play-prod.xboxlive.com', networkTestHostname: 'krc.gssv-fastlane-prod.xboxlive.com', isDefault: false, continent: 'asia', simLatencyMs: 171 },
  { name: 'AustraliaEast', baseUri: 'https://aue.core.gssv-play-prod.xboxlive.com', networkTestHostname: 'aue.gssv-fastlane-prod.xboxlive.com', isDefault: false, continent: 'asia', simLatencyMs: 196 },
];

export function buildFallbackCatalogMap() {
  const byId = {};
  for (const t of FALLBACK_TITLES) {
    byId[t.productId] = {
      ...t,
      coverUrl: `/api/artwork/${t.productId}/cover.svg`,
      heroUrl: `/api/artwork/${t.productId}/hero.svg`,
      posterUrl: `/api/artwork/${t.productId}/poster.svg`,
      screenshots: [
        { thumb: `/api/artwork/${t.productId}/shot1.svg`, full: `/api/artwork/${t.productId}/shot1.svg` },
        { thumb: `/api/artwork/${t.productId}/shot2.svg`, full: `/api/artwork/${t.productId}/shot2.svg` },
        { thumb: `/api/artwork/${t.productId}/shot3.svg`, full: `/api/artwork/${t.productId}/shot3.svg` },
      ],
    };
  }
  return byId;
}

export function buildFallbackPublicLists() {
  const metadata = buildFallbackCatalogMap();
  const lists = { free: [], new: [], popular: [], leaving: [] };
  for (const t of FALLBACK_TITLES) {
    for (const shelf of t.shelves) {
      if (lists[shelf]) lists[shelf].push(t.productId);
    }
  }
  return { lists, metadata, source: 'sandbox-fallback' };
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderFallbackArtworkSvg(productId, kind = 'cover.svg') {
  const item = FALLBACK_TITLES.find((t) => t.productId === productId) || FALLBACK_TITLES[0];
  const [c0, c1, c2] = item.palette;
  const cleanKind = kind.replace(/\.svg$/, '');
  const isPoster = cleanKind === 'poster';
  const isHero = cleanKind === 'hero' || cleanKind.startsWith('shot');
  const w = isPoster ? 550 : isHero ? 1280 : 640;
  const h = isPoster ? 825 : isHero ? 720 : 360;
  const shotIndex = cleanKind.startsWith('shot') ? Number(cleanKind.slice(4)) || 1 : 0;

  const badge = item.freeToPlay ? 'FREE TO PLAY' : item.category.toUpperCase();
  const subtitle = shotIndex ? `IN-GAME CAPTURE 0${shotIndex}` : `${item.developer} · ${item.year}`;
  const cx = Math.round(w * (0.68 - shotIndex * 0.08));
  const cy = Math.round(h * (0.44 + shotIndex * 0.06));
  const rad = Math.round(Math.min(w, h) * 0.44);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c0}"/>
      <stop offset="55%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="#070E18"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${c2}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${c2}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#070E18" stop-opacity="0.05"/>
      <stop offset="65%" stop-color="#070E18" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#070E18" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${rad}" fill="url(#glow)"/>
  <g opacity="0.16" stroke="${c2}" stroke-width="1.5" fill="none">
    <circle cx="${cx}" cy="${cy}" r="${Math.round(rad * 0.65)}"/>
    <circle cx="${cx}" cy="${cy}" r="${Math.round(rad * 0.92)}" stroke-dasharray="10 8"/>
    <path d="M0 ${Math.round(h * 0.72)} L${w} ${Math.round(h * 0.34)}"/>
    <path d="M0 ${Math.round(h * 0.85)} L${w} ${Math.round(h * 0.56)}"/>
  </g>
  <text x="${Math.round(w * 0.74)}" y="${Math.round(h * 0.54)}" text-anchor="middle"
    font-family="Inter, Noto Sans, system-ui, sans-serif" font-weight="800"
    font-size="${Math.round(Math.min(w, h) * 0.34)}" fill="#FFFFFF" opacity="0.10" letter-spacing="-4">${escapeXml(item.glyph)}</text>
  <rect width="${w}" height="${h}" fill="url(#vignette)"/>
  <g transform="translate(${Math.round(w * 0.055)}, ${Math.round(h * 0.74)})">
    <rect x="0" y="-26" width="${Math.max(110, badge.length * 9.5 + 24)}" height="24" rx="12" fill="${c2}" fill-opacity="0.22" stroke="${c2}" stroke-opacity="0.65"/>
    <text x="12" y="-10" font-family="Inter, Noto Sans, system-ui, sans-serif" font-size="11" font-weight="700" fill="${c2}" letter-spacing="0.8">${escapeXml(badge)}</text>
    <text x="0" y="24" font-family="Inter, Noto Sans, system-ui, sans-serif" font-size="${isHero ? 38 : isPoster ? 28 : 26}" font-weight="700" fill="#F6F9FD">${escapeXml(item.title)}</text>
    <text x="0" y="${isHero ? 54 : 48}" font-family="Inter, Noto Sans, system-ui, sans-serif" font-size="${isHero ? 16 : 13}" font-weight="500" fill="#B1C1D2">${escapeXml(subtitle)}</text>
  </g>
</svg>`;
}
