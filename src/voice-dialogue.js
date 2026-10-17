// Speech only selects approved replies. It never changes quest state.
import { voiceStrings } from './i18n.js';
export const VOICE_REPLY = {
  marina: {
    hello: 'Coucou ! Je suis Marina. On explore ensemble ?',
    treasure: 'Les perles brillent dans les coquillages. Suis les étincelles !',
    help: 'La petite étoile montre le chemin. Tu peux aussi toucher ton objectif en haut.',
    play: 'Oui ! Nage avec moi jusqu’au château !',
    world: 'Le château s’appelle Coralia. Il est plein de secrets joyeux.',
    unknown: 'Je n’ai pas bien compris. Tu peux me le redire ?',
  },
  queen: {
    hello: 'Bonjour, petite sirène. Je suis heureuse de te voir !',
    treasure: 'Les perles magiques se cachent dans des coquillages, partout dans la mer.',
    help: 'Regarde les étincelles et nage vers leur lumière.',
    play: 'Dans mon royaume, chaque promenade est une aventure !',
    world: 'Coralia a grandi autour d’un coquillage enchanté.',
    unknown: 'Pardon, ma petite. Peux-tu parler encore une fois ?',
  },
  guard: {
    hello: 'Salut, exploratrice ! Le capitaine Triton veille sur toi.',
    treasure: 'J’ai aperçu des perles près du récif de corail.',
    help: 'La porte en coquillage est toujours ouverte pour toi.',
    play: 'On fait une course jusqu’à la fontaine ?',
    world: 'Je garde les tours et les ponts de Coralia.',
    unknown: 'Je n’ai pas entendu. Essaie encore, petite aventurière !',
  },
  coral: {
    hello: 'Coucou ! Je m’appelle Corail.',
    treasure: 'Les coquillages adorent cacher les perles brillantes.',
    help: 'Essaie de suivre l’étoile dorée !',
    play: 'Viens voir les dauphins. Ils savent sauter très haut !',
    world: 'Le récif rose est mon endroit préféré.',
    unknown: 'Oh, je n’ai pas compris. Redis-moi doucement ?',
  },
  pearl: {
    hello: 'Bonjour ! Moi, c’est Perle.',
    treasure: 'J’ai vu une jolie perle au fond de la mer.',
    help: 'Tu peux nager en haut, en bas et partout autour.',
    play: 'Faisons un grand saut hors de l’eau !',
    world: 'Les ruelles du marché sentent le gâteau de lune.',
    unknown: 'Tu peux répéter ? Les bulles m’ont chatouillé les oreilles !',
  },
  mama: {
    hello: 'Bonjour, petite amie de Lulu !',
    treasure: 'Lulu trouve parfois des trésors parmi les algues.',
    help: 'Si tu cherches Lulu, regarde dans la forêt d’algues.',
    play: 'Lulu et moi aimons danser entre les coraux.',
    world: 'Le jardin du château est très calme le matin.',
    unknown: 'Je n’ai pas bien entendu. Tu peux répéter ?',
  },
  baby: {
    hello: 'Coucou ! Je suis Lulu !',
    treasure: 'Une perle ? Elle est peut-être derrière une algue !',
    help: 'Je reste près de toi. On retrouvera maman ensemble.',
    play: 'Oui oui ! Jouons à cache-cache !',
    world: 'Les grandes algues ressemblent à une forêt magique.',
    unknown: 'Hein ? Tu peux redire, s’il te plaît ?',
  },
  shelly: {
    hello: 'Bonjour, jeune sirène. Papi Shelly est ravi de te voir.',
    treasure: 'Les trésors les plus beaux sont les amis que l’on rencontre.',
    help: 'Dans la fosse, touche les cristaux endormis pour les réveiller.',
    play: 'Je suis lent, mais je gagne toujours à cache-cache !',
    world: 'Je connais des histoires plus vieilles que le palais.',
    unknown: 'Mes vieilles oreilles ont raté tes mots. Encore une fois ?',
  },
  whale: {
    hello: 'Hmmm... Bonjour, petite amie !',
    treasure: 'J’ai entendu les perles tinter dans les coquillages.',
    help: 'Ma chanson te guidera vers Papi Shelly.',
    play: 'Écoute ma grande chanson de la mer !',
    world: 'La mer garde les rêves de toutes les sirènes.',
    unknown: 'Hmmm... Je n’ai pas compris. Recommence ?',
  },
  tailor: {
    hello: 'Bienvenue dans mon atelier ! Je suis Tilli.',
    treasure: 'Une jolie barrette t’attend si tu explores la fontaine.',
    help: 'Monte le grand escalier pour trouver la fontaine de perles.',
    play: 'On peut habiller ta sirène avec des trésors colorés !',
    world: 'Chaque coquillage du marché a sa petite histoire.',
    unknown: 'Je n’ai pas compris, ma jolie. Tu peux répéter ?',
  },
  baker: {
    hello: 'Bonjour ! Mes gâteaux de perles sont presque prêts.',
    treasure: 'Mon trésor, c’est une recette de gâteau de lune.',
    help: 'La fontaine est juste après les boutiques.',
    play: 'Je prépare un goûter pour la fête du château !',
    world: 'Le marché s’anime dès que les clochettes sonnent.',
    unknown: 'Le four fait du bruit ! Tu peux me redire ?',
  },
  keeper: {
    hello: 'Bonjour ! Bienvenue près de ma fontaine.',
    treasure: 'Un haut en verre de mer attend les exploratrices du pont ouest.',
    help: 'Le pont ouest est sur la gauche du palais.',
    play: 'Regarde comme l’eau danse dans la fontaine !',
    world: 'Chaque goutte de la fontaine porte un petit souhait.',
    unknown: 'L’eau a couvert ta voix. Peux-tu répéter ?',
  },
  bard: {
    hello: 'Bonjour ! Je suis le barde des ponts.',
    treasure: 'Une queue saphir t’attend si tu visites le pont est.',
    help: 'Le pont est traverse les jardins du palais.',
    play: 'Chantons ensemble : la mer brille et les bulles dansent !',
    world: 'Ce soir, j’inventerai une chanson sur Coralia.',
    unknown: 'J’ai perdu le fil de ta chanson. Tu peux répéter ?',
  },
  librarian: {
    hello: 'Bonjour. Entre dans la bibliothèque des coquillages.',
    treasure: 'Le plus vieux livre parle d’une perle qui exauce les souhaits.',
    help: 'Les livres disent de toujours suivre la petite étoile.',
    play: 'Choisissons une histoire de dragons de mer !',
    world: 'Le palais est né d’un coquillage qui savait rêver.',
    unknown: 'J’étais plongée dans mon livre. Répète, s’il te plaît ?',
  },
  fairy: {
    hello: 'Coucou ! Je suis la fée du jardin.',
    treasure: 'Les coraux brillants ressemblent à de petites couronnes.',
    help: 'Dans le jardin, écoute les fleurs de mer.',
    play: 'Faisons danser les étoiles de corail !',
    world: 'Quand la lune se lève, le jardin devient magique.',
    unknown: 'Les étoiles m’ont distraite. Tu peux répéter ?',
  },
  dolphin: {
    hello: 'Coucou ! Je suis Domi le dauphin !',
    treasure: 'J’ai vu une perle près du récif rose !',
    help: 'Suis les étincelles. Je nagerai près de toi !',
    play: 'Oui ! Faisons la course jusqu’au château !',
    world: 'Je saute au-dessus des vagues pour voir toutes les tours.',
    unknown: 'Splash ! Je n’ai pas compris. Tu peux répéter ?',
  },
  turtle: {
    hello: 'Bonjour ! Je suis une tortue voyageuse.',
    treasure: 'Les vieux coquillages gardent parfois des perles.',
    help: 'Prends ton temps et suis la petite étoile.',
    play: 'Une course ? Je préfère une jolie promenade !',
    world: 'J’ai vu grandir les jardins de Coralia.',
    unknown: 'Parle un peu plus fort pour moi, s’il te plaît.',
  },
};

