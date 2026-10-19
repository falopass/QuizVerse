import type { Locale } from '@/lib/i18n/dictionaries';

export interface CategoryFaq {
  question: string;
  answer: string;
}

export interface CategoryGuide {
  intro: [string, string];
  faq: CategoryFaq[];
}

/**
 * Editorial copy for the category hubs. Every claim here must match what the
 * product does (guest play, game modes, power-ups, result links, challenges).
 */
export const CATEGORY_GUIDES: Record<string, Record<Locale, CategoryGuide>> = {
  'movies-tv': {
    en: {
      intro: [
        'Movies & TV is the biggest shelf on QuizVerse. It follows what people are watching and arguing about right now: Marvel, Star Wars, The Bear, Squid Game and the latest streaming finales. Many shows appear twice, once as a fan trivia round and once as a personality quiz.',
        'Trivia checks plot points, characters and memorable scenes, with a verdict after every answer. Personality quizzes place you as a character or a role in the story, and the quiz page previews the possible results before you press play.',
      ],
      faq: [
        {
          question: 'Do I need to have watched the whole show to play?',
          answer:
            'For trivia, it helps: questions draw on the main plot and characters. Personality quizzes need no viewing history at all.',
        },
        {
          question: 'Can a TV trivia quiz spoil the series for me?',
          answer:
            'Trivia rounds can mention key plot events. If you are mid-season, start with the personality quiz for that show instead.',
        },
        {
          question: 'How long does a movie or TV quiz take?',
          answer:
            'Each quiz has around eight questions and takes three or four minutes in Classic mode, where there is no clock.',
        },
        {
          question: 'Can I share which character I got?',
          answer:
            'Yes. The result screen gives you a link whose preview card shows your character, so it reads well in any chat.',
        },
      ],
    },
    es: {
      intro: [
        'Cine y televisión es la sección más grande de QuizVerse. Sigue lo que la gente está viendo y comentando ahora: Marvel, Star Wars, The Boys y los últimos finales de temporada del streaming. Muchas series aparecen dos veces: como trivia para fans y como quiz de personalidad.',
        'La trivia pregunta por tramas, personajes y escenas recordadas, y te dice si acertaste después de cada respuesta. Los quizzes de personalidad te asignan un personaje o un papel en la historia, y la página del quiz adelanta los resultados posibles antes de jugar.',
      ],
      faq: [
        {
          question: '¿Tengo que haber visto toda la serie para jugar?',
          answer:
            'Para la trivia ayuda, porque las preguntas salen de la trama y los personajes. Los quizzes de personalidad no exigen haberla visto.',
        },
        {
          question: '¿Un quiz de trivia puede hacerme spoiler?',
          answer:
            'La trivia puede mencionar giros importantes. Si vas a mitad de temporada, empieza mejor por el quiz de personalidad de esa serie.',
        },
        {
          question: '¿Cuánto dura un quiz de cine o series?',
          answer:
            'Cada quiz tiene unas ocho preguntas y se juega en tres o cuatro minutos en el modo Clásico, que no tiene reloj.',
        },
        {
          question: '¿Puedo compartir qué personaje me tocó?',
          answer:
            'Sí. La pantalla de resultado te da un enlace cuya vista previa muestra tu personaje, así se entiende en cualquier chat.',
        },
      ],
    },
  },
  'anime-manga': {
    en: {
      intro: [
        'The anime and manga section is built around series with active fandoms: Attack on Titan, Jujutsu Kaisen, Solo Leveling, Witch Hat Atelier and more. Each one usually gets a knowledge test on its story and characters, plus a quiz that matches you with the energy or role of its cast.',
        'It is the second largest category on the site, and the Spanish catalogue at /es has its own anime quizzes written in Spanish. If you know a series well, Survival mode ends the run at the first wrong answer.',
      ],
      faq: [
        {
          question: 'Which anime and manga series have quizzes?',
          answer:
            'Attack on Titan, Jujutsu Kaisen, Solo Leveling and Witch Hat Atelier, among others. The grid above shows every quiz currently live.',
        },
        {
          question: 'Is there a hard mode for anime trivia?',
          answer:
            'Yes. Survival mode is available on every trivia quiz: one wrong answer ends the run, so a full score actually means something.',
        },
        {
          question: 'Are there anime quizzes in Spanish?',
          answer:
            'Yes. The /es catalogue has anime quizzes with titles, questions and results written in Spanish.',
        },
        {
          question: 'What do I get at the end of an anime personality quiz?',
          answer:
            'One of several written profiles tied to the series. The quiz page previews them before you start.',
        },
      ],
    },
    es: {
      intro: [
        'La sección de anime y manga gira en torno a series con fandoms activos: Attack on Titan, Jujutsu Kaisen, Solo Leveling, Witch Hat Atelier y otras. Cada una suele tener una prueba de conocimiento sobre su historia y sus personajes, y un quiz que te empareja con la energía o el rol de su elenco.',
        'Es la segunda categoría más grande del sitio, y todos sus quizzes en /es están escritos en español, con títulos, preguntas y resultados propios. Si dominas una serie, el modo Supervivencia termina la partida en el primer error.',
      ],
      faq: [
        {
          question: '¿Qué series de anime y manga tienen quiz?',
          answer:
            'Attack on Titan, Jujutsu Kaisen, Solo Leveling y Witch Hat Atelier, entre otras. El listado de arriba muestra todos los quizzes publicados.',
        },
        {
          question: '¿Hay un modo difícil para la trivia de anime?',
          answer:
            'Sí. El modo Supervivencia está en todas las trivias: un solo error termina la partida, así que un puntaje perfecto vale de verdad.',
        },
        {
          question: '¿Hay quizzes de anime en español?',
          answer:
            'Sí. El catálogo de /es tiene quizzes de anime con títulos, preguntas y resultados escritos en español.',
        },
        {
          question: '¿Qué obtengo al final de un quiz de personalidad de anime?',
          answer:
            'Uno de varios perfiles escritos para esa serie. La página del quiz los adelanta antes de empezar.',
        },
      ],
    },
  },
  gaming: {
    en: {
      intro: [
        'The gaming section covers the titles people sink hundreds of hours into: Minecraft, Baldur’s Gate 3, Starfield, Grand Theft Auto VI and the Mario universe, among others. Knowledge quizzes test mechanics, lore and characters; personality quizzes ask which role or playstyle fits you.',
        'Trivia here plays like a game. Pick Time Attack for a clock across the whole quiz, Survival to stop at the first mistake, or Classic to play at your own pace. You also get one 50/50 and one skip per game.',
      ],
      faq: [
        {
          question: 'Which video games have quizzes?',
          answer:
            'Minecraft, Baldur’s Gate 3, Starfield, GTA VI and Mario, among others. The grid on this page lists every gaming quiz that is live.',
        },
        {
          question: 'Is there a timed mode for gaming trivia?',
          answer:
            'Yes. Time Attack runs one clock for the whole quiz, and the +10s power-up adds ten seconds once per game.',
        },
        {
          question: 'What does the 50/50 power-up do?',
          answer:
            'On a trivia question it removes two wrong answers. You get one per game, so save it for the question you really do not know.',
        },
        {
          question: 'Do I need to install anything to play?',
          answer:
            'No. Every quiz runs in the browser on phone or desktop, and on a keyboard you can answer with the number keys.',
        },
      ],
    },
    es: {
      intro: [
        'La sección de videojuegos cubre los títulos a los que la gente les dedica cientos de horas: Minecraft, Baldur’s Gate 3, Starfield, Grand Theft Auto VI y el universo de Mario, entre otros. Las trivias ponen a prueba mecánicas, lore y personajes; los quizzes de personalidad te dicen qué rol o estilo de juego va contigo.',
        'Aquí la trivia se juega como un juego. Elige Contrarreloj para tener un reloj en todo el quiz, Supervivencia para parar en el primer error o Clásico para ir a tu ritmo. Además tienes un 50/50 y un salto por partida.',
      ],
      faq: [
        {
          question: '¿Qué videojuegos tienen quiz?',
          answer:
            'Minecraft, Baldur’s Gate 3, Starfield, GTA VI y Mario, entre otros. El listado de esta página muestra todos los quizzes de videojuegos publicados.',
        },
        {
          question: '¿Hay un modo con tiempo para la trivia de videojuegos?',
          answer:
            'Sí. Contrarreloj usa un solo reloj para todo el quiz, y el comodín +10s suma diez segundos una vez por partida.',
        },
        {
          question: '¿Qué hace el comodín 50/50?',
          answer:
            'En una pregunta de trivia elimina dos respuestas incorrectas. Tienes uno por partida: guárdalo para la que de verdad no sabes.',
        },
        {
          question: '¿Tengo que instalar algo para jugar?',
          answer:
            'No. Todos los quizzes funcionan en el navegador del celular o del computador, y con teclado puedes responder con los números.',
        },
      ],
    },
  },
  music: {
    en: {
      intro: [
        'The music section is organised by artist and scene rather than by decade. Taylor Swift, Sabrina Carpenter and K-pop each have several quizzes: fan trivia about eras, albums and career moments, and personality quizzes that match you with an era, a role or the energy of the act.',
        'There are no song clips. Every question is written, so you can play on mute on the bus. Once you finish a trivia round you can send a challenge link to the friend who claims to be the bigger fan and see who wins.',
      ],
      faq: [
        {
          question: 'Which artists have music quizzes?',
          answer:
            'Taylor Swift, Sabrina Carpenter and K-pop have the most, each with trivia and personality formats. The grid shows the full list.',
        },
        {
          question: 'Do the music quizzes play audio clips?',
          answer:
            'No. Questions are written text, so you can play anywhere without headphones and without guessing songs by ear.',
        },
        {
          question: 'What happens if I miss a question in music trivia?',
          answer:
            'In Classic mode you see the verdict and keep going. In Survival mode a single wrong answer ends the run.',
        },
        {
          question: 'Can I challenge a friend to beat my score?',
          answer:
            'Yes. Share the challenge link from your result: your friend sees your score before playing and the comparison at the end.',
        },
      ],
    },
    es: {
      intro: [
        'La sección de música está organizada por artista y escena, no por década. Taylor Swift, Sabrina Carpenter y el K-pop tienen varios quizzes cada uno: trivia para fans sobre eras, discos y momentos de su carrera, y quizzes de personalidad que te asignan una era, un rol o la energía del artista.',
        'No hay fragmentos de canciones. Todas las preguntas son de texto, así que puedes jugar en silencio en el transporte. Al terminar una trivia puedes mandar un enlace de reto a quien dice ser más fan que tú y ver quién gana.',
      ],
      faq: [
        {
          question: '¿Qué artistas tienen quizzes de música?',
          answer:
            'Taylor Swift, Sabrina Carpenter y el K-pop son los que más tienen, con trivia y personalidad. El listado muestra todos.',
        },
        {
          question: '¿Los quizzes de música tienen audio?',
          answer:
            'No. Las preguntas son de texto, así que puedes jugar sin audífonos y sin tener que adivinar canciones de oído.',
        },
        {
          question: '¿Qué pasa si fallo una pregunta en la trivia de música?',
          answer:
            'En el modo Clásico ves si acertaste y sigues jugando. En Supervivencia, un solo error termina la partida.',
        },
        {
          question: '¿Puedo retar a un amigo a superar mi puntaje?',
          answer:
            'Sí. Comparte el enlace de reto desde tu resultado: tu amigo ve tu puntaje antes de jugar y la comparación al final.',
        },
      ],
    },
  },
  lifestyle: {
    en: {
      intro: [
        'Lifestyle quizzes are about how you actually live: what kind of morning person you are, which weekend plan suits your social battery, how you travel and what your fitness personality looks like. They are personality quizzes, so there are no right answers to learn first.',
        'Each answer leans toward one of several profiles, and the profile you lean toward most becomes your result. They take three or four minutes, work well as a group game, and replaying with different choices can land you somewhere new.',
      ],
      faq: [
        {
          question: 'Are lifestyle quizzes scientific personality tests?',
          answer:
            'No. They are light quizzes made to be fun and shareable. Your result describes a style or a habit, not a psychological diagnosis.',
        },
        {
          question: 'How is my lifestyle result decided?',
          answer:
            'Each option points to a profile. The profile your answers point to most often wins, and it is calculated on the server.',
        },
        {
          question: 'Can I retake a quiz and get a different result?',
          answer:
            'Yes. Use Play again on the result screen. If you answer differently, you can land on a different profile.',
        },
        {
          question: 'Do I need an account to take these quizzes?',
          answer:
            'No. You can play as a guest. An account only adds points, streaks and a place to keep your favourite results.',
        },
      ],
    },
    es: {
      intro: [
        'Los quizzes de estilo de vida tratan de cómo vives de verdad: qué tipo de persona mañanera eres, qué plan de fin de semana encaja con tu energía social, cómo viajas y cuál es tu personalidad fitness. Son quizzes de personalidad, así que no hay respuestas correctas que estudiar antes.',
        'Cada respuesta se inclina hacia uno de varios perfiles, y el perfil que más se repite es tu resultado. Duran tres o cuatro minutos, funcionan bien para jugar en grupo y, si repites con otras respuestas, puedes terminar en un perfil distinto.',
      ],
      faq: [
        {
          question: '¿Son tests de personalidad científicos?',
          answer:
            'No. Son quizzes livianos pensados para divertirse y compartir. El resultado describe un estilo o un hábito, no un diagnóstico.',
        },
        {
          question: '¿Cómo se decide mi resultado?',
          answer:
            'Cada opción apunta a un perfil. Gana el perfil al que más apuntan tus respuestas, y el cálculo se hace en el servidor.',
        },
        {
          question: '¿Puedo repetir el quiz y obtener otro resultado?',
          answer:
            'Sí. Usa Jugar de nuevo en la pantalla de resultado. Si respondes distinto, puedes caer en otro perfil.',
        },
        {
          question: '¿Necesito una cuenta para jugar?',
          answer:
            'No. Puedes jugar como invitado. La cuenta solo suma puntos, rachas y un lugar para guardar tus resultados favoritos.',
        },
      ],
    },
  },
  culture: {
    en: {
      intro: [
        'Culture collects the quizzes that do not belong to a single fandom: how you lead, how you handle conflict, what kind of traveller you are, plus fan trivia on stories that cross several categories. It is the place for questions about how people think and the stories everyone has an opinion on.',
        'The mix of formats is wider than in other sections. Trivia rounds support Practice mode, which shows an explanation after each answer when the question has one, so you learn something even when you miss.',
      ],
      faq: [
        {
          question: 'What kind of quizzes are in the Culture category?',
          answer:
            'Quizzes that cross topics: leadership and conflict styles, travel habits and fan trivia that does not fit one category.',
        },
        {
          question: 'Is there a mode that explains the answers?',
          answer:
            'Yes. Practice mode shows the explanation after each answer whenever the question includes one, and there is no clock.',
        },
        {
          question: 'Can I see which answers I got wrong?',
          answer:
            'Yes. After a trivia quiz, the result screen lists every question and marks each of your answers as right or wrong.',
        },
        {
          question: 'Is QuizVerse free to play?',
          answer:
            'Yes. Every quiz is free, with no paywall or premium questions, and you can play without creating an account.',
        },
      ],
    },
    es: {
      intro: [
        'Cultura reúne los quizzes que no pertenecen a un solo fandom: cómo lideras, cómo manejas un conflicto, qué tipo de viajero eres, además de trivia sobre referencias compartidas como Avatar, Merlina o El Juego del Calamar. Es el lugar para preguntas sobre cómo piensa la gente y sobre historias de las que todos opinan.',
        'La mezcla de formatos es más amplia que en otras secciones. La trivia admite el modo Práctica, que muestra una explicación después de cada respuesta cuando la pregunta la tiene, así aprendes algo aunque falles.',
      ],
      faq: [
        {
          question: '¿Qué tipo de quizzes hay en Cultura?',
          answer:
            'Quizzes que cruzan temas: estilos de liderazgo y de conflicto, hábitos de viaje y referencias muy compartidas como Avatar o Merlina.',
        },
        {
          question: '¿Hay un modo que explique las respuestas?',
          answer:
            'Sí. El modo Práctica muestra la explicación después de cada respuesta cuando la pregunta la incluye, y no tiene reloj.',
        },
        {
          question: '¿Puedo ver qué respuestas fallé?',
          answer:
            'Sí. Al terminar una trivia, la pantalla de resultado lista cada pregunta y marca tus respuestas como correctas o incorrectas.',
        },
        {
          question: '¿Los quizzes de QuizVerse son gratis?',
          answer:
            'Sí. Todos los quizzes son gratis, sin muro de pago ni preguntas premium, y puedes jugar sin crear una cuenta.',
        },
      ],
    },
  },
  literature: {
    en: {
      intro: [
        'The literature section is small and focused. Most of it revolves around Project Hail Mary, with a trivia round, a deeper knowledge test and personality quizzes that put you in a role aboard the mission. There are also quizzes about reading itself, such as what kind of reader you really are.',
        'Book trivia rewards people who have finished the story, while the personality quizzes only need you to know the premise. Every quiz is free and runs in the browser, so it fits between chapters.',
      ],
      faq: [
        {
          question: 'Which books have literature quizzes?',
          answer:
            'Project Hail Mary has the most, with trivia and personality formats. There are also quizzes about reading habits.',
        },
        {
          question: 'Should I finish the book before the trivia?',
          answer:
            'Ideally, yes. Book trivia can touch on late plot points. The personality quizzes work if you only know the premise.',
        },
        {
          question: 'Is there a quiz about what kind of reader I am?',
          answer:
            'Yes. The reading personality quiz sorts you by your reading habits rather than by any single title.',
        },
        {
          question: 'Can I review my answers after a book trivia quiz?',
          answer:
            'Yes. The result screen lists each question with your answer marked right or wrong, so you can see what you missed.',
        },
      ],
    },
    es: {
      intro: [
        'La sección de literatura es pequeña y enfocada. Casi todo gira en torno a Project Hail Mary: una trivia para fans, una prueba de conocimiento más exigente y quizzes de personalidad que te dan un rol dentro de la misión. Es un buen punto de partida si leíste el libro o te llamó la atención la adaptación.',
        'La trivia de libros premia a quien terminó la historia, mientras que los quizzes de personalidad solo piden conocer la premisa. Todos son gratis y se juegan en el navegador, así que caben entre un capítulo y otro.',
      ],
      faq: [
        {
          question: '¿Qué libros tienen quiz de literatura?',
          answer:
            'Project Hail Mary es el que más tiene, con trivia y quizzes de personalidad. El listado de arriba muestra todos los publicados.',
        },
        {
          question: '¿Conviene terminar el libro antes de la trivia?',
          answer:
            'Idealmente, sí. La trivia puede tocar giros del final. Los quizzes de personalidad funcionan si solo conoces la premisa.',
        },
        {
          question: '¿Qué tipo de rol me puede tocar en Project Hail Mary?',
          answer:
            'Un rol dentro de la misión, según lo que respondas. La página del quiz adelanta los resultados posibles.',
        },
        {
          question: '¿Puedo revisar mis respuestas después de la trivia?',
          answer:
            'Sí. La pantalla de resultado lista cada pregunta con tu respuesta marcada como correcta o incorrecta.',
        },
      ],
    },
  },
  'pop-culture': {
    en: {
      intro: [
        'Pop Culture is about the internet and the eras that shaped it: your social media alter ego, the nostalgia decade that actually defines you and trivia on internet culture. It is the section for people who catch every reference in a group chat and want proof.',
        'The quizzes are short and built to be passed around. When you finish, your result gets its own link with a preview card, and the challenge link shows your score to whoever opens it before they start.',
      ],
      faq: [
        {
          question: 'What counts as pop culture on QuizVerse?',
          answer:
            'Internet culture, social media personas and nostalgia eras. Single films, series or artists live in their own categories.',
        },
        {
          question: 'Can I share my result on social media?',
          answer:
            'Yes. Your result has its own link, and its preview card shows the outcome, so it displays properly when you post it.',
        },
        {
          question: 'How does the challenge link work?',
          answer:
            'Whoever opens it sees your score before playing the same quiz, and the result screen compares both scores at the end.',
        },
        {
          question: 'How many questions does a pop culture quiz have?',
          answer:
            'Around eight. Most take three or four minutes, and you can pause in the middle and come back to the same question.',
        },
      ],
    },
    es: {
      intro: [
        'Cultura pop trata de internet y de las épocas que lo marcaron: tu alter ego en redes sociales, la era de nostalgia que de verdad te define y trivia sobre cultura de internet. Es la sección para quien entiende todas las referencias del grupo de chat y quiere demostrarlo.',
        'Los quizzes son cortos y están pensados para circular. Al terminar, tu resultado tiene su propio enlace con tarjeta de vista previa, y el enlace de reto le muestra tu puntaje a quien lo abre antes de empezar.',
      ],
      faq: [
        {
          question: '¿Qué entra en Cultura pop en QuizVerse?',
          answer:
            'Cultura de internet, personajes de redes sociales y eras de nostalgia. Películas, series o artistas concretos tienen su propia categoría.',
        },
        {
          question: '¿Puedo compartir mi resultado en redes?',
          answer:
            'Sí. Tu resultado tiene su propio enlace y la tarjeta de vista previa muestra lo que te salió, así se ve bien al publicarlo.',
        },
        {
          question: '¿Cómo funciona el enlace de reto?',
          answer:
            'Quien lo abre ve tu puntaje antes de jugar el mismo quiz, y la pantalla de resultado compara ambos puntajes al final.',
        },
        {
          question: '¿Cuántas preguntas tiene un quiz de cultura pop?',
          answer:
            'Unas ocho. La mayoría se juega en tres o cuatro minutos, y puedes pausar a mitad de partida y retomar en la misma pregunta.',
        },
      ],
    },
  },
  technology: {
    en: {
      intro: [
        'The technology section is about your relationship with tech rather than specs or product launches. The quizzes ask how you really use AI day to day and which work style fits the AI era, so the result says more about your habits than about your gear.',
        'They are personality quizzes, so nothing needs studying and there is no wrong answer. Each one lands you on a written profile you can compare with friends or colleagues, and the quiz page previews the possible results.',
      ],
      faq: [
        {
          question: 'Do I need technical knowledge for these quizzes?',
          answer:
            'No. They ask about habits and attitudes toward technology, not about specs, code or how anything works inside.',
        },
        {
          question: 'What does the AI quiz actually measure?',
          answer:
            'How you use AI tools in everyday life and at work. The result describes a usage style, not a skill level.',
        },
        {
          question: 'Can I compare my result with my team?',
          answer:
            'Yes. Send the quiz link to your team; each person gets a result link with its own preview card to post in the chat.',
        },
        {
          question: 'Do these quizzes store my answers?',
          answer:
            'A finished game is saved with your choices so the result link works. Playing as a guest does not ask for an email or name.',
        },
      ],
    },
    es: {
      intro: [
        'La sección de tecnología habla de hábitos, no de especificaciones ni lanzamientos. Los quizzes preguntan cómo usas de verdad la inteligencia artificial en el día a día, qué estilo de trabajo encaja en la era de la IA y cuál es tu relación con la tecnología.',
        'Son quizzes de personalidad: no hay nada que estudiar ni respuestas incorrectas. Cada uno te asigna un perfil escrito que puedes comparar con amigos o colegas, y la página del quiz adelanta los resultados posibles.',
      ],
      faq: [
        {
          question: '¿Necesito saber de tecnología para jugar?',
          answer:
            'No. Las preguntas son sobre hábitos y actitudes frente a la tecnología, no sobre especificaciones, código ni cómo funciona nada por dentro.',
        },
        {
          question: '¿Qué mide el quiz sobre inteligencia artificial?',
          answer:
            'Cómo usas herramientas de IA en tu vida diaria y en el trabajo. El resultado describe un estilo de uso, no un nivel de habilidad.',
        },
        {
          question: '¿Puedo comparar mi resultado con mi equipo?',
          answer:
            'Sí. Comparte el enlace del quiz con tu equipo; cada persona obtiene un enlace de resultado con su propia tarjeta para el chat.',
        },
        {
          question: '¿Estos quizzes guardan mis respuestas?',
          answer:
            'La partida terminada se guarda con tus elecciones para que funcione el enlace del resultado. Como invitado no se pide correo ni nombre.',
        },
      ],
    },
  },
  relationships: {
    en: {
      intro: [
        'Relationships quizzes look at you through the people around you: which friend archetype you are in your group, what energy you bring to dating apps and what your relationship with technology says about you. They are written to start conversations, not to judge anyone.',
        'Because the results are about roles in a group, they work best played together. Everyone takes the same quiz, shares their result link and compares profiles. The quiz page previews the possible results before anyone starts.',
      ],
      faq: [
        {
          question: 'Are relationship quizzes meant as advice?',
          answer:
            'No. They are for fun and conversation. A result describes a tendency, not what you should do about a real relationship.',
        },
        {
          question: 'Can my friends and I take the same quiz?',
          answer:
            'Yes. Send the quiz link to the group; each person gets their own result link to drop back into the chat and compare.',
        },
        {
          question: 'Do I have to give my name or email to play?',
          answer:
            'No. You can play as a guest, with no profile attached. Only creating an account asks for an email.',
        },
        {
          question: 'Can I see the possible results before playing?',
          answer:
            'Yes. The quiz page previews the result profiles, so you know what you could land on before the first question.',
        },
      ],
    },
    es: {
      intro: [
        'Los quizzes de relaciones te miran a través de la gente que te rodea: qué arquetipo de amigo eres en tu grupo y qué energía llevas a las apps de citas, de la amistad al coqueteo. Están escritos para abrir conversación, no para juzgar a nadie.',
        'Como los resultados hablan de roles dentro de un grupo, funcionan mejor jugados en conjunto. Todos hacen el mismo quiz, comparten su enlace de resultado y comparan perfiles. La página del quiz adelanta los resultados posibles antes de empezar.',
      ],
      faq: [
        {
          question: '¿Los quizzes de relaciones son un consejo?',
          answer:
            'No. Son para divertirse y conversar. El resultado describe una tendencia, no lo que deberías hacer en una relación real.',
        },
        {
          question: '¿Podemos hacer el mismo quiz con mis amigos?',
          answer:
            'Sí. Manda el enlace del quiz al grupo; cada persona recibe su propio enlace de resultado para compartirlo en el chat y comparar.',
        },
        {
          question: '¿Tengo que dar mi nombre o correo para jugar?',
          answer:
            'No. Puedes jugar como invitado, sin perfil asociado. Solo crear una cuenta pide un correo.',
        },
        {
          question: '¿Puedo ver los resultados posibles antes de jugar?',
          answer:
            'Sí. La página del quiz adelanta los perfiles posibles, así sabes qué te puede tocar antes de la primera pregunta.',
        },
      ],
    },
  },
};

