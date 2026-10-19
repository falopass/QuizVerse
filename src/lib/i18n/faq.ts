import type { Locale } from './dictionaries';

export interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: Record<Locale, FaqItem[]> = {
  en: [
    {
      question: 'What is QuizVerse?',
      answer:
        'An editorial quiz platform about pop culture: personality tests and trivia in English and Spanish. Playing is free, right in the browser, with nothing to install.',
    },
    {
      question: 'Do I need an account to play?',
      answer:
        'No. Pick a quiz and start playing right away — no sign-up needed. You only need a free account to create your own quizzes, earn points and appear on the leaderboard.',
    },
    {
      question: 'What languages is QuizVerse available in?',
      answer:
        'English and Spanish, with the full catalog in both. You can switch languages anytime from the selector in the top menu.',
    },
    {
      question: 'How do you play and how does scoring work?',
      answer:
        'In trivia, each correct answer counts toward your score; in personality quizzes there are no right answers: your choices determine the dominant profile of your result.',
    },
    {
      question: 'How do I share my result or challenge a friend?',
      answer:
        'When you finish, your result gets a unique shareable link. From there you can issue a challenge: whoever opens it plays the same quiz trying to beat your score.',
    },
    {
      question: 'How are QuizVerse quizzes made?',
      answer:
        'Through an editorial pipeline: AI proposes questions and options, a human curates and polishes the result, and an automated audit blocks anything that fails our quality rules.',
    },
    {
      question: 'Can I create my own quiz?',
      answer:
        'Yes. With a free account you can build quizzes from the Create section: you set the questions, options and results, and they are saved to your profile.',
    },
    {
      question: 'How do points and the leaderboard work?',
      answer:
        'Every completed quiz earns 10 points and a perfect run adds a 25-point bonus. Points feed the global leaderboard and unlock achievements on your profile.',
    },
    {
      question: 'How do I report a quiz or a mistake?',
      answer:
        'Every quiz has a report button on its page. Use it to flag wrong answers or inappropriate content and the team will review it.',
    },
    {
      question: 'How do I contact the QuizVerse team?',
      answer:
        'Email us at hello@quizverse.org or use the contact page. We read quiz suggestions, content reports and collaboration proposals.',
    },
  ],
  es: [
    {
      question: '¿Qué es QuizVerse?',
      answer:
        'Una plataforma editorial de quizzes de cultura pop: tests de personalidad y trivia en español e inglés. Jugar es gratis, directo desde el navegador y sin instalar nada.',
    },
    {
      question: '¿Necesito una cuenta para jugar?',
      answer:
        'No. Eliges un quiz y juegas al momento, sin registro. La cuenta gratuita solo hace falta para crear tus propios quizzes, acumular puntos y aparecer en el ranking.',
    },
    {
      question: '¿En qué idiomas está QuizVerse?',
      answer:
        'En español y en inglés, con el catálogo completo en ambos. Puedes cambiar de idioma en cualquier momento desde el selector del menú superior.',
    },
    {
      question: '¿Cómo se juega y cómo se puntúa?',
      answer:
        'En trivia, cada respuesta correcta suma un acierto; en personalidad no hay aciertos: tus elecciones definen el perfil dominante del resultado que recibes al final.',
    },
    {
      question: '¿Cómo comparto mi resultado o reto a alguien?',
      answer:
        'Al terminar, tu resultado tiene un enlace único para compartir. Desde ahí puedes lanzar un reto: quien lo abra juega el mismo quiz intentando superar tu marca.',
    },
    {
      question: '¿Cómo se crean los quizzes de QuizVerse?',
      answer:
        'Con un pipeline editorial: la IA propone preguntas y opciones, una persona cura y pule el resultado y una auditoría automática bloquea lo que no cumple las reglas de calidad.',
    },
    {
      question: '¿Puedo crear mi propio quiz?',
      answer:
        'Sí. Con una cuenta gratuita puedes crear quizzes desde la sección Crear: defines las preguntas, las opciones y los resultados, y quedan guardados en tu perfil.',
    },
    {
      question: '¿Cómo funcionan los puntos y el ranking?',
      answer:
        'Cada quiz completado suma 10 puntos y una partida perfecta añade 25 de bonus. Los puntos alimentan el ranking global y desbloquean logros en tu perfil.',
    },
    {
      question: '¿Cómo reporto un quiz o un error?',
      answer:
        'Cada quiz tiene un botón de reporte en su página. Úsalo para señalar respuestas incorrectas o contenido inapropiado y el equipo lo revisará.',
    },
    {
      question: '¿Cómo contacto al equipo de QuizVerse?',
      answer:
        'Escríbenos a hello@quizverse.org o usa la página de contacto. Atendemos sugerencias de quizzes, reportes de contenido y propuestas de colaboración.',
    },
  ],
};

export function getFaq(locale: Locale): FaqItem[] {
  return FAQ_ITEMS[locale];
}
