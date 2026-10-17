// Chain quests on the islands above the waves (same format as CHAINS in chains.js).
// W.pi = Skull Island, W.pa = Paradise Island (their spots come from the island modules).
const I = (k) => (W) => W.pi.items[k], A = (k) => (W) => W.pa.items[k];

export const SURFACE_CHAINS = {
  // ---------- Skull Island ----------
  map: { giver: 'polly', area: 'pirate', reward: ['bandana', 'head'], color: 0xffd23f, steps: [
    { type: 'collect', item: 'mapPiece', where: I('mapPieces') },
    { type: 'visit', where: I('xMark') },
    { type: 'deliver', to: 'shelldon' },
  ] },
  coconuts: { giver: 'coco', area: 'pirate', reward: ['palmTop', 'top'], color: 0xc8925a, steps: [
    { type: 'collect', item: 'coconut', where: I('coconuts') },
  ] },
  fishing: { giver: 'gully', area: 'pirate', reward: ['lagoon', 'tail'], color: 0x9fd8ff, steps: [
    { type: 'collect', item: 'fish', where: I('fish') },
    { type: 'deliver', to: 'pelly' },
    { type: 'visit', where: I('skullTop') },
  ] },
  post: { giver: 'pelly', area: 'pirate', reward: ['sailor', 'top'], color: 0xfff0d0, steps: [
    { type: 'deliver', to: 'billy' },
    { type: 'deliver', to: 'batty' },
    { type: 'deliver', to: 'leo' },
  ] },
  goatFlowers: { giver: 'billy', area: 'pirate', reward: ['sunHat', 'head'], color: 0xff9fd0, steps: [
    { type: 'collect', item: 'hibiscus', where: I('flowers') },
    { type: 'visit', where: I('skullTop') },
    { type: 'deliver', to: 'polly' },
  ] },
  crystalCave: { giver: 'batty', area: 'pirate', reward: ['treasure', 'tail'], color: 0xb08cff, steps: [
    { type: 'collect', item: 'crystal', where: I('crystals') },
    { type: 'visit', where: I('grottoPool') },
    { type: 'deliver', to: 'boo' },
  ] },
  lanterns: { giver: 'boo', area: 'pirate', reward: ['pirateStripe', 'top'], color: 0xffc070, steps: [
    { type: 'collect', item: 'lantern', where: I('lanterns') },
  ] },
  friendsWalk: { giver: 'shelldon', area: 'pirate', reward: ['pigtails', 'hair'], color: 0x8fd08a, steps: [
    { type: 'deliver', to: 'snappy' },
    { type: 'deliver', to: 'piggy' },
    { type: 'deliver', to: 'zip' },
  ] },
  berries: { giver: 'zip', area: 'pirate', reward: ['mango', 'hairColor'], color: 0xff5a8a, steps: [
    { type: 'collect', item: 'berry', where: I('berries') },
  ] },
  truffles: { giver: 'piggy', area: 'pirate', reward: ['lei', 'head'], color: 0xd8a070, steps: [
    { type: 'collect', item: 'truffle', where: I('truffles') },
    { type: 'deliver', to: 'coco' },
  ] },
  beachBall: { giver: 'leo', area: 'pirate', reward: ['sunshine', 'tail'], color: 0xff7a5a, steps: [
    { type: 'collect', item: 'ball', where: I('balls') },
    { type: 'visit', where: I('sandbar') },
    { type: 'deliver', to: 'kitty' },
  ] },
  buttons: { giver: 'kitty', area: 'pirate', reward: ['coconut', 'hairColor'], color: 0xffb0c8, steps: [
    { type: 'collect', item: 'button', where: I('buttons') },
  ] },
  // ---------- Paradise Island ----------
  seeds: { giver: 'mayor', area: 'paradise', reward: ['leafCrown', 'head'], color: 0x8fe06a, steps: [
    { type: 'collect', item: 'seed', where: A('seeds') },
    { type: 'visit', where: A('skyGarden') },
    { type: 'deliver', to: 'bun' },
  ] },
  pies: { giver: 'bun', area: 'paradise', reward: ['hibiscus', 'top'], color: 0xff6a9a, steps: [
    { type: 'collect', item: 'berry', where: A('berries') },
  ] },
  bridge: { giver: 'bolt', area: 'paradise', reward: ['flowerBun', 'hair'], color: 0xd8a060, steps: [
    { type: 'collect', item: 'plank', where: A('planks') },
    { type: 'visit', where: A('newBridge') },
    { type: 'deliver', to: 'mayor' },
  ] },
  feathers: { giver: 'rio', area: 'paradise', reward: ['featherBand', 'head'], color: 0xff4a4a, steps: [
    { type: 'collect', item: 'feather', where: A('feathers') },
  ] },
  mangoes: { giver: 'tuki', area: 'paradise', reward: ['tropic', 'tail'], color: 0xffb030, steps: [
    { type: 'collect', item: 'mango', where: A('mangoes') },
    { type: 'deliver', to: 'slo' },
    { type: 'deliver', to: 'banjo' },
  ] },
  pinkLagoon: { giver: 'flora', area: 'paradise', reward: ['flamingo', 'tail'], color: 0xff8fc0, steps: [
    { type: 'visit', where: A('pinkLagoon') },
    { type: 'collect', item: 'shell', where: A('shells') },
    { type: 'deliver', to: 'hum' },
  ] },
  nectar: { giver: 'hum', area: 'paradise', reward: ['jungle', 'hairColor'], color: 0x6fe8a0, steps: [
    { type: 'collect', item: 'hibiscus', where: A('flowers') },
  ] },
  jewels: { giver: 'pavo', area: 'paradise', reward: ['peacockTop', 'top'], color: 0x3fb8d8, steps: [
    { type: 'collect', item: 'gem', where: A('jewels') },
    { type: 'visit', where: A('rainbowFalls') },
    { type: 'deliver', to: 'rio' },
  ] },
  bananas: { giver: 'banjo', area: 'paradise', reward: ['sunnies', 'head'], color: 0xfff04a, steps: [
    { type: 'collect', item: 'banana', where: A('bananas') },
  ] },
  sloNap: { giver: 'slo', area: 'paradise', reward: ['leafTop', 'top'], color: 0xb8a080, steps: [
    { type: 'deliver', to: 'kami' },
    { type: 'deliver', to: 'zaza' },
    { type: 'visit', where: A('pond') },
  ] },
  lily: { giver: 'ribbit', area: 'paradise', reward: ['sky', 'hairColor'], color: 0x7fe07f, steps: [
    { type: 'collect', item: 'lilyPad', where: A('lilyPads') },
    { type: 'visit', where: A('pond') },
    { type: 'deliver', to: 'flora' },
  ] },
  hide: { giver: 'kami', area: 'paradise', reward: ['parrotPal', 'head'], color: 0xc08cff, steps: [
    { type: 'collect', item: 'glimmer', where: A('glimmers') },
  ] },
};
