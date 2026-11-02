/**
 * Sugerencia determinista de categoría para el estudio AI.
 *
 * El creador escribe un tema libre; antes de guardar hay que asignarle una de
 * las categorías reales del catálogo. Esta tabla ordenada (gana la primera
 * regla que coincida) propone un slug razonable a partir de palabras clave en
 * español e inglés. Es una sugerencia: la UI la preselecciona y el creador la
 * puede cambiar.
 */

// Orden importa: franquicias/temas específicos primero, buckets amplios al final.
const RULES: Array<[slug: string, match: RegExp]> = [
  [
    'anime-manga',
    /\b(anime|manga|shonen|seinen|otaku|waifu|ghibli|naruto|one piece|demon slayer|jujutsu|dragon ball|pokemon)\b/i,
  ],
  [
    'gaming',
    /\b(gaming|gamer|videojuegos?|video ?games?|nintendo|playstation|xbox|steam|zelda|mario|minecraft|fortnite|roblox|elden ring|league of legends|valorant|pok[eé]mon|rpg)\b/i,
  ],
  [
    'movies-tv',
    /\b(cine|pel[ií]culas?|movies?|films?|series?|netflix|hbo|hollywood|televisi[oó]n|tv|sitcom|documental|disney|marvel|star wars|harry potter)\b/i,
  ],
  [
    'literature',
    /\b(libros?|books?|literatura|literature|novelas?|novels?|autores?|authors?|poes[ií]a|poetry|escritores?|shakespeare)\b/i,
  ],
  [
    'music',
    /\b(m[uú]sica|music|cantantes?|singers?|rock|pop|rap|hip ?hop|k-?pop|reggaet[oó]n|conciertos?|[aá]lbum(?:es)?|banda|band|taylor swift|bad bunny)\b/i,
  ],
  [
    'science',
    /\b(ciencia|science|espacio|space|f[ií]sica|physics|qu[ií]mica|chemistry|biolog[ií]a|biology|astronom[ií]a|astronomy|universo|universe|experimentos?)\b/i,
  ],
  [
    'sports',
    /\b(deportes?|sports?|f[uú]tbol|football|soccer|nba|nfl|tenis|tennis|b[eé]isbol|baseball|ol[ií]mpic|olympics?|mundial|world cup)\b/i,
  ],
  [
    'geography',
    /\b(geograf[ií]a|geography|pa[ií]ses|countries|capitales?|capitals?|ciudades?|cities|mapas?|maps?|banderas?|flags?)\b/i,
  ],
  [
    'history',
    /\b(historia|history|imperios?|empires?|guerras?|wars?|antig[üu]edad|ancient|medieval|revoluci[oó]n|revolution|egipto|egypt|romanos?|vikingos?)\b/i,
  ],
  [
    'technology',
    /\b(tecnolog[ií]a|technology|tech|software|hardware|gadgets?|apps?|programaci[oó]n|coding|c[oó]digo|robots?|inteligencia artificial)\b/i,
  ],
  [
    'animals',
    /\b(animales?|animals?|perros?|dogs?|gatos?|cats?|mascotas?|pets?|vida salvaje|wildlife|dinosaurios?|dinosaurs?|aves|birds?|oc[eé]anos?)\b/i,
  ],
  [
    'food-drink',
    /\b(comida|food|bebidas?|drinks?|recetas?|recipes?|cocina|cooking|gastronom[ií]a|caf[eé]|coffee|vino|wine|cerveza|beer|restaurantes?|postres?)\b/i,
  ],
  [
    'relationships',
    /\b(relaciones|relationships?|parejas?|couples?|amor|love|citas?|dating|amistad|friendship|banderas rojas|red flags|crush|rupturas?)\b/i,
  ],
  [
    'lifestyle',
    /\b(estilo de vida|lifestyle|rutinas?|routines?|h[aá]bitos?|habits?|viajes?|travel|hogar|home|moda|fashion|dise[ñn]o|design|productividad|bienestar|wellness)\b/i,
  ],
  [
    'pop-culture',
    /\b(cultura pop|pop culture|memes?|fandoms?|famosos?|celebrities|influencers?|viral|tendencias?|trends?|internet)\b/i,
  ],
  [
    'culture',
    /\b(cultura|culture|arte|art|mitolog[ií]a|mythology|idiomas?|languages?|tradiciones?|traditions?|religi[oó]n|filosof[ií]a)\b/i,
  ],
];

/** Slug de la primera regla que coincide con el tema, o `null` si ninguna aplica. */
export function suggestCategorySlug(topic: string): string | null {
  return RULES.find(([, match]) => match.test(topic))?.[0] ?? null;
}

/** La categoría sugerida para el tema dentro de las categorías disponibles. */
export function suggestCategory<T extends { slug: string }>(
  topic: string,
  categories: T[]
): T | undefined {
  const slug = suggestCategorySlug(topic);
  return slug ? categories.find((category) => category.slug === slug) : undefined;
}
