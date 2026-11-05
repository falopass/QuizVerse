/**
 * Contrato del filtro de apodos (src/lib/moderation/nickname.ts):
 * forma (2-20, letras/números/espacio/`_-.`), bloqueo de groserías es/en con
 * evasiones comunes, y falsos positivos acotados por lista de excepciones y
 * coincidencias 'exact'/'boundary'.
 */

import { describe, expect, it } from 'vitest';
import {
  isNicknameAllowed,
  isNicknameBlocked,
  isNicknameReserved,
  normalizeNickname,
  NICKNAME_MAX,
} from '@/lib/moderation/nickname';

const expectOk = (raw: string) => {
  const verdict = isNicknameAllowed(raw);
  expect(verdict).toEqual({ ok: true, value: expect.any(String) });
};

const expectDeny = (raw: string, reason: 'length' | 'chars' | 'blocked' | 'reserved') => {
  expect(isNicknameAllowed(raw)).toEqual({ ok: false, reason });
};

describe('normalizeNickname — forma', () => {
  it('recorta y colapsa espacios', () => {
    expect(normalizeNickname('  Camila   Andrea  ')).toBe('Camila Andrea');
  });

  it('acepta 2-20 caracteres', () => {
    expect(normalizeNickname('Lu')).toBe('Lu');
    expect(normalizeNickname('a'.repeat(NICKNAME_MAX))).toBe('a'.repeat(NICKNAME_MAX));
  });

  it('rechaza fuera de rango', () => {
    expect(normalizeNickname('x')).toBeNull();
    expect(normalizeNickname('   ')).toBeNull();
    expect(normalizeNickname('a'.repeat(NICKNAME_MAX + 1))).toBeNull();
  });

  it('acepta letras con tildes y ñ, números y _-.', () => {
    for (const nick of ['Camila', 'Ñandú', 'José-Ángel', 'Pato_99', 'mí.a', 'Diego 2']) {
      expect(normalizeNickname(nick)).toBe(nick);
    }
  });

  it('rechaza emojis y símbolos fuera del set', () => {
    for (const nick of ['D🎮ego', 'a/b', 'a\\b', 'a<b>', 'a@b', 'a#b', 'a&b']) {
      expect(normalizeNickname(nick)).toBeNull();
    }
  });
});

describe('isNicknameAllowed — razones', () => {
  it('length antes que chars cuando sobran caracteres raros pero falta largo', () => {
    expectDeny('🎮', 'length');
    expectDeny('a'.repeat(30), 'length');
  });

  it('chars cuando el largo está bien pero el set no', () => {
    expectDeny('ab🎮', 'chars');
  });
});

describe('bloqueos directos es/en', () => {
  const blocked = [
    'puta',
    'puto',
    'mierda',
    'cagada',
    'verga',
    'pene',
    'culiao',
    'culito',
    'weon',
    'huevon',
    'maricon',
    'marica',
    'pendejo',
    'pelotudo',
    'boludo',
    'culero',
    'malparido',
    'gonorrea',
    'cabron',
    'capullo',
    'gilipollas',
    'cojones',
    'hostia',
    'joder',
    'chingar',
    'chingon',
    'carajo',
    'conchatumadre',
    'zorra',
    'perra',
    'chocho',
    'mamada',
    'follar',
    'polla',
    'estupido',
    'idiota',
    'imbecil',
    'subnormal',
    'retrasado',
    'mongolico',
    'bastardo',
    'cornudo',
    'sudaca',
    'fuck',
    'fucking',
    'shit',
    'bitch',
    'cunt',
    'whore',
    'slut',
    'twat',
    'pussy',
    'dickhead',
    'asshole',
    'faggot',
    'nigger',
    'nigga',
    'nazi',
    'hitler',
    'kkk',
    'kike',
    'wetback',
    'beaner',
    'porn',
    'porno',
    'hentai',
    'dildo',
    'bukkake',
    'blowjob',
    'rapist',
    'violador',
    'pedofilo',
    'incesto',
    'zoofilia',
    'necrofilo',
    'pervertido',
    'motherfucker',
    'mofo',
    'stfu',
    'goddamn',
    'stronzo',
    'cazzo',
    'merde',
    'kurwa',
    'blyat',
    'putain',
    'encule',
    'salope',
    'fotze',
    'porra',
    'caralho',
    'buceta',
  ];

  for (const word of blocked) {
    it(`bloquea "${word}"`, () => {
      expectDeny(word, 'blocked');
    });
  }
});

describe('evasiones', () => {
  const evasions = [
    'PUTA',
    'PutA',
    'púta',
    'pütä',
    'put4',
    'pvt4'.replace('v', 'u'), // put4 también vale
    'p.u.t.a',
    'p u t a',
    'p-u-t-a',
    'p_u_t_a',
    'puuuta',
    'ppputttaaa',
    'xxputaxx',
    'laputa',
    'mi3rda',
    'mierd4',
    'cu10',
    'cul0',
    'culiao',
    'c-u-l-i-a-o',
    'w3on',
    'huev0n',
    'maric0n',
    'v3rga',
    'c4bron',
    'fuck',
    'fuk',
    'fvck',
    'phuck',
    'f4ck',
    'sh1t',
    'shyt',
    'b1tch',
    'c0nt'.replace('0', 'u'), // cunt ya está; c0nt pliega a cont — no es cunt
    'cvnt',
    'kunt',
    'wh0re',
    '5lut',
    'p3n3',
    'n3gr0put0',
    'h1j0d3put4',
    'n4z1',
    'h1tler',
    'f4gg0t',
    'n1664'.replaceAll('6', 'g'), // nigga
    'put0elqu3l33',
    'm4m4gu3v0',
    'ch1ng4tum4dr3',
    'elputoamo',
    'qlo',
  ];

  for (const nick of evasions) {
    it(`bloquea la evasión "${nick}"`, () => {
      expectDeny(nick, 'blocked');
    });
  }

  it('bloquea "el culo" y "tu culo" (compuestos con vocal)', () => {
    expectDeny('elculo', 'blocked');
    expectDeny('tuculo', 'blocked');
    expectDeny('lameculo', 'blocked');
  });

  it('bloquea "c.u.l.o" por la forma plegada del apodo entero', () => {
    expectDeny('c.u.l.o', 'blocked');
  });
});

