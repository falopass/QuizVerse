// Published seed pairs. Regenerate from generated/trending-seed.normalized.json when the seed changes.
const EN_TO_ES: Record<string, string> = {
  'en-attack-on-titan-fan-trivia-challenge': 'es-trivia-fan-de-attack-on-titan',
  'en-avatar-fan-trivia-challenge': 'es-trivia-fan-de-avatar',
  'en-barbie-fan-trivia-challenge': 'es-trivia-fan-de-barbie',
  'en-beef-fan-trivia-challenge': 'es-trivia-fan-de-beef',
  'en-bridgerton-fan-trivia-challenge': 'es-trivia-fan-de-bridgerton',
  'en-chainsaw-man-fan-trivia-challenge': 'es-trivia-fan-de-chainsaw-man',
  'en-classroom-of-the-elite-fan-trivia-challenge': 'es-trivia-fan-de-classroom-of-the-elite',
  'en-demon-slayer-fan-trivia-challenge': 'es-trivia-fan-de-demon-slayer',
  'en-dr-stone-fan-trivia-challenge': 'es-trivia-fan-de-dr-stone',
  'en-dune-fan-trivia-challenge': 'es-trivia-fan-de-dune',
  'en-euphoria-fan-trivia-challenge': 'es-trivia-fan-de-euphoria',
  'en-frieren-fan-trivia-challenge': 'es-trivia-fan-de-frieren',
  'en-grand-theft-auto-vi-fan-trivia-challenge': 'es-trivia-fan-de-grand-theft-auto-vi',
  'en-hacks-fan-trivia-challenge': 'es-trivia-fan-de-hacks',
  'en-hades-ii-fan-trivia-challenge': 'es-trivia-fan-de-hades-ii',
  'en-harry-potter-fan-trivia-challenge': 'es-trivia-fan-de-harry-potter',
  'en-how-deep-does-your-attack-on-titan-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-attack-on-titan',
  'en-how-deep-does-your-avatar-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-avatar',
  'en-how-deep-does-your-barbie-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-barbie',
  'en-how-deep-does-your-beef-knowledge-go': 'es-que-tan-profundo-llega-tu-conocimiento-de-beef',
  'en-how-deep-does-your-bridgerton-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-bridgerton',
  'en-how-deep-does-your-chainsaw-man-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-chainsaw-man',
  'en-how-deep-does-your-classroom-of-the-elite-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-classroom-of-the-elite',
  'en-how-deep-does-your-demon-slayer-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-demon-slayer',
  'en-how-deep-does-your-dr-stone-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-dr-stone',
  'en-how-deep-does-your-dune-knowledge-go': 'es-que-tan-profundo-llega-tu-conocimiento-de-dune',
  'en-how-deep-does-your-euphoria-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-euphoria',
  'en-how-deep-does-your-frieren-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-frieren',
  'en-how-deep-does-your-grand-theft-auto-vi-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-grand-theft-auto-vi',
  'en-how-deep-does-your-hacks-knowledge-go': 'es-que-tan-profundo-llega-tu-conocimiento-de-hacks',
  'en-how-deep-does-your-hades-ii-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-hades-ii',
  'en-how-deep-does-your-harry-potter-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-harry-potter',
  'en-how-deep-does-your-invincible-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-invincible',
  'en-how-deep-does-your-jujutsu-kaisen-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-jujutsu-kaisen',
  'en-how-deep-does-your-k-pop-knowledge-go': 'es-que-tan-profundo-llega-tu-conocimiento-de-k-pop',
  'en-how-deep-does-your-marvel-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-marvel',
  'en-how-deep-does-your-naruto-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-naruto',
  'en-how-deep-does-your-one-piece-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-one-piece',
  'en-how-deep-does-your-pokemon-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-pokemon',
  'en-how-deep-does-your-project-hail-mary-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-project-hail-mary',
  'en-how-deep-does-your-re-zero-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-re-zero',
  'en-how-deep-does-your-resident-evil-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-resident-evil',
  'en-how-deep-does-your-severance-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-severance',
  'en-how-deep-does-your-solo-leveling-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-solo-leveling',
  'en-how-deep-does-your-spy-x-family-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-spy-x-family',
  'en-how-deep-does-your-squid-game-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-el-juego-del-calamar',
  'en-how-deep-does-your-star-wars-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-star-wars',
  'en-how-deep-does-your-starfield-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-starfield',
  'en-how-deep-does-your-stranger-things-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-stranger-things',
  'en-how-deep-does-your-taylor-swift-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-taylor-swift',
  'en-how-deep-does-your-that-time-i-got-reincarnated-as-a-slime-knowledge-':
    'es-que-tan-profundo-llega-tu-conocimiento-de-that-time-i-got-reincarnate',
  'en-how-deep-does-your-the-bear-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-the-bear',
  'en-how-deep-does-your-the-boys-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-the-boys',
  'en-how-deep-does-your-the-last-of-us-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-the-last-of-us',
  'en-how-deep-does-your-the-legend-of-zelda-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-the-legend-of-zelda',
  'en-how-deep-does-your-the-mummy-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-the-mummy',
  'en-how-deep-does-your-the-super-mario-galaxy-movie-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-the-super-mario-galaxy-movi',
  'en-how-deep-does-your-the-white-lotus-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-the-white-lotus',
  'en-how-deep-does-your-wednesday-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-merlina',
  'en-how-deep-does-your-wicked-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-wicked',
  'en-how-deep-does-your-witch-hat-atelier-knowledge-go':
    'es-que-tan-profundo-llega-tu-conocimiento-de-witch-hat-atelier',
  'en-invincible-fan-trivia-challenge': 'es-trivia-fan-de-invincible',
  'en-jujutsu-kaisen-fan-trivia-challenge': 'es-trivia-fan-de-jujutsu-kaisen',
  'en-k-pop-fan-trivia-challenge': 'es-trivia-fan-de-k-pop',
  'en-marvel-fan-trivia-challenge': 'es-trivia-fan-de-marvel',
  'en-naruto-fan-trivia-challenge': 'es-trivia-fan-de-naruto',
  'en-one-piece-fan-trivia-challenge': 'es-trivia-fan-de-one-piece',
  'en-oppenheimer-fan-trivia-challenge': 'es-trivia-fan-de-oppenheimer',
  'en-pokemon-fan-trivia-challenge': 'es-trivia-fan-de-pokemon',
  'en-project-hail-mary-fan-trivia-challenge': 'es-trivia-fan-de-project-hail-mary',
  'en-re-zero-fan-trivia-challenge': 'es-trivia-fan-de-re-zero',
  'en-resident-evil-fan-trivia-challenge': 'es-trivia-fan-de-resident-evil',
  'en-severance-fan-trivia-challenge': 'es-trivia-fan-de-severance',
  'en-solo-leveling-fan-trivia-challenge': 'es-trivia-fan-de-solo-leveling',
  'en-spy-x-family-fan-trivia-challenge': 'es-trivia-fan-de-spy-x-family',
  'en-squid-game-fan-trivia-challenge': 'es-trivia-fan-de-el-juego-del-calamar',
  'en-star-wars-fan-trivia-challenge': 'es-trivia-fan-de-star-wars',
  'en-starfield-fan-trivia-challenge': 'es-trivia-fan-de-starfield',
  'en-stranger-things-fan-trivia-challenge': 'es-trivia-fan-de-stranger-things',
  'en-taylor-swift-fan-trivia-challenge': 'es-trivia-fan-de-taylor-swift',
  'en-that-time-i-got-reincarnated-as-a-slime-fan-trivia-challenge':
    'es-trivia-fan-de-that-time-i-got-reincarnated-as-a-slime',
  'en-the-bear-fan-trivia-challenge': 'es-trivia-fan-de-the-bear',
  'en-the-boys-fan-trivia-challenge': 'es-trivia-fan-de-the-boys',
  'en-the-last-of-us-fan-trivia-challenge': 'es-trivia-fan-de-the-last-of-us',
  'en-the-legend-of-zelda-fan-trivia-challenge': 'es-trivia-fan-de-the-legend-of-zelda',
  'en-the-mummy-fan-trivia-challenge': 'es-trivia-fan-de-the-mummy',
  'en-the-super-mario-galaxy-movie-fan-trivia': 'es-trivia-fan-de-the-super-mario-galaxy-movie',
  'en-the-white-lotus-fan-trivia-challenge': 'es-trivia-fan-de-the-white-lotus',
  'en-wednesday-fan-trivia-challenge': 'es-trivia-fan-de-merlina',
  // Pares del seed editorial (scripts/seed/editorial-seed-personality.json), mantenidos a mano.
  'en-what-is-your-ideal-weekend': 'es-cual-es-tu-fin-de-semana-ideal',
  'en-what-is-your-learning-style': 'es-cual-es-tu-estilo-de-aprendizaje',
  'en-what-is-your-work-style': 'es-cual-es-tu-estilo-de-trabajo',
  'en-what-kind-of-friend-are-you': 'es-que-tipo-de-amigo-eres',
  'en-what-kind-of-traveler-are-you': 'es-que-tipo-de-viajero-eres',
  'en-what-role-would-you-play-inside-attack-on-titan':
    'es-que-rol-jugarias-dentro-de-attack-on-titan',
  'en-what-role-would-you-play-inside-avatar': 'es-que-rol-jugarias-dentro-de-avatar',
  'en-what-role-would-you-play-inside-barbie': 'es-que-rol-jugarias-dentro-de-barbie',
  'en-what-role-would-you-play-inside-beef': 'es-que-rol-jugarias-dentro-de-beef',
  'en-what-role-would-you-play-inside-bridgerton': 'es-que-rol-jugarias-dentro-de-bridgerton',
  'en-what-role-would-you-play-inside-chainsaw-man': 'es-que-rol-jugarias-dentro-de-chainsaw-man',
  'en-what-role-would-you-play-inside-classroom-of-the-elite':
    'es-que-rol-jugarias-dentro-de-classroom-of-the-elite',
  'en-what-role-would-you-play-inside-demon-slayer': 'es-que-rol-jugarias-en-demon-slayer',
  'en-what-role-would-you-play-inside-dr-stone': 'es-que-rol-jugarias-en-dr-stone',
  'en-what-role-would-you-play-inside-dune': 'es-que-rol-jugarias-dentro-de-dune',
  'en-what-role-would-you-play-inside-euphoria': 'es-que-rol-jugarias-dentro-de-euphoria',
  'en-what-role-would-you-play-inside-frieren': 'es-que-rol-jugarias-dentro-de-frieren',
  'en-what-role-would-you-play-inside-grand-theft-auto-vi':
    'es-que-rol-jugarias-en-grand-theft-auto-vi',
  'en-what-role-would-you-play-inside-hacks': 'es-que-rol-jugarias-dentro-de-hacks',
  'en-what-role-would-you-play-inside-hades-ii': 'es-que-rol-jugarias-dentro-de-hades-ii',
  'en-what-role-would-you-play-inside-harry-potter': 'es-que-rol-jugarias-en-harry-potter',
  'en-what-role-would-you-play-inside-invincible': 'es-que-rol-jugarias-dentro-de-invincible',
  'en-what-role-would-you-play-inside-jujutsu-kaisen':
    'es-que-rol-jugarias-dentro-de-jujutsu-kaisen',
  'en-what-role-would-you-play-inside-k-pop': 'es-que-rol-jugarias-dentro-del-k-pop',
  'en-what-role-would-you-play-inside-marvel': 'es-que-rol-jugarias-dentro-de-marvel',
  'en-what-role-would-you-play-inside-naruto': 'es-que-rol-jugarias-dentro-de-naruto',
  'en-what-role-would-you-play-inside-one-piece': 'es-que-rol-jugarias-dentro-de-one-piece',
  'en-what-role-would-you-play-inside-oppenheimer': 'es-que-rol-jugarias-dentro-de-oppenheimer',
  'en-what-role-would-you-play-inside-pokemon': 'es-que-rol-jugarias-dentro-de-pokemon',
  'en-what-role-would-you-play-inside-project-hail-mary':
    'es-que-rol-jugarias-en-project-hail-mary',
  'en-what-role-would-you-play-inside-re-zero': 'es-que-rol-jugarias-dentro-de-re-zero',
  'en-what-role-would-you-play-inside-resident-evil': 'es-que-rol-jugarias-dentro-de-resident-evil',
  'en-what-role-would-you-play-inside-severance': 'es-que-rol-jugarias-dentro-de-lumon',
  'en-what-role-would-you-play-inside-solo-leveling': 'es-que-rol-jugarias-dentro-de-solo-leveling',
  'en-what-role-would-you-play-inside-spy-x-family': 'es-que-rol-jugarias-dentro-de-spy-x-family',
  'en-what-role-would-you-play-inside-squid-game':
    'es-que-rol-jugarias-dentro-de-el-juego-del-calamar',
  'en-what-role-would-you-play-inside-star-wars': 'es-que-rol-jugarias-dentro-de-star-wars',
  'en-what-role-would-you-play-inside-starfield': 'es-que-rol-jugarias-dentro-de-starfield',
  'en-what-role-would-you-play-inside-stranger-things': 'es-que-rol-jugarias-en-stranger-things',
  'en-what-role-would-you-play-inside-taylor-swift': 'es-que-rol-jugarias-dentro-de-taylor-swift',
  'en-what-role-would-you-play-inside-that-time-i-got-reincarnated-as-a-sli':
    'es-que-rol-jugarias-en-that-time-i-got-reincarnated-as-a-slime',
  'en-what-role-would-you-play-inside-the-bear': 'es-que-rol-jugarias-dentro-de-the-bear',
  'en-what-role-would-you-play-inside-the-boys': 'es-que-rol-jugarias-dentro-de-the-boys',
  'en-what-role-would-you-play-inside-the-last-of-us':
    'es-que-rol-jugarias-dentro-de-the-last-of-us',
  'en-what-role-would-you-play-inside-the-legend-of-zelda':
    'es-que-rol-jugarias-dentro-de-the-legend-of-zelda',
  'en-what-role-would-you-play-inside-the-mummy': 'es-que-rol-jugarias-en-la-momia',
  'en-what-role-would-you-play-inside-the-super-mario-galaxy-movie':
    'es-que-rol-jugarias-en-the-super-mario-galaxy-movie',
  'en-what-role-would-you-play-inside-the-white-lotus':
    'es-que-rol-jugarias-dentro-de-the-white-lotus',
  'en-what-role-would-you-play-inside-wednesday': 'es-que-rol-jugarias-dentro-de-merlina',
  'en-what-role-would-you-play-inside-wicked': 'es-que-rol-jugarias-dentro-de-wicked',
  'en-what-role-would-you-play-inside-witch-hat-atelier':
    'es-que-rol-jugarias-dentro-de-witch-hat-atelier',
  'en-which-attack-on-titan-energy-matches-you-best':
    'es-que-energia-de-attack-on-titan-combina-mejor-contigo',
  'en-which-avatar-energy-matches-you-best': 'es-que-energia-de-avatar-combina-mejor-contigo',
  'en-which-barbie-energy-matches-you-best': 'es-que-energia-de-barbie-combina-mejor-contigo',
  'en-which-beef-energy-matches-you-best': 'es-que-energia-de-beef-combina-mejor-contigo',
  'en-which-bridgerton-energy-matches-you-best':
    'es-que-energia-de-bridgerton-combina-mejor-contigo',
  'en-which-chainsaw-man-energy-matches-you-best':
    'es-que-energia-de-chainsaw-man-combina-mejor-contigo',
  'en-which-classroom-of-the-elite-energy-matches-you-best':
    'es-que-energia-de-classroom-of-the-elite-combina-mejor-contigo',
  'en-which-demon-slayer-energy-matches-you-best':
    'es-que-energia-de-demon-slayer-combina-mejor-contigo',
  'en-which-dr-stone-energy-matches-you-best': 'es-que-energia-de-dr-stone-combina-mejor-contigo',
  'en-which-dune-energy-matches-you-best': 'es-que-energia-de-dune-combina-mejor-contigo',
  'en-which-euphoria-energy-matches-you-best': 'es-que-energia-de-euphoria-combina-mejor-contigo',
  'en-which-frieren-energy-matches-you-best': 'es-que-energia-de-frieren-combina-mejor-contigo',
  'en-which-grand-theft-auto-vi-energy-matches-you-best':
    'es-que-energia-de-grand-theft-auto-vi-combina-mejor-contigo',
  'en-which-hacks-energy-matches-you-best': 'es-que-energia-de-hacks-combina-mejor-contigo',
  'en-which-hades-ii-energy-matches-you-best': 'es-que-energia-de-hades-ii-combina-mejor-contigo',
  'en-which-harry-potter-energy-matches-you-best':
    'es-que-energia-de-harry-potter-combina-mejor-contigo',
  'en-which-invincible-energy-matches-you-best':
    'es-que-energia-de-invincible-combina-mejor-contigo',
  'en-which-jujutsu-kaisen-energy-matches-you-best':
    'es-que-energia-de-jujutsu-kaisen-combina-mejor-contigo',
  'en-which-k-pop-energy-matches-you-best': 'es-que-energia-de-k-pop-combina-mejor-contigo',
  'en-which-marvel-energy-matches-you-best': 'es-que-energia-de-marvel-combina-mejor-contigo',
  'en-which-naruto-energy-matches-you-best': 'es-que-energia-de-naruto-combina-mejor-contigo',
  'en-which-one-piece-energy-matches-you-best': 'es-que-energia-de-one-piece-combina-mejor-contigo',
  'en-which-oppenheimer-energy-matches-you-best':
    'es-que-energia-de-oppenheimer-combina-mejor-contigo',
  'en-which-pokemon-energy-matches-you-best': 'es-que-energia-de-pokemon-combina-mejor-contigo',
  'en-which-project-hail-mary-energy-matches-you-best':
    'es-que-energia-de-project-hail-mary-combina-mejor-contigo',
  'en-which-re-zero-energy-matches-you-best': 'es-que-energia-de-re-zero-combina-mejor-contigo',
  'en-which-resident-evil-energy-matches-you-best':
    'es-que-energia-de-resident-evil-combina-mejor-contigo',
  'en-which-severance-energy-matches-you-best': 'es-que-energia-de-severance-combina-mejor-contigo',
  'en-which-solo-leveling-energy-matches-you-best':
    'es-que-energia-de-solo-leveling-combina-mejor-contigo',
  'en-which-spy-x-family-energy-matches-you-best':
    'es-que-energia-de-spy-x-family-combina-mejor-contigo',
  'en-which-squid-game-energy-matches-you-best':
    'es-que-energia-de-el-juego-del-calamar-combina-mejor-contigo',
  'en-which-star-wars-energy-matches-you-best': 'es-que-energia-de-star-wars-combina-mejor-contigo',
  'en-which-starfield-energy-matches-you-best': 'es-que-energia-de-starfield-combina-mejor-contigo',
  'en-which-stranger-things-energy-matches-you-best':
    'es-que-energia-de-stranger-things-combina-mejor-contigo',
  'en-which-taylor-swift-energy-matches-you-best':
    'es-que-energia-de-taylor-swift-combina-mejor-contigo',
  'en-which-that-time-i-got-reincarnated-as-a-slime-energy-matches-you-best':
    'es-que-energia-de-that-time-i-got-reincarnated-as-a-slime-combina-mejor-',
  'en-which-the-bear-energy-matches-you-best': 'es-que-energia-de-the-bear-combina-mejor-contigo',
  'en-which-the-boys-energy-matches-you-best': 'es-que-energia-de-the-boys-combina-mejor-contigo',
  'en-which-the-last-of-us-energy-matches-you-best':
    'es-que-energia-de-the-last-of-us-combina-mejor-contigo',
  'en-which-the-legend-of-zelda-energy-matches-you-best':
    'es-que-energia-de-the-legend-of-zelda-combina-mejor-contigo',
  'en-which-the-mummy-energy-matches-you-best': 'es-que-energia-de-the-mummy-combina-mejor-contigo',
  'en-which-the-super-mario-galaxy-movie-energy-matches-you-best':
    'es-que-energia-de-the-super-mario-galaxy-movie-combina-mejor-contigo',
  'en-which-the-white-lotus-energy-matches-you-best':
    'es-que-energia-de-the-white-lotus-combina-mejor-contigo',
  'en-which-wednesday-energy-matches-you-best': 'es-que-energia-de-merlina-combina-mejor-contigo',
  'en-which-wicked-energy-matches-you-best': 'es-que-energia-de-wicked-combina-mejor-contigo',
  'en-which-witch-hat-atelier-energy-matches-you-best':
    'es-que-energia-de-witch-hat-atelier-combina-mejor-contigo',
  'en-wicked-fan-trivia-challenge': 'es-trivia-fan-de-wicked',
  'en-witch-hat-atelier-fan-trivia-challenge': 'es-trivia-fan-de-witch-hat-atelier',
};

const ES_TO_EN = Object.fromEntries(Object.entries(EN_TO_ES).map(([en, es]) => [es, en]));

export function getEquivalentQuizSlug(slug: string, targetLocale: 'en' | 'es'): string | null {
  return (targetLocale === 'es' ? EN_TO_ES : ES_TO_EN)[slug] ?? null;
}
