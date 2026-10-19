import type { Locale } from '@/lib/i18n/dictionaries';

export interface HubGuide {
  title: string;
  intro: string[];
  howTo: string[];
  closing: string;
}

export const HUB_GUIDES: Record<string, Record<Locale, HubGuide>> = {
  trivia: {
    es: {
      title: 'Trivia: preguntas directas, respuestas claras',
      intro: [
        'La trivia es el formato más viejo y más honesto del sitio: una pregunta, varias opciones y una sola respuesta correcta. Aquí no hay perfiles psicológicos ni lecturas de tu personalidad; hay datos, referencias y memoria. Cada ronda junta preguntas de un mismo tema —cine, música, videojuegos, anime, historia— y las ordena para que el ritmo no decaiga: las primeras entran fácil y las últimas exigen un poco más.',
        'Jugar es gratis y no pide registro: el puntaje llega al instante, con la corrección de cada pregunta para que veas dónde te equivocaste. Sirve para matar diez minutos, para discutir con amigos quién sabe más de una saga o para descubrir que llevas años repitiendo un dato que era falso. Si un tema te engancha, las categorías relacionadas llevan a rondas más específicas.',
      ],
      howTo: [
        'Elige un quiz y responde pregunta por pregunta, sin vuelta atrás.',
        'Al final recibes tu puntaje y la revisión de cada respuesta.',
        'Comparte el resultado o prueba otra ronda del mismo tema.',
      ],
      closing: 'Una respuesta correcta más siempre está a una ronda de distancia.',
    },
    en: {
      title: 'Trivia: straight questions, clean answers',
      intro: [
        'Trivia is the oldest and most honest format on the site: one question, a few options and a single correct answer. There are no personality reads here, just facts, references and memory. Each round gathers questions on one theme — film, music, gaming, anime, history — and orders them so the pace never dips: the first ones go down easy and the last few ask a little more of you.',
        'Playing is free and needs no signup: your score lands instantly, with a review of every question so you can see where you slipped. It works for killing ten minutes, for settling which friend knows the most about a franchise or for discovering you have been repeating a fact that was never true. If a theme hooks you, the related categories lead to more specific rounds.',
      ],
      howTo: [
        'Pick a quiz and answer question by question — no going back.',
        'At the end you get your score and a review of every answer.',
        'Share the result or try another round on the same theme.',
      ],
      closing: 'One more right answer is always one round away.',
    },
  },
  personality: {
    es: {
      title: 'Personalidad: tests que se leen como un espejo',
      intro: [
        'Los tests de personalidad funcionan distinto: ninguna opción es correcta o incorrecta, porque lo que se mide no es lo que sabes sino cómo eres. Cada respuesta suma hacia un tipo de resultado —un arquetipo, un personaje, una forma de querer o de trabajar— y el test lee el patrón completo, no preguntas sueltas. Por eso conviene responder con la primera opción que se te ocurre, no con la que te haría quedar mejor.',
        'El resultado llega al terminar: un nombre, una descripción corta y una lectura escrita para compartirse. Están pensados para compararse —«¿a ti cuál te salió?» es la mitad de la gracia— y para repetirse cuando cambia el humor o la compañía. Al final de la página hay categorías afines para seguir por ese camino: relaciones, estilo de vida, cultura.',
      ],
      howTo: [
        'Responde cada pregunta con tu primera opción, sin pensarla demasiado.',
        'Las respuestas suman hacia un resultado; no hay correctas ni incorrectas.',
        'Al cerrar, el test muestra tu tipo y una descripción para compartir.',
      ],
      closing: 'El único resultado malo es el que no se comparte.',
    },
    en: {
      title: 'Personality: tests that read like a mirror',
      intro: [
        'Personality tests work differently: no option is right or wrong, because what gets measured is not what you know but who you are. Every answer scores toward a type of result — an archetype, a character, a way of loving or of working — and the test reads the full pattern rather than any single question. That is why it pays to answer with the first option that comes to mind, not the one that would make you look better.',
        'The result lands the moment you finish: a name, a short description and a reading written to be shared. They are built to be compared — "which one did you get?" is half the fun — and to be retaken when your mood or your company changes. At the bottom of the page you will find kindred categories to keep going down that road: relationships, lifestyle, culture.',
      ],
      howTo: [
        "Answer each question with your first instinct — don't overthink it.",
        'Answers score toward a result; there are no right or wrong ones.',
        'When you finish, the test shows your type and a shareable reading.',
      ],
      closing: "The only bad result is the one you don't share.",
    },
  },
  'movies-tv': {
    es: {
      title: 'Cine y TV: toda una videoteca en preguntas',
      intro: [
        'Es la categoría más poblada del sitio y se nota: hay rondas de Disney —los clásicos, el Renacimiento de los 90, Pixar, villanos y canciones—, del universo DC de Batman a la Liga de la Justicia y de la Tierra Media de El Señor de los Anillos. A eso se suman los Óscar, el cine de los 80 y los 90, el terror clásico, las telenovelas como Betty la fea, el doblaje latino y series que van de Friends y Los Simpson a Breaking Bad y Game of Thrones.',
        'Las preguntas van de lo general a lo que solo recuerda un fan: adivinar la película detrás de una frase, repartos, récords de la Academia y lugares de cada historia. Muchas franquicias tienen varias rondas, así que se puede empezar por la general y bajar hasta el detalle. Cada respuesta trae su veredicto al instante y jugar no pide registro: llegas, eliges una saga y compruebas si de verdad la conoces.',
      ],
      howTo: [
        'Elige una franquicia o una época y responde la ronda completa.',
        'Cada pregunta muestra al instante si acertaste, sin frenar la partida.',
        'Al final comparte tu puntaje o reta a quien dice haberla visto toda.',
      ],
      closing: 'La discusión sobre cuál película es mejor aquí se resuelve a preguntas.',
    },
    en: {
      title: 'Movies & TV: a whole video store in questions',
      intro: [
        'This is the most crowded shelf on the site, and it shows: rounds on Disney — the classics, the 90s Renaissance, Pixar, villains and songs — the DC universe from Batman to the Justice League, and Middle-earth from The Lord of the Rings. On top of that: the Oscars, 80s and 90s film, classic horror, telenovelas like Betty la Fea, Latin American dubbing and series running from Friends and The Simpsons to Breaking Bad and Game of Thrones.',
        'Questions range from the general to what only a real fan remembers: naming the film behind a line, casts, Academy records and locations in each story. Many franchises get several rounds, so you can start broad and drill down into the details. Every answer gets an instant verdict and playing needs no signup: arrive, pick a saga and find out whether you actually know it.',
      ],
      howTo: [
        'Pick a franchise or an era and play the whole round.',
        'Each question shows instantly whether you got it right.',
        'At the end, share your score or challenge whoever claims to have seen it all.',
      ],
      closing: 'The argument over which movie is best gets settled here by answers.',
    },
  },
  'anime-manga': {
    es: {
      title: 'Anime y manga: del VHS al último estreno',
      intro: [
        'La parrilla junta generaciones: Dragon Ball, Sailor Moon, Evangelion y Fullmetal Alchemist conviven con My Hero Academia, Jujutsu Kaisen, Solo Leveling, Haikyuu, Blue Lock, Tokyo Revengers y Dandadan, además de Studio Ghibli, Death Note y Bleach. Cada serie tiene su propia ronda, con preguntas sobre arcos, personajes, técnicas y los momentos que su fandom repite hasta el cansancio.',
        'La gracia es que solo enfrentas lo que conoces: entra por tu serie y nadie te pregunta por un anime que no viste. Las rondas corren de lo evidente al detalle de temporada, y en el modo Supervivencia un solo error termina la partida, así que un puntaje perfecto en tu serie favorita es un logro que se puede presumir con pruebas.',
      ],
      howTo: [
        'Entra por tu serie: cada anime tiene rondas dedicadas a su historia.',
        'Responde con veredicto al instante; en Supervivencia, un error termina todo.',
        'Comparte tu resultado y reta al amigo que se sabe el manga de memoria.',
      ],
      closing: 'El debate de quién es el mejor protagonista aquí se gana con aciertos.',
    },
    en: {
      title: 'Anime & manga: from VHS classics to this season',
      intro: [
        'The lineup crosses generations: Dragon Ball, Sailor Moon, Evangelion and Fullmetal Alchemist sit next to My Hero Academia, Jujutsu Kaisen, Solo Leveling, Haikyuu, Blue Lock, Tokyo Revengers and Dandadan, plus Studio Ghibli, Death Note and Bleach. Every series gets its own round, with questions on arcs, characters, techniques and the moments its fandom never stops quoting.',
        'The appeal is that you only face what you know: go in through your series and nobody quizzes you on an anime you never watched. Rounds run from the obvious to per-season detail, and in Survival mode one wrong answer ends the run, so a perfect score on your favourite show is bragging you can actually back up with a shared link.',
      ],
      howTo: [
        'Go in through your series: each anime has rounds dedicated to its story.',
        'Answer with instant verdicts; in Survival, one mistake ends everything.',
        'Share your result and challenge the friend who memorised the manga.',
      ],
      closing: 'The best-protagonist debate gets won here with right answers.',
    },
  },
  gaming: {
    es: {
      title: 'Videojuegos: del arcade al mundo abierto',
      intro: [
        'Son dos bibliotecas en una: la del control y la de la mesa. En la primera están la historia de PlayStation y Xbox, sagas como GTA, Call of Duty y Sonic, la escena competitiva de League of Legends, Valorant, Counter-Strike, Fortnite y Overwatch, y la vida tranquila de Animal Crossing, Stardew Valley, Los Sims y Terraria. En la segunda, el ajedrez de los campeones, el póker y los juegos de tablero clásicos.',
        'La trivia aquí se juega con reglas de juego: el modo Contrarreloj pone un solo reloj para toda la ronda, Supervivencia corta en el primer fallo y Clásico deja ir a tu ritmo, con un 50/50 y un salto como comodines por partida. Las preguntas cubren mecánicas, lore, consolas y la historia del medio, de Pong a PlayStation.',
      ],
      howTo: [
        'Elige título, consola o época y un modo: Clásico, Contrarreloj o Supervivencia.',
        'Guarda el 50/50 y el salto para la pregunta que de verdad no dominas.',
        'Cierra la ronda perfecta y mándala como reto al grupo.',
      ],
      closing: 'Las horas invertidas frente a la pantalla por fin sirven para algo.',
    },
    en: {
      title: 'Gaming: from the arcade to the open world',
      intro: [
        'Two libraries in one: the controller shelf and the tabletop shelf. Under controllers: the history of PlayStation and Xbox, sagas like GTA, Call of Duty and Sonic, the competitive scene of League of Legends, Valorant, Counter-Strike, Fortnite and Overwatch, and the quiet life of Animal Crossing, Stardew Valley, The Sims and Terraria. Under the table: championship chess, poker and classic board games.',
        'Trivia here plays by the rules of a game: Time Attack runs one clock across the whole round, Survival stops at the first miss and Classic lets you go at your own pace, with one 50/50 and one skip as per-game power-ups. The questions cover mechanics, lore, consoles and the history of the medium, from Pong to PlayStation.',
      ],
      howTo: [
        'Pick a title, console or era, then a mode: Classic, Time Attack or Survival.',
        'Save the 50/50 and the skip for the question you really do not know.',
        'Finish a clean round and send it to the group as a challenge.',
      ],
      closing: 'All those hours in front of the screen finally count for something.',
    },
  },
  music: {
    es: {
      title: 'Música: por artista, escena y época',
      intro: [
        'El catálogo se ordena por artistas y escenas, no por décadas cerradas. Están los íconos latinos —Luis Miguel, Juan Gabriel, Selena, Shakira, Karol G, J Balvin, Peso Pluma, Rosalía—, la estantería del rock con Queen, The Beatles, The Rolling Stones, Nirvana, Metallica y Elvis, el pop de Michael Jackson, Madonna, ABBA y Coldplay, el K-pop de BTS y BLACKPINK y paradas en la música clásica y los 90.',
        'Todo se pregunta por escrito: discos, eras, giras, récords y momentos de carrera, así que se puede jugar en silencio donde sea. Como cada artista tiene su propia ronda, el terreno es fértil para la pelea de siempre —quién es más fan— y el enlace de reto de la pantalla de resultado la resuelve mostrando tu puntaje antes de que el otro juegue.',
      ],
      howTo: [
        'Elige a tu artista o tu escena y juega su ronda completa.',
        'Responde sobre discos y momentos; cada acierto se confirma al instante.',
        'Manda el enlace de reto a quien dice saber más que tú.',
      ],
      closing: 'Ser el mayor fan ya no se declara: se demuestra.',
    },
    en: {
      title: 'Music: by artist, scene and era',
      intro: [
        'The catalogue is organised by artists and scenes rather than closed decades. There are Latin icons — Luis Miguel, Juan Gabriel, Selena, Shakira, Karol G, J Balvin, Peso Pluma, Rosalía — a rock shelf with Queen, The Beatles, The Rolling Stones, Nirvana, Metallica and Elvis, the pop of Michael Jackson, Madonna, ABBA and Coldplay, K-pop with BTS and BLACKPINK, and stops at classical music and the 90s.',
        'Everything is asked in writing: albums, eras, tours, records and career moments, so you can play silently anywhere. Since each artist has their own round, this is fertile ground for the usual fight over who is the bigger fan, and the challenge link on the result screen settles it by showing your score before the other person plays.',
      ],
      howTo: [
        'Choose your artist or your scene and play its full round.',
        'Answer about albums and milestones; each hit is confirmed instantly.',
        'Send the challenge link to whoever claims to know more than you.',
      ],
      closing: 'Being the biggest fan is no longer declared: it is proven.',
    },
  },
  lifestyle: {
    es: {
      title: 'Estilo de vida: del horóscopo al fin de semana ideal',
      intro: [
        'La sección tiene dos mitades. Una es astrológica y corre como trivia seria: los doce signos con sus fechas y símbolos, los elementos y planetas regentes, los mitos griegos detrás de las constelaciones, el zodíaco chino y hasta una ronda que separa astronomía de astrología. La otra mira la vida diaria: qué animal eres, qué carrera te va, cómo viajas, tu estilo de trabajo, tu fin de semana ideal y tu versión fitness.',
        'En la mitad de los tests no hay respuestas incorrectas: cada opción empuja hacia un perfil y el más repetido se vuelve tu resultado, escrito para compararse en el grupo. La trivia de signos sí exige memoria, así que conviene tener claro de qué lado estás jugando antes de presumir. Ambas mitades se juegan como invitado y duran unos minutos.',
      ],
      howTo: [
        'Decide si quieres trivia de zodíaco o un test sobre tus hábitos.',
        'En los tests responde con lo primero que se te ocurra: no hay errores.',
        'Compara tu perfil con el del grupo o repite con otras respuestas.',
      ],
      closing: 'Tu signo no define tu puntaje, pero ayuda a presumirlo.',
    },
    en: {
      title: 'Lifestyle: from the horoscope to the ideal weekend',
      intro: [
        'The section has two halves. One is astrological and runs as straight trivia: the twelve signs with their dates and symbols, the elements and ruling planets, the Greek myths behind the constellations, the Chinese zodiac, and even a round that separates astronomy from astrology. The other looks at daily life: which animal you are, which career fits you, how you travel, your work style, your ideal weekend and your fitness self.',
        'In the test half there are no wrong answers: every option pushes toward a profile and the most repeated one becomes your result, written to be compared in the group chat. The zodiac trivia does demand memory, so be clear about which side you are playing before bragging. Both halves run as a guest and take a few minutes.',
      ],
      howTo: [
        'Decide between zodiac trivia or a test about your habits.',
        'On the tests, answer with your first instinct: there are no mistakes.',
        'Compare your profile with the group or replay with different answers.',
      ],
      closing: 'Your sign does not decide your score, but it helps when bragging.',
    },
  },
  sports: {
    es: {
      title: 'Deportes: récords, rivalidades y leyendas',
      intro: [
        'El tenis domina la sección —Grand Slams, superficies, la rivalidad de Federer y Nadal, Djokovic y Serena Williams—, pero le hacen compañía las tres caras del debate futbolero sin fin (Messi, Cristiano, Maradona), las dinastías de la NBA, los Juegos Olímpicos, la Fórmula 1, el boxeo, la UFC, las artes marciales y hasta el ajedrez. También hay rondas de récords, de Bolt a Beamon, y de las mujeres que cambiaron el deporte.',
        'Es la categoría donde las discusiones de sobremesa se saldan con hechos: fechas, marcas, marcadores y momentos que todo el mundo cree recordar. La corrección llega de inmediato tras cada respuesta, así que el puntaje final queda claro y se puede compartir como prueba. Sirve de maravilla para decidir quién de la mesa de verdad vio esos partidos.',
      ],
      howTo: [
        'Elige tu deporte o tu leyenda y completa la ronda.',
        'Responde sobre marcas, fechas y momentos con veredicto inmediato.',
        'Publica tu puntaje para cerrar la discusión pendiente.',
      ],
      closing: 'Los argumentos deportivos eternos aquí tienen respuesta oficial.',
    },
    en: {
      title: 'Sports: records, rivalries and legends',
      intro: [
        'Tennis dominates the section — Grand Slams, surfaces, the Federer and Nadal rivalry, Djokovic and Serena Williams — but it shares space with the three faces of the never-ending football debate (Messi, Cristiano, Maradona), NBA dynasties, the Olympic Games, Formula 1, boxing, the UFC, martial arts and even chess. There are also rounds on records, from Bolt to Beamon, and on the women who changed sport.',
        'This is the category where table arguments get settled with facts: dates, marks, scorelines and moments everyone swears they remember. The verdict arrives right after each answer, so the final score is unambiguous and can be shared as evidence. It works wonders for deciding who at the table actually watched those games.',
      ],
      howTo: [
        'Pick your sport or your legend and finish the round.',
        'Answer on marks, dates and moments with an immediate verdict.',
        'Post your score to close the pending argument.',
      ],
      closing: 'The never-ending sports arguments get an official answer here.',
    },
  },
  culture: {
    es: {
      title: 'Cultura: museos, mitos y cultura general',
      intro: [
        'Es la sección de la curiosidad amplia: cultura general de la que todos deberían saber, los grandes pintores —Van Gogh, Da Vinci, Picasso, Dalí— junto a sus museos y sus obras, la mitología nórdica con sus dioses y sus mundos, y tradiciones como Halloween y el Día de Muertos explicadas en preguntas. La completan tests sobre cómo piensas: tu tipo de inteligencia, tu edad mental y tu forma de aprender.',
        'Al mezclar arte, mitos y costumbres, sirve igual para el jugador casual que para el que quiere aprender: el modo Práctica muestra la explicación tras cada respuesta cuando la pregunta la trae, así que incluso fallar deja algo. Cerrar una ronda aquí suele terminar en un «no sabía eso» compartido en el chat.',
      ],
      howTo: [
        'Elige un tema —arte, mitos, tradiciones o cultura general— y juega.',
        'En modo Práctica, lee la explicación que sigue a cada respuesta.',
        'Termina con tu puntaje y comparte el dato que no conocías.',
      ],
      closing: 'La mejor excusa para aprender algo nuevo es poder competir con ello.',
    },
    en: {
      title: 'Culture: museums, myths and general knowledge',
      intro: [
        'This is the broad-curiosity section: the general knowledge everyone is supposed to have, the great painters — Van Gogh, Da Vinci, Picasso, Dalí — alongside their museums and works, Norse mythology with its gods and worlds, and traditions like Halloween and Día de Muertos explained through questions. Tests about how you think complete the mix: your intelligence type, your mental age and your learning style.',
        'Mixing art, myths and customs serves the casual player and the one who wants to learn alike: Practice mode shows the explanation after each answer when the question includes one, so even a miss leaves you something. Finishing a round here usually ends with a shared "I did not know that" in the group chat.',
      ],
      howTo: [
        'Pick a topic — art, myths, traditions or general knowledge — and play.',
        'In Practice mode, read the explanation that follows each answer.',
        'Finish with your score and share the fact you did not know.',
      ],
      closing: 'The best excuse to learn something new is being able to compete with it.',
    },
  },
  technology: {
    es: {
      title: 'Tecnología: cómo funciona lo que usas todos los días',
      intro: [
        'La sección va de lo invisible a lo de bolsillo: cómo funciona internet por dentro —DNS, IP, wifi—, la inteligencia artificial de Turing a los transformers, la robótica de Unimate a los rovers de Marte y la ciberseguridad entre phishing y contraseñas. Del lado de la historia están el smartphone del IBM Simon al iPhone, los gadgets que lo cambiaron todo del Walkman al Kindle, las redes sociales y los hitos de la informática.',
        'También hay terreno práctico —lenguajes de programación, atajos de Excel, las bases de Bitcoin y blockchain— y rondas sobre motores: autos clásicos, eléctricos, marcas y motos. No hace falta ser ingeniero: las preguntas premian la curiosidad del usuario cotidiano, y en modo Práctica cada respuesta puede venir con su explicación.',
      ],
      howTo: [
        'Elige un terreno: internet, IA, gadgets, programación o motores.',
        'Responde y usa el modo Práctica para leer el porqué de cada acierto.',
        'Compara tu puntaje con quien asegura entender la tecnología.',
      ],
      closing: 'Usar la tecnología es fácil; entenderla se comprueba aquí.',
    },
    en: {
      title: 'Technology: how the things you use every day work',
      intro: [
        'The section runs from the invisible to the pocket-sized: how the internet works inside — DNS, IP, Wi-Fi — artificial intelligence from Turing to transformers, robotics from Unimate to the Mars rovers and cybersecurity through phishing and passwords. On the history side: the smartphone from the IBM Simon to the iPhone, the gadgets that changed everything from the Walkman to the Kindle, social media and the milestones of computing.',
        'There is practical ground too — programming languages, Excel shortcuts, the basics of Bitcoin and blockchain — and rounds on engines: classic cars, electric cars, brands and motorcycles. No engineering degree needed: the questions reward everyday curiosity, and in Practice mode each answer can come with its explanation.',
      ],
      howTo: [
        'Pick a field: internet, AI, gadgets, programming or engines.',
        'Answer and use Practice mode to read the why behind each one.',
        'Compare your score with whoever claims to understand tech.',
      ],
      closing: 'Using technology is easy; understanding it gets tested here.',
    },
  },
};

