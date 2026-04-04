import type { Category, PersonalityResult, Question, Quiz } from '@/types/quiz';

type Localized = { en: string; es: string };

type Theme = {
  id: string;
  categorySlug: 'personality' | 'lifestyle' | 'trivia' | 'culture';
  title: Localized;
  description: Localized;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
};

type TriviaFact = {
  question: Localized;
  options: [Localized, Localized, Localized, Localized];
  correct: 0 | 1 | 2 | 3;
  explanation: Localized;
};

export const LAUNCH_CATEGORIES: Category[] = [
  { id: 'launch-personality', name: 'Personality', slug: 'personality', description: 'Quizzes about taste, instincts, relationships and self-discovery.', icon: 'Q', color: '#d87834', gradient_from: '#d87834', gradient_to: '#7d5f4f', quiz_count: 12, sort_order: 1 },
  { id: 'launch-trivia', name: 'Trivia', slug: 'trivia', description: 'Fast knowledge rounds with polished pacing and clean reveals.', icon: 'T', color: '#1f6feb', gradient_from: '#1f6feb', gradient_to: '#37b4ff', quiz_count: 12, sort_order: 2 },
  { id: 'launch-culture', name: 'Culture', slug: 'culture', description: 'Cinema, music, internet, books and modern shared references.', icon: 'C', color: '#7c3aed', gradient_from: '#7c3aed', gradient_to: '#b16eff', quiz_count: 12, sort_order: 3 },
  { id: 'launch-lifestyle', name: 'Lifestyle', slug: 'lifestyle', description: 'Coffee, routines, travel, work style and everyday rituals.', icon: 'L', color: '#0f9d58', gradient_from: '#0f9d58', gradient_to: '#7cd992', quiz_count: 12, sort_order: 4 },
];

const PERSONALITY_RESULTS = [
  {
    tag: 'warm',
    title: { en: 'Warm Signal', es: 'Senal calida' },
    description: { en: 'You create comfort fast and make people feel welcomed without trying too hard.', es: 'Creas comodidad rapido y haces que la gente se sienta bienvenida sin demasiado esfuerzo.' },
    theme: 'fire' as const,
  },
  {
    tag: 'precise',
    title: { en: 'Precise Mode', es: 'Modo preciso' },
    description: { en: 'You move with intention, edit hard and trust clarity more than noise.', es: 'Te mueves con intencion, editas fuerte y confias mas en la claridad que en el ruido.' },
    theme: 'ice' as const,
  },
  {
    tag: 'curious',
    title: { en: 'Curious Current', es: 'Corriente curiosa' },
    description: { en: 'You keep life interesting by trying one more angle than everyone else.', es: 'Mantienes la vida interesante probando un angulo mas que el resto.' },
    theme: 'stars' as const,
  },
  {
    tag: 'grounded',
    title: { en: 'Grounded Tempo', es: 'Tempo anclado' },
    description: { en: 'You protect steadiness, read the room well and know how to keep momentum healthy.', es: 'Proteges la estabilidad, lees bien el ambiente y sabes mantener un impulso sano.' },
    theme: 'forest' as const,
  },
] as const;

const PERSONALITY_PROMPTS: Localized[] = [
  { en: 'The choice that feels most like you is...', es: 'La eleccion que mas se parece a ti es...' },
  { en: 'Your friends usually rely on you for...', es: 'Tus amistades suelen apoyarse en ti por...' },
  { en: 'The atmosphere you protect most is...', es: 'La atmosfera que mas proteges es...' },
  { en: 'Your best decisions usually come from...', es: 'Tus mejores decisiones suelen venir de...' },
];

const PERSONALITY_OPTIONS: Localized[][] = [
  [{ en: 'Connection first', es: 'Conexion primero' }, { en: 'Clean execution', es: 'Ejecucion limpia' }, { en: 'One more idea', es: 'Una idea mas' }, { en: 'A steady pace', es: 'Un ritmo estable' }],
  [{ en: 'Softening the room', es: 'Suavizar el ambiente' }, { en: 'Organizing the details', es: 'Ordenar los detalles' }, { en: 'Opening a new path', es: 'Abrir un camino nuevo' }, { en: 'Keeping things balanced', es: 'Mantener el equilibrio' }],
  [{ en: 'Warmth', es: 'Calidez' }, { en: 'Clarity', es: 'Claridad' }, { en: 'Novelty', es: 'Novedad' }, { en: 'Calm', es: 'Calma' }],
  [{ en: 'Instinct', es: 'Instinto' }, { en: 'Structure', es: 'Estructura' }, { en: 'Curiosity', es: 'Curiosidad' }, { en: 'Rhythm', es: 'Ritmo' }],
];