/** Curated guide for the slug, or a generic one built from name, count and type. */
export function getCategoryGuide(
  slug: string,
  locale: Locale,
  name: string,
  count: number
): CategoryGuide {
  const curated = CATEGORY_GUIDES[slug]?.[locale];
  if (curated) return curated;

  const es = locale === 'es';
  const type =
    slug === 'trivia'
      ? es
        ? 'Son trivias: después de cada respuesta ves si acertaste.'
        : 'They are trivia rounds: you see a verdict after every answer.'
      : slug === 'personality'
        ? es
          ? 'Son quizzes de personalidad: cada uno termina en un perfil escrito.'
          : 'They are personality quizzes: each one ends on a written profile.'
        : es
          ? 'Cada uno es una trivia o un quiz de personalidad, y la tarjeta indica cuál.'
          : 'Each card says whether the quiz is a trivia round or a personality quiz.';

  return es
    ? {
        intro: [
          `${name} reúne ${count} ${count === 1 ? 'quiz' : 'quizzes'} en español. ${type} Todos tienen unas ocho preguntas y se juega en pocos minutos, desde el navegador.`,
          'Puedes jugar como invitado, sin registro. Al terminar obtienes un enlace con tu resultado para compartirlo o retar a alguien a superarlo.',
        ],
        faq: [
          {
            question: `¿Los quizzes de ${name} son gratis?`,
            answer: 'Sí. Todos los quizzes de QuizVerse son gratis y no hay preguntas premium.',
          },
          {
            question: '¿Necesito una cuenta para jugar?',
            answer:
              'No. Puedes jugar como invitado. La cuenta solo sirve para sumar puntos y guardar tus resultados.',
          },
          {
            question: '¿Puedo compartir mi resultado?',
            answer:
              'Sí. La pantalla de resultado te da un enlace propio que puedes pegar en cualquier chat o red social.',
          },
        ],
      }
    : {
        intro: [
          `${name} brings together ${count} ${count === 1 ? 'quiz' : 'quizzes'} in English. ${type} Every quiz has around eight questions and takes a few minutes in the browser.`,
          'You can play as a guest, with no signup. When you finish you get a link to your result to share it or challenge someone to beat it.',
        ],
        faq: [
          {
            question: `Are the ${name} quizzes free?`,
            answer: 'Yes. Every quiz on QuizVerse is free to play, with no premium questions.',
          },
          {
            question: 'Do I need an account to play?',
            answer:
              'No. You can play as a guest. An account only adds points and a place to keep your results.',
          },
          {
            question: 'Can I share my result with friends?',
            answer:
              'Yes. The result screen gives you a link of your own to paste into any chat or social network.',
          },
        ],
      };
}