describe('exact: palabra sola sí, subcadena no', () => {
  const exactBlocked = [
    'ass',
    'arse',
    'dick',
    'anal',
    'sex',
    'sexo',
    'cum',
    'rape',
    'fag',
    'cono',
    'paja',
    'coger',
    'piss',
  ];

  for (const word of exactBlocked) {
    it(`bloquea "${word}" sola`, () => {
      expectDeny(word, 'blocked');
    });
  }

  it('bloquea "coger" pero no "escoger"', () => {
    expectDeny('coger', 'blocked');
    expectOk('Escoger');
    expectOk('Recoger');
  });

  it('bloquea "piss" en compuestos', () => {
    expectDeny('pissed', 'blocked');
    expectDeny('piss', 'blocked');
  });
});

describe('falsos positivos: palabras normales pasan', () => {
  const allowed = [
    'Computadora',
    'Computador',
    'computo',
    'disputa',
    'reputación',
    'amputar',
    'putativo',
    'Pascal',
    'Scunthorpe',
    'Hancock',
    'Analía',
    'análisis',
    'analista',
    'canal',
    'banal',
    'Essex',
    'Sussex',
    'sexólogo',
    'Chicago',
    'Cacahuete',
    'Kakarot',
    'músculo',
    'artículo',
    'vehículo',
    'oráculo',
    'película',
    'ridículo',
    'espectáculo',
    'obstáculo',
    'peculiar',
    'oculista',
    'reculo',
    'Vergara',
    'Maracaibo',
    'maracas',
    'pijama',
    'carajillo',
    'controló',
    'controla',
    'Norton',
    'Horton',
    'Porto',
    'torpedo',
    'Penélope',
    'peacock',
    'hitchcock',
    'cocktail',
    'cockpit',
    'cockroach',
    'shuttlecock',
    'poppycock',
    'shiitake',
    'booboo',
    'basement',
    'Thoth',
    'Uranus',
    'Janus',
    'Milford',
    'Tetanus',
    'raccoon',
    'cocoon',
    'tycoon',
    'follaje',
    'snigger',
    'niggard',
    'Nazir',
    'Pickard',
    'Fukushima',
    'Fukuoka',
    'Fukuda',
    'Merdeka',
    'Pollard',
    'Borgia',
    'supportive',
    'supporter',
    'Putin',
    'Rasputin',
    'class',
    'grass',
    'pass',
    'assistant',
    'glasses',
    'shoe',
    'grape',
    'drape',
    'trapeze',
    'arsenal',
    'vagabundo',
    'conocer',
    'conoce',
    'Plátano',
    'hispano',
    'piso',
    'pistola',
    'Romeo',
    'cameo',
    'apron',
    'prone',
    'cumpleaños',
    'cumbia',
    'cumbre',
    'cumplir',
    'document',
    'cucumber',
    'spicy',
    'suspicion',
    'hospice',
    'spike',
    'dickens',
    'dickinson',
    'riddick',
    'escoge',
    'escogido',
    'Camila',
    'Pato',
    'Diego',
    'Ñoño',
    'Tío Pepe',
    'Año Nuevo',
    'vendedor',
    'jugador',
    'gamer2024',
  ];

  for (const nick of allowed) {
    it(`permite "${nick}"`, () => {
      expectOk(nick);
    });
  }
});

describe('nombres reservados', () => {
  const reserved = [
    'admin',
    'administrador',
    'moderator',
    'moderador',
    'quizverse',
    'soporte',
    'support',
    'oficial',
    'official',
    'webmaster',
    'noreply',
    'QuizVerseOficial',
    'adm1n',
    's0p0rte',
    'mod',
    'staff',
    'system',
    'info',
    'ayuda',
    'bot',
    'test',
    'root',
    'equipo',
    'team',
    'owner',
    'dueno',
  ];

  for (const word of reserved) {
    it(`reserva "${word}"`, () => {
      expectDeny(word, 'reserved');
    });
  }

  it('no reserva palabras normales', () => {
    for (const nick of [
      'Moda',
      'Stafford',
      'información',
      'ayudante',
      'rooted',
      'sistemas24',
      'botella',
    ]) {
      const verdict = isNicknameAllowed(nick);
      if (!verdict.ok && verdict.reason === 'reserved') {
        throw new Error(`"${nick}" marcado reserved sin serlo`);
      }
    }
  });
});

describe('value devuelto', () => {
  it('devuelve el apodo normalizado con su forma y espacios', () => {
    const verdict = isNicknameAllowed('  Camila   Andrea ');
    expect(verdict).toEqual({ ok: true, value: 'Camila Andrea' });
  });
});

describe('helpers expuestos', () => {
  it('isNicknameBlocked no marca reservados ni normales', () => {
    expect(isNicknameBlocked('admin')).toBe(false);
    expect(isNicknameBlocked('Camila')).toBe(false);
    expect(isNicknameBlocked('puta')).toBe(true);
  });

  it('isNicknameReserved no marca bloqueados ni normales', () => {
    expect(isNicknameReserved('puta')).toBe(false);
    expect(isNicknameReserved('Camila')).toBe(false);
    expect(isNicknameReserved('quizverse')).toBe(true);
  });
});