const personalityThemes: Theme[] = [
  { id: 'city-energy', categorySlug: 'lifestyle', title: { en: 'Which City Energy Matches Your Rhythm?', es: 'Que energia de ciudad combina con tu ritmo?' }, description: { en: 'A quick read on pace, taste and how you move through the week.', es: 'Una lectura rapida sobre ritmo, gusto y como te mueves por la semana.' }, tags: ['city', 'taste', 'personality'], difficulty: 'easy' },
  { id: 'coffee-order', categorySlug: 'lifestyle', title: { en: 'What Does Your Coffee Order Reveal?', es: 'Que revela tu pedido de cafe?' }, description: { en: 'Taste, routine and tiny rituals turned into a personality read.', es: 'Gusto, rutina y pequenos rituales convertidos en un quiz de personalidad.' }, tags: ['coffee', 'routine', 'taste'], difficulty: 'easy' },
  { id: 'weekend-vibe', categorySlug: 'personality', title: { en: 'What Kind of Weekend Vibe Are You?', es: 'Que tipo de vibe de fin de semana eres?' }, description: { en: 'Not your plans, but the feeling you protect when the week opens up.', es: 'No tus planes, sino la sensacion que proteges cuando se abre la semana.' }, tags: ['weekend', 'mood', 'personality'], difficulty: 'easy' },
  { id: 'playlist-aura', categorySlug: 'personality', title: { en: 'What Is Your Playlist Aura?', es: 'Cual es tu aura de playlist?' }, description: { en: 'A personality read about curation, emotion and soundtrack instincts.', es: 'Una lectura de personalidad sobre curaduria, emocion e instintos musicales.' }, tags: ['music', 'playlist', 'aura'], difficulty: 'medium' },
  { id: 'desk-aesthetic', categorySlug: 'lifestyle', title: { en: 'What Is Your Desk Aesthetic, Really?', es: 'Cual es realmente la estetica de tu escritorio?' }, description: { en: 'How you focus, edit and shape your environment.', es: 'Como enfocas, editas y construyes tu entorno.' }, tags: ['desk', 'focus', 'style'], difficulty: 'easy' },
  { id: 'friend-role', categorySlug: 'personality', title: { en: 'What Role Do You Play in Every Group Chat?', es: 'Que rol juegas en cada grupo de chat?' }, description: { en: 'The social dynamic read for your default energy around friends.', es: 'La lectura social de tu energia por defecto con amistades.' }, tags: ['friends', 'social', 'chat'], difficulty: 'easy' },
  { id: 'travel-style', categorySlug: 'lifestyle', title: { en: 'What Is Your Travel Personality?', es: 'Cual es tu personalidad viajera?' }, description: { en: 'Pace, taste and the kind of movement that feels right to you.', es: 'Ritmo, gusto y el tipo de movimiento que se siente correcto para ti.' }, tags: ['travel', 'pace', 'personality'], difficulty: 'medium' },
  { id: 'night-out', categorySlug: 'personality', title: { en: 'What Kind of Night-Out Energy Are You?', es: 'Que tipo de energia de noche fuera eres?' }, description: { en: 'How you move through the city once the day loosens up.', es: 'Como te mueves por la ciudad cuando el dia se afloja.' }, tags: ['nightlife', 'social', 'energy'], difficulty: 'medium' },
  { id: 'study-energy', categorySlug: 'lifestyle', title: { en: 'What Is Your Study Energy?', es: 'Cual es tu energia de estudio?' }, description: { en: 'Focus style, pressure response and the way your brain likes to work.', es: 'Estilo de foco, respuesta a la presion y como le gusta trabajar a tu cabeza.' }, tags: ['study', 'focus', 'productivity'], difficulty: 'easy' },
  { id: 'sunday-ritual', categorySlug: 'lifestyle', title: { en: 'What Should Your Ideal Sunday Ritual Be?', es: 'Como deberia ser tu ritual ideal de domingo?' }, description: { en: 'A softer read about resets, mood and the week ahead.', es: 'Una lectura suave sobre resets, mood y la semana que viene.' }, tags: ['sunday', 'ritual', 'wellness'], difficulty: 'easy' },
  { id: 'creative-instinct', categorySlug: 'personality', title: { en: 'What Is Your Creative Instinct?', es: 'Cual es tu instinto creativo?' }, description: { en: 'About how you generate ideas, shape them and know when they are ready.', es: 'Sobre como generas ideas, las formas y sabes cuando estan listas.' }, tags: ['creative', 'ideas', 'instinct'], difficulty: 'medium' },
  { id: 'design-instinct', categorySlug: 'lifestyle', title: { en: 'What Is Your Design Instinct?', es: 'Cual es tu instinto de diseno?' }, description: { en: 'Texture, hierarchy and the way a room or screen should feel.', es: 'Textura, jerarquia y como deberia sentirse un espacio o una pantalla.' }, tags: ['design', 'taste', 'visual'], difficulty: 'medium' },
];

