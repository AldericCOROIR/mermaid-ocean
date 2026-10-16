// Short, friendly lines for a young reader. English & French.
const STR = {
  en: {
    tagline: 'Dive into a magical sea!', start: 'Dive!', rotate: 'Turn your phone sideways 📱↔️',
    album: 'My Sea Friends', settings: 'Settings',
    paintOn: 'Painted look: ON', paintOff: 'Painted look: OFF',
    soundOn: 'Sound: ON', soundOff: 'Sound: OFF', lang: 'Language: English',
    qHigh: 'Quality: Beautiful', qMed: 'Quality: Smooth', qLow: 'Quality: Fast', reset: 'Start again',
    newFriend: 'New friend!', pearl: 'A magic pearl!', crystal: 'The crystal shines!',
    names: { clownfish: 'Clownfish', tang: 'Blue Tang', yellowfish: 'Sunny Fish', angelfish: 'Angelfish', whale: 'Whale', dolphin: 'Dolphin', seahorse: 'Seahorse', crab: 'Crab', jellyfish: 'Jellyfish', turtle: 'Sea Turtle', manta: 'Manta Ray', puffer: 'Pufferfish', octopus: 'Octopus', mermaid: 'Mermaids', guard: 'Merman Guard' },
    npc: { marina: 'Marina', queen: 'Queen Coralie', guard: 'Captain Triton', mama: 'Mama Seahorse', baby: 'Baby Lulu', shelly: 'Grandpa Shelly', coral: 'Coral', pearl: 'Pearl' },
    q: {
      meet: 'Visit the Queen 👑', pearls: 'Find magic pearls ⚪ {n}/5', backQueen: 'Bring the pearls to the Queen 👑',
      baby: 'Find Baby Lulu in the kelp 🌿', bringBaby: 'Bring Lulu to her Mama 💛', whale: 'Say hello to the Whale 🐋',
      crystals: 'Light the crystals 💎 {n}/3', finale: 'Go back to the Queen 👑', free: 'Explore and make friends! 💖',
    },
    talk: {
      marina1: 'Hello! I am Marina! The Queen is looking for you. Her palace is that way! 👉',
      marina2: 'Swim with the stick. Look around by sliding your finger! ✨',
      queen1: 'Welcome, little mermaid! Oh no... my 5 magic pearls fell into the sea! Can you find them?',
      queen2: 'Follow the little sparkles. They show the way! ✨',
      queenPearls: 'My pearls! Thank you! Here is a crown, just for you! 👑',
      queenBaby: 'Oh! Baby seahorse Lulu is lost in the Kelp Forest. Please find her!',
      baby: 'Mama? I am lost... Can you take me home? 🥺',
      mama: 'My baby Lulu! Thank you, thank you! 💛',
      mamaNext: 'The big Whale is singing. Go say hello!',
      whale: 'Hmmmmm... Hello, little friend! Listen to my song! 🎶',
      whaleNext: 'The Deep Trench is too dark. Grandpa Turtle Shelly needs your help!',
      shelly: 'Hello young one! Touch the 3 sleeping crystals to light up the deep sea!',
      shellyDone: 'Look how it sparkles! Go tell the Queen!',
      queenFinal: 'You did it! You are the Princess of the Ocean! 🌈',
      guard: 'I am Captain Triton. I keep the city safe! 🔱',
      coral: 'Have you seen the dolphins? They jump out of the water! 🐬',
      pearl: 'Try swimming up very fast. You can jump out of the water! 💦',
      free: 'Swim everywhere and find all your sea friends! 📖',
      tailGift: 'Your tail is now rainbow! 🌈',
    },
  },
  fr: {
    tagline: 'Plonge dans une mer magique !', start: 'Plonger !', rotate: 'Tourne ton téléphone 📱↔️',
    album: 'Mes amis de la mer', settings: 'Réglages',
    paintOn: 'Effet peinture : OUI', paintOff: 'Effet peinture : NON',
    soundOn: 'Son : OUI', soundOff: 'Son : NON', lang: 'Langue : Français',
    qHigh: 'Qualité : Magnifique', qMed: 'Qualité : Fluide', qLow: 'Qualité : Rapide', reset: 'Recommencer',
    newFriend: 'Nouvel ami !', pearl: 'Une perle magique !', crystal: 'Le cristal brille !',
    names: { clownfish: 'Poisson-clown', tang: 'Chirurgien bleu', yellowfish: 'Poisson soleil', angelfish: 'Poisson-ange', whale: 'Baleine', dolphin: 'Dauphin', seahorse: 'Hippocampe', crab: 'Crabe', jellyfish: 'Méduse', turtle: 'Tortue de mer', manta: 'Raie manta', puffer: 'Poisson-globe', octopus: 'Pieuvre', mermaid: 'Sirènes', guard: 'Garde triton' },
    npc: { marina: 'Marina', queen: 'Reine Coralie', guard: 'Capitaine Triton', mama: 'Maman Hippocampe', baby: 'Bébé Lulu', shelly: 'Papi Shelly', coral: 'Corail', pearl: 'Perle' },
    q: {
      meet: 'Va voir la Reine 👑', pearls: 'Trouve les perles ⚪ {n}/5', backQueen: 'Rapporte les perles à la Reine 👑',
      baby: 'Trouve Bébé Lulu dans les algues 🌿', bringBaby: 'Ramène Lulu à sa maman 💛', whale: 'Dis bonjour à la Baleine 🐋',
      crystals: 'Allume les cristaux 💎 {n}/3', finale: 'Retourne voir la Reine 👑', free: 'Explore et fais-toi des amis ! 💖',
    },
    talk: {
      marina1: 'Coucou ! Je suis Marina ! La Reine te cherche. Son palais est par là ! 👉',
      marina2: 'Nage avec le rond. Regarde autour en glissant ton doigt ! ✨',
      queen1: 'Bienvenue, petite sirène ! Oh non... mes 5 perles magiques sont tombées dans la mer ! Tu peux les trouver ?',
      queen2: 'Suis les petites étincelles. Elles montrent le chemin ! ✨',
      queenPearls: 'Mes perles ! Merci ! Voici une couronne, rien que pour toi ! 👑',
      queenBaby: 'Oh ! Bébé hippocampe Lulu est perdue dans la forêt d\'algues. Trouve-la !',
      baby: 'Maman ? Je suis perdue... Tu me ramènes à la maison ? 🥺',
      mama: 'Mon bébé Lulu ! Merci, merci ! 💛',
      mamaNext: 'La grande Baleine chante. Va lui dire bonjour !',
      whale: 'Hmmmmm... Bonjour, petite amie ! Écoute ma chanson ! 🎶',
      whaleNext: 'La Fosse Profonde est trop sombre. Papi Tortue Shelly a besoin de toi !',
      shelly: 'Bonjour petite ! Touche les 3 cristaux endormis pour éclairer le fond de la mer !',
      shellyDone: 'Regarde comme ça brille ! Va le dire à la Reine !',
      queenFinal: 'Bravo ! Tu es la Princesse de l\'Océan ! 🌈',
      guard: 'Je suis le Capitaine Triton. Je protège la ville ! 🔱',
      coral: 'Tu as vu les dauphins ? Ils sautent hors de l\'eau ! 🐬',
      pearl: 'Nage très vite vers le haut. Tu peux sauter hors de l\'eau ! 💦',
      free: 'Nage partout et trouve tous tes amis de la mer ! 📖',
      tailGift: 'Ta queue est maintenant arc-en-ciel ! 🌈',
    },
  },
};

let lang = 'en';
export function setLang(l) { lang = STR[l] ? l : 'en'; }
export function getLang() { return lang; }
export function t(path, vars) {
  let v = path.split('.').reduce((o, k) => (o ? o[k] : undefined), STR[lang]) ?? path.split('.').reduce((o, k) => (o ? o[k] : undefined), STR.en) ?? path;
  if (vars) for (const k in vars) v = v.replace(`{${k}}`, vars[k]);
  return v;
}