// New districts add new friends regularly. Give each one a complete, fixed
// response set so the microphone never depends on a network chatbot.
for (const [who, name] of Object.entries(voiceStrings('fr').npc)) {
  VOICE_REPLY[who] ||= {
    hello: `Coucou ! Moi, c’est ${name}. Quel bonheur de te rencontrer !`,
    treasure: 'Les petits trésors brillent près des chemins. Regarde bien autour de toi !',
    help: 'Suis la lumière de ton objectif. Tu peux aussi explorer à ton rythme !',
    play: 'Avec plaisir ! Viens découvrir mon coin préféré !',
    world: 'Chaque endroit de ce monde cache une jolie histoire à découvrir.',
    unknown: 'Je n’ai pas bien entendu. Tu peux me parler encore une fois ?',
  };
}

export function matchVoiceIntent(speech) {
  const s = speech.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/bonjour|coucou|salut|bonsoir|hello|appell/.test(s)) return 'hello';
  if (/tresor|perle|coffre|couronne|cadeau/.test(s)) return 'treasure';
  if (/aide|aider|\bou\b|comment|cherche|trouver|perdu/.test(s)) return 'help';
  if (/\bjou|jeu|dans|chant|course|partie/.test(s)) return 'play';
  if (/chateau|palais|ville|jardin|mer|histoire/.test(s)) return 'world';
  return 'unknown';
}

export function voiceReply(who, speech) {
  const intent = matchVoiceIntent(speech || '');
  return { key: intent, text: (VOICE_REPLY[who] || VOICE_REPLY.marina)[intent] };
}