const triviaThemes: Array<Theme & { facts: TriviaFact[] }> = [
  { id: 'world-capitals', categorySlug: 'trivia', title: { en: 'Can You Ace These World Capitals?', es: 'Puedes acertar estas capitales del mundo?' }, description: { en: 'A fast geography round for people who swear they know the map.', es: 'Una ronda de geografia para quienes juran que conocen el mapa.' }, tags: ['geography', 'world', 'capitals'], difficulty: 'easy', facts: [
    { question: { en: 'What is the capital of Australia?', es: 'Cual es la capital de Australia?' }, options: [{ en: 'Canberra', es: 'Canberra' }, { en: 'Sydney', es: 'Sidney' }, { en: 'Melbourne', es: 'Melbourne' }, { en: 'Perth', es: 'Perth' }], correct: 0, explanation: { en: 'Canberra was chosen between Sydney and Melbourne.', es: 'Canberra fue elegida entre Sidney y Melbourne.' } },
    { question: { en: 'What is the capital of Canada?', es: 'Cual es la capital de Canada?' }, options: [{ en: 'Toronto', es: 'Toronto' }, { en: 'Ottawa', es: 'Ottawa' }, { en: 'Montreal', es: 'Montreal' }, { en: 'Vancouver', es: 'Vancouver' }], correct: 1, explanation: { en: 'Ottawa is Canada’s capital city.', es: 'Ottawa es la capital de Canada.' } },
    { question: { en: 'What is the capital of Morocco?', es: 'Cual es la capital de Marruecos?' }, options: [{ en: 'Casablanca', es: 'Casablanca' }, { en: 'Marrakesh', es: 'Marrakech' }, { en: 'Rabat', es: 'Rabat' }, { en: 'Tangier', es: 'Tanger' }], correct: 2, explanation: { en: 'Rabat is the political capital.', es: 'Rabat es la capital politica.' } },
    { question: { en: 'What is the capital of New Zealand?', es: 'Cual es la capital de Nueva Zelanda?' }, options: [{ en: 'Auckland', es: 'Auckland' }, { en: 'Christchurch', es: 'Christchurch' }, { en: 'Queenstown', es: 'Queenstown' }, { en: 'Wellington', es: 'Wellington' }], correct: 3, explanation: { en: 'Wellington is the capital, not Auckland.', es: 'Wellington es la capital, no Auckland.' } },
  ] },
  { id: 'cinema-icons', categorySlug: 'culture', title: { en: 'How Well Do You Know Iconic Movies?', es: 'Que tan bien conoces las peliculas iconicas?' }, description: { en: 'Big-screen basics for people who speak in film references.', es: 'Bases de cine grande para gente que habla en referencias de peliculas.' }, tags: ['movies', 'cinema', 'culture'], difficulty: 'medium', facts: [
    { question: { en: 'Who directed "Spirited Away"?', es: 'Quien dirigio "Spirited Away"?' }, options: [{ en: 'Makoto Shinkai', es: 'Makoto Shinkai' }, { en: 'Hayao Miyazaki', es: 'Hayao Miyazaki' }, { en: 'Mamoru Hosoda', es: 'Mamoru Hosoda' }, { en: 'Satoshi Kon', es: 'Satoshi Kon' }], correct: 1, explanation: { en: 'Hayao Miyazaki directed the film.', es: 'La dirigio Hayao Miyazaki.' } },
    { question: { en: 'Which film won Best Picture at the Oscars in 2020?', es: 'Que pelicula gano Mejor Pelicula en los Oscar de 2020?' }, options: [{ en: '1917', es: '1917' }, { en: 'Joker', es: 'Joker' }, { en: 'Parasite', es: 'Parasite' }, { en: 'Once Upon a Time in Hollywood', es: 'Once Upon a Time in Hollywood' }], correct: 2, explanation: { en: 'Parasite made Oscar history.', es: 'Parasite hizo historia en los Oscar.' } },
    { question: { en: 'What is the Corleone family business front in "The Godfather"?', es: 'Cual es la fachada del negocio de los Corleone en "The Godfather"?' }, options: [{ en: 'Hotels', es: 'Hoteles' }, { en: 'Olive oil import', es: 'Importacion de aceite de oliva' }, { en: 'Construction', es: 'Construccion' }, { en: 'Publishing', es: 'Editorial' }], correct: 1, explanation: { en: 'Their legitimate front is olive oil import.', es: 'La fachada legitima es la importacion de aceite de oliva.' } },
    { question: { en: 'Which movie opens in Kansas before shifting into a fantasy world?', es: 'Que pelicula abre en Kansas antes de pasar a un mundo fantastico?' }, options: [{ en: 'Psycho', es: 'Psycho' }, { en: 'The Wizard of Oz', es: 'The Wizard of Oz' }, { en: 'Citizen Kane', es: 'Citizen Kane' }, { en: 'Singin in the Rain', es: 'Singin in the Rain' }], correct: 1, explanation: { en: 'The Wizard of Oz starts in Kansas.', es: 'The Wizard of Oz empieza en Kansas.' } },
  ] },
  { id: 'internet-history', categorySlug: 'culture', title: { en: 'Can You Survive This Internet History Quiz?', es: 'Sobrevives este quiz de historia de internet?' }, description: { en: 'Platforms, moments and milestones everyone claims to remember.', es: 'Plataformas, momentos e hitos que todo el mundo dice recordar.' }, tags: ['internet', 'digital', 'history'], difficulty: 'medium', facts: [
    { question: { en: 'What does "www" stand for?', es: 'Que significa "www"?' }, options: [{ en: 'World Wide Web', es: 'World Wide Web' }, { en: 'Web World Wire', es: 'Web World Wire' }, { en: 'Wide Window Web', es: 'Wide Window Web' }, { en: 'World Web Window', es: 'World Web Window' }], correct: 0, explanation: { en: 'WWW means World Wide Web.', es: 'WWW significa World Wide Web.' } },
    { question: { en: 'Which company launched the original iPhone?', es: 'Que empresa lanzo el iPhone original?' }, options: [{ en: 'Apple', es: 'Apple' }, { en: 'Nokia', es: 'Nokia' }, { en: 'BlackBerry', es: 'BlackBerry' }, { en: 'Motorola', es: 'Motorola' }], correct: 0, explanation: { en: 'Apple introduced it in 2007.', es: 'Apple lo presento en 2007.' } },
    { question: { en: 'Which platform evolved from an app called Burbn?', es: 'Que plataforma evoluciono desde una app llamada Burbn?' }, options: [{ en: 'Tumblr', es: 'Tumblr' }, { en: 'Instagram', es: 'Instagram' }, { en: 'Snapchat', es: 'Snapchat' }, { en: 'Foursquare', es: 'Foursquare' }], correct: 1, explanation: { en: 'Instagram grew out of Burbn.', es: 'Instagram nacio desde Burbn.' } },
    { question: { en: 'Which browser helped normalize tabbed browsing?', es: 'Que navegador ayudo a normalizar la navegacion por pestanas?' }, options: [{ en: 'Internet Explorer', es: 'Internet Explorer' }, { en: 'Netscape', es: 'Netscape' }, { en: 'Mozilla Firefox', es: 'Mozilla Firefox' }, { en: 'Safari', es: 'Safari' }], correct: 2, explanation: { en: 'Firefox made tabs mainstream for many users.', es: 'Firefox volvio masivas las pestanas.' } },
  ] },
  { id: 'kitchen-basics', categorySlug: 'trivia', title: { en: 'Are Your Kitchen Basics Actually Strong?', es: 'De verdad tienes fuertes las bases de cocina?' }, description: { en: 'A practical food round built around things confident cooks know.', es: 'Una ronda culinaria practica sobre cosas que la gente que cocina con confianza sabe.' }, tags: ['food', 'kitchen', 'trivia'], difficulty: 'easy', facts: [
    { question: { en: 'What helps mayonnaise emulsify?', es: 'Que ayuda a emulsionar la mayonesa?' }, options: [{ en: 'Egg yolk', es: 'Yema de huevo' }, { en: 'Salt', es: 'Sal' }, { en: 'Water', es: 'Agua' }, { en: 'Butter', es: 'Mantequilla' }], correct: 0, explanation: { en: 'Egg yolk contains lecithin.', es: 'La yema contiene lecitina.' } },
    { question: { en: 'What does al dente describe?', es: 'Que describe al dente?' }, options: [{ en: 'Soup thickness', es: 'Espesor de sopa' }, { en: 'Pasta with a slight bite', es: 'Pasta con una ligera firmeza' }, { en: 'Very spicy food', es: 'Comida muy picante' }, { en: 'Fresh bread', es: 'Pan fresco' }], correct: 1, explanation: { en: 'It refers to pasta that is still slightly firm.', es: 'Se refiere a pasta aun ligeramente firme.' } },
    { question: { en: 'Which herb is the base of pesto alla genovese?', es: 'Que hierba es la base del pesto alla genovese?' }, options: [{ en: 'Parsley', es: 'Perejil' }, { en: 'Mint', es: 'Menta' }, { en: 'Basil', es: 'Albahaca' }, { en: 'Cilantro', es: 'Cilantro' }], correct: 2, explanation: { en: 'Classic pesto uses basil.', es: 'El pesto clasico usa albahaca.' } },
    { question: { en: 'What is the safest way to check chicken is cooked?', es: 'Cual es la forma mas segura de revisar que el pollo esta cocido?' }, options: [{ en: 'Color only', es: 'Solo el color' }, { en: 'Smell', es: 'El olor' }, { en: 'Texture', es: 'La textura' }, { en: 'Internal temperature', es: 'La temperatura interna' }], correct: 3, explanation: { en: 'Internal temperature is the most reliable method.', es: 'La temperatura interna es el metodo mas confiable.' } },
  ] },
  { id: 'landmarks', categorySlug: 'trivia', title: { en: 'How Many Famous Landmarks Can You Place Correctly?', es: 'Cuantos lugares famosos puedes ubicar correctamente?' }, description: { en: 'A landmarks round with enough pressure to expose lazy guesses.', es: 'Una ronda de lugares famosos con la presion suficiente para exponer respuestas flojas.' }, tags: ['travel', 'landmarks', 'world'], difficulty: 'easy', facts: [
    { question: { en: 'Machu Picchu is in which country?', es: 'En que pais esta Machu Picchu?' }, options: [{ en: 'Peru', es: 'Peru' }, { en: 'Bolivia', es: 'Bolivia' }, { en: 'Chile', es: 'Chile' }, { en: 'Ecuador', es: 'Ecuador' }], correct: 0, explanation: { en: 'Machu Picchu is in Peru.', es: 'Machu Picchu esta en Peru.' } },
    { question: { en: 'The Colosseum stands in which city?', es: 'En que ciudad se encuentra el Coliseo?' }, options: [{ en: 'Athens', es: 'Atenas' }, { en: 'Rome', es: 'Roma' }, { en: 'Florence', es: 'Florencia' }, { en: 'Naples', es: 'Napoles' }], correct: 1, explanation: { en: 'The Colosseum is in Rome.', es: 'El Coliseo esta en Roma.' } },
    { question: { en: 'The Burj Khalifa is in which city?', es: 'En que ciudad esta el Burj Khalifa?' }, options: [{ en: 'Abu Dhabi', es: 'Abu Dhabi' }, { en: 'Doha', es: 'Doha' }, { en: 'Dubai', es: 'Dubai' }, { en: 'Riyadh', es: 'Riad' }], correct: 2, explanation: { en: 'The Burj Khalifa is in Dubai.', es: 'El Burj Khalifa esta en Dubai.' } },
    { question: { en: 'Christ the Redeemer overlooks which city?', es: 'Que ciudad contempla el Cristo Redentor?' }, options: [{ en: 'Buenos Aires', es: 'Buenos Aires' }, { en: 'Lima', es: 'Lima' }, { en: 'Bogota', es: 'Bogota' }, { en: 'Rio de Janeiro', es: 'Rio de Janeiro' }], correct: 3, explanation: { en: 'It overlooks Rio de Janeiro.', es: 'Contempla Rio de Janeiro.' } },
  ] },
  { id: 'astronomy', categorySlug: 'trivia', title: { en: 'Can You Still Handle Basic Astronomy?', es: 'Aun manejas bien la astronomia basica?' }, description: { en: 'A clean-sky trivia round for people who love facts bigger than themselves.', es: 'Una ronda de trivia a cielo abierto para quienes aman hechos mas grandes que si mismos.' }, tags: ['science', 'astronomy', 'space'], difficulty: 'medium', facts: [
    { question: { en: 'Which planet is famous for its rings?', es: 'Que planeta es famoso por sus anillos?' }, options: [{ en: 'Saturn', es: 'Saturno' }, { en: 'Mars', es: 'Marte' }, { en: 'Venus', es: 'Venus' }, { en: 'Mercury', es: 'Mercurio' }], correct: 0, explanation: { en: 'Saturn is famous for its ring system.', es: 'Saturno es famoso por su sistema de anillos.' } },
    { question: { en: 'What is the name of our galaxy?', es: 'Como se llama nuestra galaxia?' }, options: [{ en: 'Andromeda', es: 'Andromeda' }, { en: 'Milky Way', es: 'Via Lactea' }, { en: 'Orion', es: 'Orion' }, { en: 'Pegasus', es: 'Pegaso' }], correct: 1, explanation: { en: 'Earth lives inside the Milky Way.', es: 'La Tierra esta dentro de la Via Lactea.' } },
    { question: { en: 'Which body generates its own light?', es: 'Que cuerpo genera su propia luz?' }, options: [{ en: 'The Moon', es: 'La Luna' }, { en: 'A comet', es: 'Un cometa' }, { en: 'A star', es: 'Una estrella' }, { en: 'An asteroid', es: 'Un asteroide' }], correct: 2, explanation: { en: 'Stars generate light through fusion.', es: 'Las estrellas generan luz mediante fusion.' } },
    { question: { en: 'What causes moon phases?', es: 'Que causa las fases lunares?' }, options: [{ en: 'Clouds', es: 'Nubes' }, { en: 'Earth shadow every week', es: 'La sombra de la Tierra cada semana' }, { en: 'The Moon spinning differently', es: 'La Luna girando distinto' }, { en: 'The lit side visible from Earth', es: 'La parte iluminada visible desde la Tierra' }], correct: 3, explanation: { en: 'Phases change based on how much of the lit side we see.', es: 'Las fases cambian segun cuanto del lado iluminado vemos.' } },
  ] },
  { id: 'football-legends', categorySlug: 'culture', title: { en: 'How Sharp Is Your Football Legends Knowledge?', es: 'Que tan afilado esta tu conocimiento de leyendas del futbol?' }, description: { en: 'A football culture round that stays global, not just nostalgic.', es: 'Una ronda de cultura futbolera global, no solo nostalgica.' }, tags: ['football', 'sports', 'culture'], difficulty: 'medium', facts: [
    { question: { en: 'Which country won the FIFA World Cup in 2010?', es: 'Que pais gano el Mundial de 2010?' }, options: [{ en: 'Germany', es: 'Alemania' }, { en: 'Brazil', es: 'Brasil' }, { en: 'Spain', es: 'Espana' }, { en: 'Argentina', es: 'Argentina' }], correct: 2, explanation: { en: 'Spain won the 2010 World Cup.', es: 'Espana gano el Mundial de 2010.' } },
    { question: { en: 'Lionel Messi spent most of his European club career at...', es: 'Lionel Messi paso la mayor parte de su carrera europea en...' }, options: [{ en: 'PSG', es: 'PSG' }, { en: 'FC Barcelona', es: 'FC Barcelona' }, { en: 'Manchester City', es: 'Manchester City' }, { en: 'Inter Miami', es: 'Inter Miami' }], correct: 1, explanation: { en: 'Messi became an icon at Barca.', es: 'Messi se volvio un icono en el Barca.' } },
    { question: { en: 'Which Brazilian legend was known as "O Rei"?', es: 'Que leyenda brasilena era conocida como "O Rei"?' }, options: [{ en: 'Ronaldo', es: 'Ronaldo' }, { en: 'Ronaldinho', es: 'Ronaldinho' }, { en: 'Pele', es: 'Pele' }, { en: 'Romario', es: 'Romario' }], correct: 2, explanation: { en: 'Pele was famously known as "The King".', es: 'Pele era famoso como "El Rey".' } },
    { question: { en: 'Which tournament crowns Europe national-team champion?', es: 'Que torneo corona al campeon de selecciones de Europa?' }, options: [{ en: 'Champions League', es: 'Champions League' }, { en: 'Copa America', es: 'Copa America' }, { en: 'Club World Cup', es: 'Mundial de Clubes' }, { en: 'UEFA European Championship', es: 'Eurocopa de la UEFA' }], correct: 3, explanation: { en: 'The UEFA European Championship is the Euros.', es: 'La UEFA European Championship es la Eurocopa.' } },
  ] },
  { id: 'pop-albums', categorySlug: 'culture', title: { en: 'How Well Do You Know Modern Pop Albums?', es: 'Que tan bien conoces los albumes pop modernos?' }, description: { en: 'The music round for people who notice eras, not just singles.', es: 'La ronda musical para quienes notan eras, no solo singles.' }, tags: ['music', 'albums', 'pop'], difficulty: 'medium', facts: [
    { question: { en: 'Who released the album "25"?', es: 'Quien lanzo el album "25"?' }, options: [{ en: 'Taylor Swift', es: 'Taylor Swift' }, { en: 'Adele', es: 'Adele' }, { en: 'Beyonce', es: 'Beyonce' }, { en: 'Lorde', es: 'Lorde' }], correct: 1, explanation: { en: 'Adele released 25 in 2015.', es: 'Adele lanzo 25 en 2015.' } },
    { question: { en: 'Which album includes "Levitating"?', es: 'Que album incluye "Levitating"?' }, options: [{ en: 'Future Nostalgia', es: 'Future Nostalgia' }, { en: '1989', es: '1989' }, { en: 'Melodrama', es: 'Melodrama' }, { en: 'Renaissance', es: 'Renaissance' }], correct: 0, explanation: { en: '"Levitating" is on Future Nostalgia.', es: '"Levitating" esta en Future Nostalgia.' } },
    { question: { en: 'Who released the visual album "Lemonade"?', es: 'Quien lanzo el album visual "Lemonade"?' }, options: [{ en: 'Rihanna', es: 'Rihanna' }, { en: 'Ariana Grande', es: 'Ariana Grande' }, { en: 'Beyonce', es: 'Beyonce' }, { en: 'SZA', es: 'SZA' }], correct: 2, explanation: { en: 'Lemonade is a Beyonce album.', es: 'Lemonade es un album de Beyonce.' } },
    { question: { en: 'Who is behind the album "Melodrama"?', es: 'Quien esta detras del album "Melodrama"?' }, options: [{ en: 'Olivia Rodrigo', es: 'Olivia Rodrigo' }, { en: 'Charli xcx', es: 'Charli xcx' }, { en: 'Billie Eilish', es: 'Billie Eilish' }, { en: 'Lorde', es: 'Lorde' }], correct: 3, explanation: { en: 'Melodrama is Lorde second album.', es: 'Melodrama es el segundo album de Lorde.' } },
  ] },
  { id: 'classic-books', categorySlug: 'culture', title: { en: 'Can You Place These Classic Books Correctly?', es: 'Puedes ubicar correctamente estos libros clasicos?' }, description: { en: 'A literature round for people who like their references earned.', es: 'Una ronda literaria para quienes prefieren referencias ganadas.' }, tags: ['books', 'literature', 'culture'], difficulty: 'medium', facts: [
    { question: { en: 'Who wrote "Pride and Prejudice"?', es: 'Quien escribio "Pride and Prejudice"?' }, options: [{ en: 'Jane Austen', es: 'Jane Austen' }, { en: 'Charlotte Bronte', es: 'Charlotte Bronte' }, { en: 'Emily Dickinson', es: 'Emily Dickinson' }, { en: 'Virginia Woolf', es: 'Virginia Woolf' }], correct: 0, explanation: { en: 'It was written by Jane Austen.', es: 'La escribio Jane Austen.' } },
    { question: { en: 'Which novel opens with "Call me Ishmael"?', es: 'Que novela abre con "Call me Ishmael"?' }, options: [{ en: 'Moby-Dick', es: 'Moby-Dick' }, { en: 'The Great Gatsby', es: 'The Great Gatsby' }, { en: 'Ulysses', es: 'Ulysses' }, { en: 'Dracula', es: 'Dracula' }], correct: 0, explanation: { en: 'That famous line opens Moby-Dick.', es: 'Esa linea famosa abre Moby-Dick.' } },
    { question: { en: 'Who created Sherlock Holmes?', es: 'Quien creo a Sherlock Holmes?' }, options: [{ en: 'Agatha Christie', es: 'Agatha Christie' }, { en: 'Arthur Conan Doyle', es: 'Arthur Conan Doyle' }, { en: 'Charles Dickens', es: 'Charles Dickens' }, { en: 'George Orwell', es: 'George Orwell' }], correct: 1, explanation: { en: 'Arthur Conan Doyle created Sherlock Holmes.', es: 'Arthur Conan Doyle creo a Sherlock Holmes.' } },
    { question: { en: 'In which country is "Don Quixote" rooted?', es: 'En que pais esta arraigado "Don Quixote"?' }, options: [{ en: 'Italy', es: 'Italia' }, { en: 'France', es: 'Francia' }, { en: 'Portugal', es: 'Portugal' }, { en: 'Spain', es: 'Espana' }], correct: 3, explanation: { en: 'Don Quixote is a foundational Spanish novel.', es: 'Don Quixote es una novela fundacional espanola.' } },
  ] },
  { id: 'world-desserts', categorySlug: 'culture', title: { en: 'Do You Actually Know These Famous Desserts?', es: 'De verdad conoces estos postres famosos?' }, description: { en: 'A sweet round with enough specificity to expose fake confidence.', es: 'Una ronda dulce con suficiente especificidad para exponer falsa confianza.' }, tags: ['desserts', 'food', 'culture'], difficulty: 'easy', facts: [
    { question: { en: 'Tiramisu originated in which country?', es: 'En que pais se origino el tiramisu?' }, options: [{ en: 'Italy', es: 'Italia' }, { en: 'France', es: 'Francia' }, { en: 'Austria', es: 'Austria' }, { en: 'Spain', es: 'Espana' }], correct: 0, explanation: { en: 'Tiramisu is an Italian dessert.', es: 'El tiramisu es un postre italiano.' } },
    { question: { en: 'Baklava is strongly associated with which region?', es: 'Con que region se asocia fuertemente el baklava?' }, options: [{ en: 'Northern Europe', es: 'Norte de Europa' }, { en: 'Eastern Mediterranean and Middle East', es: 'Mediterraneo oriental y Medio Oriente' }, { en: 'South America', es: 'Sudamerica' }, { en: 'Southern Africa', es: 'Africa austral' }], correct: 1, explanation: { en: 'Baklava is tied to the Eastern Mediterranean and Middle East.', es: 'El baklava se asocia al Mediterraneo oriental y Medio Oriente.' } },
    { question: { en: 'What is the main flavoring in classic creme brulee?', es: 'Cual es el sabor principal de la creme brulee clasica?' }, options: [{ en: 'Hazelnut', es: 'Avellana' }, { en: 'Chocolate', es: 'Chocolate' }, { en: 'Vanilla', es: 'Vainilla' }, { en: 'Orange', es: 'Naranja' }], correct: 2, explanation: { en: 'Classic creme brulee is usually vanilla.', es: 'La creme brulee clasica suele ser de vainilla.' } },
    { question: { en: 'Which pastry is especially associated with Portugal?', es: 'Que pastelito se asocia especialmente con Portugal?' }, options: [{ en: 'Cannoli', es: 'Cannoli' }, { en: 'Cheesecake', es: 'Cheesecake' }, { en: 'Mochi', es: 'Mochi' }, { en: 'Pastel de nata', es: 'Pastel de nata' }], correct: 3, explanation: { en: 'Pastel de nata is one of Portugal signature pastries.', es: 'El pastel de nata es uno de los grandes iconos dulces de Portugal.' } },
  ] },
  { id: 'startup-culture', categorySlug: 'culture', title: { en: 'Can You Read Startup Culture Clearly?', es: 'Puedes leer con claridad la cultura startup?' }, description: { en: 'Terms, myths and the language of tech ambition.', es: 'Terminos, mitos y el lenguaje de la ambicion tech.' }, tags: ['tech', 'business', 'startups'], difficulty: 'hard', facts: [
    { question: { en: 'A company described as "bootstrapped" usually...', es: 'Una empresa descrita como "bootstrapped" normalmente...' }, options: [{ en: 'Raised huge venture funding', es: 'Levanto capital enorme' }, { en: 'Grew mainly through its own revenue', es: 'Crecio principalmente con ingresos propios' }, { en: 'Was acquired early', es: 'Fue adquirida temprano' }, { en: 'Only sells enterprise software', es: 'Solo vende software enterprise' }], correct: 1, explanation: { en: 'Bootstrapped companies usually grow with their own revenue.', es: 'Las empresas bootstrapped suelen crecer con ingresos propios.' } },
    { question: { en: 'What does MVP usually mean in product work?', es: 'Que suele significar MVP en producto?' }, options: [{ en: 'Most Valuable Partner', es: 'Most Valuable Partner' }, { en: 'Minimum Viable Product', es: 'Producto Minimo Viable' }, { en: 'Maximum Value Plan', es: 'Maximum Value Plan' }, { en: 'Managed Venture Portfolio', es: 'Managed Venture Portfolio' }], correct: 1, explanation: { en: 'MVP stands for Minimum Viable Product.', es: 'MVP significa Producto Minimo Viable.' } },
    { question: { en: 'A pivot usually means a startup has...', es: 'Un pivot normalmente significa que una startup...' }, options: [{ en: 'Changed strategic direction', es: 'Cambio de direccion estrategica' }, { en: 'Stopped hiring', es: 'Dejo de contratar' }, { en: 'Gone public', es: 'Salio a bolsa' }, { en: 'Moved countries', es: 'Se cambio de pais' }], correct: 0, explanation: { en: 'A pivot is a meaningful strategic shift.', es: 'Un pivot es un cambio estrategico importante.' } },
    { question: { en: 'Which metric reflects how quickly customers stop paying?', es: 'Que metrica refleja que tan rapido los clientes dejan de pagar?' }, options: [{ en: 'CAC', es: 'CAC' }, { en: 'GMV', es: 'GMV' }, { en: 'ARR', es: 'ARR' }, { en: 'Churn', es: 'Churn' }], correct: 3, explanation: { en: 'Churn measures customer or revenue loss over time.', es: 'Churn mide perdida de clientes o ingresos en el tiempo.' } },
  ] },
  { id: 'world-languages', categorySlug: 'trivia', title: { en: 'Can You Match These Global Languages to Their Places?', es: 'Puedes conectar estos idiomas globales con sus lugares?' }, description: { en: 'A language-and-place round for people who notice how culture travels.', es: 'Una ronda de idioma y lugar para quienes notan como viaja la cultura.' }, tags: ['languages', 'world', 'culture'], difficulty: 'medium', facts: [
    { question: { en: 'Which language is primarily spoken in Brazil?', es: 'Que idioma se habla principalmente en Brasil?' }, options: [{ en: 'Spanish', es: 'Espanol' }, { en: 'Portuguese', es: 'Portugues' }, { en: 'French', es: 'Frances' }, { en: 'Italian', es: 'Italiano' }], correct: 1, explanation: { en: 'Brazil official language is Portuguese.', es: 'El idioma oficial de Brasil es el portugues.' } },
    { question: { en: 'Which of these is an official language of Switzerland?', es: 'Cual de estos es un idioma oficial de Suiza?' }, options: [{ en: 'German', es: 'Aleman' }, { en: 'Danish', es: 'Danes' }, { en: 'Polish', es: 'Polaco' }, { en: 'Greek', es: 'Griego' }], correct: 0, explanation: { en: 'Switzerland recognizes German as one of its official languages.', es: 'Suiza reconoce el aleman como uno de sus idiomas oficiales.' } },
    { question: { en: 'What script is used for modern standard Arabic?', es: 'Que sistema de escritura usa el arabe estandar moderno?' }, options: [{ en: 'Latin', es: 'Latino' }, { en: 'Cyrillic', es: 'Cirilico' }, { en: 'Arabic', es: 'Arabe' }, { en: 'Hangul', es: 'Hangul' }], correct: 2, explanation: { en: 'Modern standard Arabic is written in Arabic script.', es: 'El arabe estandar moderno se escribe con alfabeto arabe.' } },
    { question: { en: 'The word "arigato" belongs to which language?', es: 'La palabra "arigato" pertenece a que idioma?' }, options: [{ en: 'Korean', es: 'Coreano' }, { en: 'Thai', es: 'Tailandes' }, { en: 'Mandarin', es: 'Mandarin' }, { en: 'Japanese', es: 'Japones' }], correct: 3, explanation: { en: '"Arigato" is Japanese for "thank you".', es: '"Arigato" significa "gracias" en japones.' } },
  ] },
  { id: 'streaming-era', categorySlug: 'culture', title: { en: 'How Well Did You Track the Streaming Era?', es: 'Que tan bien seguiste la era del streaming?' }, description: { en: 'A modern media round for people who remember when everything shifted.', es: 'Una ronda de medios modernos para quienes recuerdan cuando todo cambio.' }, tags: ['streaming', 'media', 'tv'], difficulty: 'medium', facts: [
    { question: { en: 'Which platform helped popularize binge-release seasons?', es: 'Que plataforma ayudo a popularizar temporadas lanzadas de una vez?' }, options: [{ en: 'Netflix', es: 'Netflix' }, { en: 'Hulu', es: 'Hulu' }, { en: 'Disney+', es: 'Disney+' }, { en: 'Max', es: 'Max' }], correct: 0, explanation: { en: 'Netflix helped normalize the binge-release model.', es: 'Netflix ayudo a normalizar el modelo maraton.' } },
    { question: { en: 'Which series became a defining HBO global hit?', es: 'Que serie se volvio un hit global definitorio de HBO?' }, options: [{ en: 'Breaking Bad', es: 'Breaking Bad' }, { en: 'Game of Thrones', es: 'Game of Thrones' }, { en: 'The Bear', es: 'The Bear' }, { en: 'The Crown', es: 'The Crown' }], correct: 1, explanation: { en: 'Game of Thrones became one of HBO biggest global shows.', es: 'Game of Thrones se volvio una de las series globales mas grandes de HBO.' } },
    { question: { en: 'What does SVOD stand for?', es: 'Que significa SVOD?' }, options: [{ en: 'Seasonal Video on Demand', es: 'Seasonal Video on Demand' }, { en: 'Streaming Visual on Demand', es: 'Streaming Visual on Demand' }, { en: 'Subscription Video on Demand', es: 'Subscription Video on Demand' }, { en: 'Serialized Viewership on Devices', es: 'Serialized Viewership on Devices' }], correct: 2, explanation: { en: 'SVOD means Subscription Video on Demand.', es: 'SVOD significa Subscription Video on Demand.' } },
    { question: { en: 'Which device brand became a mainstream streaming-box name?', es: 'Que marca de dispositivos se volvio nombre mainstream de cajas de streaming?' }, options: [{ en: 'iPod', es: 'iPod' }, { en: 'PalmPilot', es: 'PalmPilot' }, { en: 'Kindle', es: 'Kindle' }, { en: 'Roku', es: 'Roku' }], correct: 3, explanation: { en: 'Roku was a major early mainstream streaming device brand.', es: 'Roku fue una gran marca temprana de dispositivos de streaming.' } },
  ] },
];

