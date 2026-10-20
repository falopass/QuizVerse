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
  literature: {
    es: {
      title: 'Literatura: entre libros y lectores',
      intro: [
        'Es el rincón de los libros: el espacio donde se mide lo que quedó de las lecturas —obras, autores, géneros y los mundos que solo existen en papel— y donde los tests leen al lector del otro lado de la página. Project Hail Mary ya tiene presencia en el catálogo con dos tests: qué rol jugarías dentro de la novela y qué energía suya combina mejor contigo. La literatura del sitio se recorre así: por lo que leíste y por lo que eres leyendo.',
        'En los tests no hay errores posibles: cada respuesta empuja hacia un perfil y el patrón completo se vuelve el resultado, escrito para compararse. Todo se juega gratis, como invitado y en pocos minutos, con el enlace del resultado listo para mandarse como reto al que presume de haber leído más.',
      ],
      howTo: [
        'Entra por la lectura que te interese de la lista.',
        'Responde con tu primera opción; en los tests no hay errores.',
        'Comparte el perfil y reta al lector del grupo.',
      ],
      closing: 'El que presume de biblioteca aquí la pone a prueba.',
    },
    en: {
      title: 'Literature: between books and readers',
      intro: [
        'This is the corner for books: the place that measures what stayed from your reading — works, authors, genres and the worlds that only exist on paper — and where tests read the reader on the other side of the page. Project Hail Mary already sits in the catalogue: how deep your knowledge of the novel goes, which role you would play inside it and which of its energies matches you best, next to a test that uncovers your true reading personality.',
        'The trivia side rewards memory with one correct answer and an instant verdict; the tests have no possible mistakes and hand back a profile written to be compared. Everything plays free, as a guest and in a few minutes, with the result link ready to send as a challenge to whoever brags about reading more.',
      ],
      howTo: [
        'Enter through the reading that calls you from the list.',
        'Play at your pace; the tests read patterns, not mistakes.',
        'Share the profile or the score with the reader of the group.',
      ],
      closing: 'Whoever boasts about their library puts it to the test here.',
    },
  },
  'pop-culture': {
    es: {
      title: 'Cultura pop: la memoria compartida',
      intro: [
        'La sección mide lo que quedó de la conversación colectiva: memes, épocas, referencias y todo lo que un grupo asume que todo el mundo vio. Lo publicado va de la nostalgia —qué era te define de verdad— a la trivia esencial de cultura de internet, pasando por qué tan profundo llega tu conocimiento de Avatar.',
        'Es territorio de actualidad y archivo a la vez: hay trivia de respuesta única con veredicto inmediato y tests que devuelven un perfil pensado para el «¿a ti cuál te salió?». Jugar no pide cuenta ni pago, así que la ronda funciona igual para probarse a uno mismo que para dirimir quién del chat estaba más metido en un tema. Y como cada fenómeno tiene su nicho, la sección va sumando rondas al ritmo de la conversación.',
      ],
      howTo: [
        'Elige una época o un fenómeno y entra a su ronda.',
        'Responde la trivia o deja que el test lea tu perfil de fan.',
        'Manda tu resultado al chat donde el tema nunca muere.',
      ],
      closing: 'El que sabe un poco de todo aquí encuentra su ronda.',
    },
    en: {
      title: 'Pop culture: the shared memory',
      intro: [
        'The section measures what stayed from the collective conversation: memes, eras, references and everything a group assumes everybody saw. The published side runs from the nostalgia test — which era actually defines you — to reading which social media alter ego you carry, with internet culture as the beat the whole section is built on.',
        'It is present-tense territory and archive at once: single-answer trivia with an instant verdict sits next to tests that return a profile built for the "which one did you get?" exchange. Playing needs no account and no payment, so a round works just as well for testing yourself as for settling who in the chat was deepest into a topic. The section keeps adding rounds at the pace of that conversation.',
      ],
      howTo: [
        'Pick an era or a phenomenon and enter its round.',
        'Answer the trivia or let the test read your fan profile.',
        'Send your result to the chat where the topic never dies.',
      ],
      closing: 'The friend who knows a bit of everything finds their round here.',
    },
  },
  relationships: {
    es: {
      title: 'Relaciones: tests sobre cómo te vinculas',
      intro: [
        'La sección más personal del sitio: tests que leen cómo te vinculas —con amigos, con parejas, con la gente que comparte tu mesa— donde ninguna opción es correcta ni incorrecta. Entre lo publicado están qué arquetipo de amigo eres en tu grupo y qué energía de app de citas estás trayendo.',
        'El test lee el patrón completo de tus respuestas y devuelve un perfil escrito para compararse: responder lo primero que se te ocurre da un resultado más parecido a ti que cualquier estrategia. Se completa como invitado, en minutos y gratis, y el enlace del resultado está hecho justamente para mandarlo a quien quieres que se mida después. Y como la forma de vincularse cambia según el vínculo, la sección va sumando tests para cada lado de la vida afectiva.',
      ],
      howTo: [
        'Elige el vínculo que quieres mirar: amigos, citas o costumbres.',
        'Responde con tu primera opción; aquí no hay errores posibles.',
        'Compara tu perfil con el de la otra persona: ahí empieza la charla.',
      ],
      closing: 'Conocerse es un deporte de equipo; estos tests son la cancha.',
    },
    en: {
      title: 'Relationships: tests on how you bond',
      intro: [
        'The most personal section on the site: tests that read how you bond — with friends, with partners, with the people at your table — where no option is right or wrong. Among the published ones are which friend archetype you are in your group, what dating-app energy you are bringing and what your relationship with technology looks like.',
        'Each test reads the full pattern of your answers and returns a profile written to be compared: answering with your first instinct gives a result closer to you than any strategy. It plays as a guest, in minutes and for free, and the result link exists precisely to send to whoever you want measured next. New tests keep joining the section, one for each kind of bond worth measuring.',
      ],
      howTo: [
        'Pick the bond you want to look at: friends, dating or habits.',
        'Answer with your first option; there are no possible mistakes here.',
        "Compare your profile with the other person's: that is where the talk starts.",
      ],
      closing: 'Knowing each other is a team sport; these tests are the field.',
    },
  },
  'food-drink': {
    es: {
      title: 'Comida y bebida: el territorio del paladar',
      intro: [
        'La sección del paladar: el espacio donde se junta todo lo que se come y se bebe —cocinas, bebidas, orígenes y costumbres de la mesa— medido en preguntas de una sola respuesta correcta. La trivia de comida alrededor del mundo ya está publicada y recorre platos e ingredientes de varios países.',
        'Toda la trivia se contesta por escrito y trae veredicto al instante, así que la ronda funciona igual en la sobremesa que en la fila del almuerzo; solo procura no jugar con hambre. Es gratis, no pide registro y el resultado se comparte con un enlace que muestra tu puntaje antes de que el otro empiece. Como toda sección del sitio, ésta va sumando rondas por tema: la página es la puerta de entrada a lo que el paladar vaya agregando.',
      ],
      howTo: [
        'Entra a la ronda de comida alrededor del mundo.',
        'Responde plato por plato; el veredicto llega al instante.',
        'Compara el puntaje en la próxima sobremesa.',
      ],
      closing: 'Aquí el gusto se mide en aciertos, no en opiniones.',
    },
    en: {
      title: 'Food & drink: the territory of the palate',
      intro: [
        'The palate section: the place where everything eaten and drunk comes together — cuisines, beverages, origins and table customs — measured in single-answer questions and in tests that read your flavour. Already published: the food-around-the-world trivia and the test revealing what your coffee order says about you.',
        'All the trivia is answered in writing with an instant verdict, so a round works as well at the table as in the lunch line; just try not to play hungry. It is free, needs no signup and the result is shared through a link that shows your score before the other person begins. Like every section on the site, this one keeps adding themed rounds: the page is the front door to whatever the palate brings next.',
      ],
      howTo: [
        'Enter the food-around-the-world round or the coffee test.',
        'Answer dish by dish; the verdict lands instantly.',
        'Compare the score at the next meal.',
      ],
      closing: 'Here taste is measured in right answers, not opinions.',
    },
  },
  science: {
    es: {
      title: 'Ciencia: del laboratorio a la órbita',
      intro: [
        'La sección del laboratorio: el espacio dedicado a medir cuánto sabes del cuerpo, la materia, el cosmos y los inventos que lo cambiaron todo. La ronda de exploración espacial 2020-2026 ya está en el catálogo, con las misiones y los hitos que la década dejó en órbita. Es terreno de dato duro, así que cada respuesta se juega a una sola correcta.',
        'La ciencia aquí se juega como en el resto del sitio: trivia de una sola respuesta correcta, veredicto inmediato tras cada pregunta y explicación en modo Práctica cuando la pregunta la incluye. Gratis, como invitado y con resultado compartible: ideal para el amigo que asegura saber de ciencia y nunca lo ha puesto a prueba. La sección va sumando rondas por tema, igual que el resto del catálogo.',
      ],
      howTo: [
        'Entra a la ronda del tema que domines —o quieras aprender.',
        'En Práctica, cada explicación convierte el error en un dato nuevo.',
        'Comparte el puntaje y cierra la apuesta científica pendiente.',
      ],
      closing: 'La curiosidad no necesita laboratorio: necesita una ronda.',
    },
    en: {
      title: 'Science: from the lab to orbit',
      intro: [
        'The lab section: the place dedicated to measuring how much you know about the body, matter, the cosmos and the inventions that changed everything. The space-exploration 2020–2026 round is already in the catalogue, with the missions and milestones the decade left in orbit, alongside a test on how you cope with climate anxiety. It is hard-fact ground, so every question plays to a single correct answer.',
        'Science plays here like everywhere else on the site: single-answer trivia with an immediate verdict — and an explanation in Practice mode when the question carries one — free and without signup. Ideal for the friend who insists they know science and never put it to the test. The section keeps adding themed rounds, like the rest of the catalogue.',
      ],
      howTo: [
        'Enter the round on the topic you master — or want to learn.',
        'In Practice mode, every explanation turns a miss into a new fact.',
        'Share the score and close the pending science bet.',
      ],
      closing: 'Curiosity needs no lab coat: it needs a round.',
    },
  },
  animals: {
    es: {
      title: 'Animales: el mundo salvaje y el de casa',
      intro: [
        'La esquina del reino animal: la sección dedicada a las especies, su comportamiento, sus récords y la relación que llevamos con ellas —del lado salvaje al sofá de casa. Su primer habitante es un test que lee qué clase de dueño de mascota eres, disponible en español e inglés, y funciona como la puerta de entrada a una sección que crece por tema igual que el resto del catálogo.',
        'En los tests no hay respuestas incorrectas: cada opción empuja hacia un perfil y el patrón completo de tus respuestas se vuelve el resultado, escrito para compararse en el grupo. Se juega gratis, como invitado y en pocos minutos; el enlace del resultado muestra tu perfil antes de que la otra persona empiece, así que medirse con otros dueños sale solo.',
      ],
      howTo: [
        'Entra al test de qué clase de dueño de mascota eres.',
        'Responde con tu primera opción; no hay errores posibles.',
        'Comparte tu perfil y compara con los dueños del grupo.',
      ],
      closing: 'La cadena alimentaria también tiene tabla de posiciones.',
    },
    en: {
      title: 'Animals: the wild world and the one at home',
      intro: [
        'The animal kingdom corner: the section dedicated to species, their behaviour, their records and the relationship we keep with them — from the wild side to the sofa at home. Its first resident is a test that reads what kind of pet owner you are, available in English and Spanish, and it works as the front door to a section that grows by theme like the rest of the catalogue.',
        'In the tests there are no wrong answers: every option pushes toward a profile and the full pattern of your answers becomes the result, written to be compared in the group. It plays free, as a guest and in a few minutes; the result link shows your profile before the other person starts, so measuring yourself against other owners takes no effort.',
      ],
      howTo: [
        'Start with the what-kind-of-pet-owner test.',
        'Answer with your first option; mistakes are impossible.',
        'Share your profile and compare with the owners in the group.',
      ],
      closing: 'The food chain has a leaderboard too.',
    },
  },
  geography: {
    es: {
      title: 'Geografía: capitales, océanos y extremos',
      intro: [
        'La sección del mapa: el territorio de países, capitales, océanos y los extremos del planeta, medido en preguntas de una sola respuesta correcta. Su ronda publicada es la trivia de geografía mundial —capitales, océanos y extremos—, una vuelta rápida por lo que el mapa debería dejar en la cabeza de quien lo recorre.',
        'Es trivia de memoria pura, de las que más se discuten en grupo: todo el mundo cree ubicar bien un país hasta que la octava pregunta dice otra cosa. El veredicto llega tras cada respuesta, jugar es gratis y no pide registro, y el resultado se comparte como prueba antes de que el otro intente superarlo. La sección va sumando rondas por tema igual que el resto del catálogo: el mapa castiga la confianza, y eso es lo que entretiene.',
      ],
      howTo: [
        'Entra a la ronda de geografía mundial.',
        'Responde país por país; el veredicto llega al instante.',
        'Reta al viajero del grupo a superar tu puntaje.',
      ],
      closing: 'Viajar está bien; ubicar cada país sin mapa está mejor.',
    },
    en: {
      title: 'Geography: capitals, oceans and extremes',
      intro: [
        "The map section: the territory of countries, capitals, oceans and the planet's extremes, measured in single-answer questions. Its published round is the world-geography trivia — capitals, oceans and extremes — a quick pass over what the map should leave in the head of whoever travels it.",
        'This is pure memory trivia, the kind most argued in a group: everyone believes they can place a country until question eight says otherwise. The verdict lands after each answer, playing is free with no signup, and the result is shared as proof before the other person tries to beat it. The section keeps adding themed rounds like the rest of the catalogue: the map punishes confidence, which is exactly what makes it fun.',
      ],
      howTo: [
        'Enter the world-geography round.',
        'Answer country by country; the verdict lands instantly.',
        'Challenge the traveller of the group to beat your score.',
      ],
      closing: 'Travelling is fine; placing every country without a map is better.',
    },
  },
  history: {
    es: {
      title: 'Historia: las fechas que ordenan el mundo',
      intro: [
        'La sección del pasado: el territorio de civilizaciones, batallas, imperios y fechas que ordenaron el mundo, medido en preguntas de una sola respuesta correcta. Su ronda publicada es la trivia de historia universal —ocho fechas que cambiaron todo—, un repaso directo por los giros que cualquier conversación histórica termina tocando. Fechas, nombres y lugares: la materia de la que está hecho el debate de sobremesa.',
        'Es la trivia clásica en su forma más pura: memoria, una correcta por pregunta y corrección al instante. Jugar no pide registro ni pago y el resultado se manda como enlace que muestra el puntaje antes de que el otro juegue, así que el debate de fechas queda cerrado con evidencia. Cada ronda nueva que se suma hace más completo el repaso del pasado.',
      ],
      howTo: [
        'Entra a la ronda de historia universal.',
        'Responde las ocho fechas con veredicto inmediato.',
        'Comparte tu puntaje: el debate de fechas queda cerrado.',
      ],
      closing: 'La historia no se repite, pero las preguntas sí conviene repetirlas.',
    },
    en: {
      title: 'History: the dates that ordered the world',
      intro: [
        'The past section: the territory of civilizations, battles, empires and the dates that ordered the world, measured in single-answer questions. Its published round is the world-history trivia — eight dates that changed everything — a straight run through the turns every historical conversation ends up touching. Dates, names and places: the raw material of every table argument about the past.',
        'This is classic trivia in its purest form: memory, one correct answer per question and an instant verdict. Playing needs no signup or payment and the result travels as a link showing the score before the other person plays, so the argument over dates closes with evidence. Like every section on the site, this one keeps adding themed rounds.',
      ],
      howTo: [
        'Enter the world-history round.',
        'Answer the eight dates with an immediate verdict.',
        'Share your score: the date debate ends there.',
      ],
      closing: 'History may not repeat itself, but these questions are worth retaking.',
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