export const RELATED_HEADING: Record<Locale, string> = {
  es: 'Sigue explorando',
  en: 'Keep exploring',
};

export const RELATED_CATEGORIES: Record<string, string[]> = {
  trivia: ['movies-tv', 'anime-manga', 'gaming'],
  personality: ['relationships', 'lifestyle', 'culture'],
  'movies-tv': ['anime-manga', 'pop-culture', 'music'],
  'anime-manga': ['movies-tv', 'gaming', 'pop-culture'],
  gaming: ['anime-manga', 'technology', 'movies-tv'],
  music: ['movies-tv', 'pop-culture', 'culture'],
  lifestyle: ['relationships', 'food-drink', 'culture'],
  culture: ['literature', 'pop-culture', 'movies-tv'],
  literature: ['culture', 'history', 'movies-tv'],
  'pop-culture': ['movies-tv', 'music', 'anime-manga'],
  technology: ['gaming', 'science', 'pop-culture'],
  relationships: ['lifestyle', 'culture', 'literature'],
  'food-drink': ['lifestyle', 'geography', 'culture'],
  science: ['technology', 'history', 'geography'],
  animals: ['science', 'geography', 'lifestyle'],
  sports: ['gaming', 'geography', 'history'],
  geography: ['history', 'science', 'culture'],
  history: ['geography', 'literature', 'culture'],
};

export function getHubGuide(slug: string, locale: Locale): HubGuide | null {
  return HUB_GUIDES[slug]?.[locale] ?? null;
}

export function getRelatedCategories(slug: string, availableSlugs: string[]): string[] {
  const available = new Set(availableSlugs);
  return (RELATED_CATEGORIES[slug] ?? [])
    .filter((related) => related !== slug && available.has(related))
    .slice(0, 3);
}