function slugify(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function questionId(quizId: string, index: number) {
  return `${quizId}-q${index + 1}`;
}

function optionId(qid: string, index: number) {
  return `${qid}-o${index + 1}`;
}

function categoryFor(slug: string) {
  return LAUNCH_CATEGORIES.find((item) => item.slug === slug) ?? LAUNCH_CATEGORIES[0];
}

function buildPersonalityQuiz(locale: 'en' | 'es', theme: Theme, index: number): Quiz {
  const id = `launch-${locale}-${theme.id}`;
  const questions = PERSONALITY_PROMPTS.map<Question>((prompt, promptIndex) => {
    const qid = questionId(id, promptIndex);
    return {
      id: qid,
      question: prompt[locale],
      time_limit_seconds: 24,
      options: PERSONALITY_OPTIONS[promptIndex].map((option, optionIndex) => ({
        id: optionId(qid, optionIndex),
        text: option[locale],
        personality_tags: [PERSONALITY_RESULTS[optionIndex].tag],
      })),
    };
  });

  const results = PERSONALITY_RESULTS.map<PersonalityResult>((result, resultIndex) => ({
    id: `${id}-r${resultIndex + 1}`,
    title: result.title[locale],
    description: result.description[locale],
    personality_tag: result.tag,
    background_theme: result.theme,
  }));

  return {
    id,
    slug: slugify(`${theme.title[locale]}-${locale}`),
    title: theme.title[locale],
    description: theme.description[locale],
    cover_image_url: null,
    quiz_type: 'personality',
    difficulty: theme.difficulty,
    language: locale,
    questions,
    results,
    tags: [...theme.tags, locale],
    estimated_minutes: 4,
    plays_count: 3000 - index * 29,
    shares_count: 260 - index * 3,
    avg_score: null,
    likes_count: 420 - index * 2,
    status: 'published',
    is_featured: index < 4,
    is_ai_generated: false,
    published_at: new Date(2026, 2, 10 - (index % 5)).toISOString(),
    created_at: new Date(2026, 2, 8 - (index % 5)).toISOString(),
    category: categoryFor(theme.categorySlug),
    creator: null,
  };
}

function buildTriviaQuiz(locale: 'en' | 'es', theme: Theme & { facts: TriviaFact[] }, index: number): Quiz {
  const id = `launch-${locale}-${theme.id}`;
  const questions = theme.facts.map<Question>((fact, factIndex) => {
    const qid = questionId(id, factIndex);
    return {
      id: qid,
      question: fact.question[locale],
      explanation: fact.explanation[locale],
      time_limit_seconds: 22,
      options: fact.options.map((option, optionIndex) => ({
        id: optionId(qid, optionIndex),
        text: option[locale],
        is_correct: optionIndex === fact.correct,
      })),
    };
  });

  return {
    id,
    slug: slugify(`${theme.title[locale]}-${locale}`),
    title: theme.title[locale],
    description: theme.description[locale],
    cover_image_url: null,
    quiz_type: 'trivia',
    difficulty: theme.difficulty,
    language: locale,
    questions,
    results: null,
    tags: [...theme.tags, locale],
    estimated_minutes: 3,
    plays_count: 3400 - index * 27,
    shares_count: 180 - index * 2,
    avg_score: 78 - (index % 8),
    likes_count: 510 - index * 3,
    status: 'published',
    is_featured: index < 4,
    is_ai_generated: false,
    published_at: new Date(2026, 2, 12 - (index % 5)).toISOString(),
    created_at: new Date(2026, 2, 11 - (index % 5)).toISOString(),
    category: categoryFor(theme.categorySlug),
    creator: null,
  };
}

export const LAUNCH_QUIZZES: Quiz[] = (['en', 'es'] as const).flatMap((locale) => [
  ...personalityThemes.map((theme, index) => buildPersonalityQuiz(locale, theme, index)),
  ...triviaThemes.map((theme, index) => buildTriviaQuiz(locale, theme, index)),
]);
