/**
 * Sugerencia determinista de categoría para el estudio AI.
 *
 * El creador escribe un tema libre; antes de guardar hay que asignarle una de
 * las categorías reales del catálogo. Esta tabla ordenada (gana la primera
 * regla que coincida) propone un slug razonable a partir de palabras clave en
 * español e inglés. Es una sugerencia: la UI la preselecciona y el creador la
 * puede cambiar.
 */

// Los límites `\b` de JavaScript son ASCII: «café» o «Álbum» no cerrarían
// palabra. Se quitan los acentos del tema y las reglas se escriben sin ellos.
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Orden importa: franquicias/temas específicos primero, buckets amplios al
// final. «Cultura pop» va antes que Música para que su «pop» no la capture.
const RULES: Array<[slug: string, match: RegExp]> = [
  [
    'anime-manga',
    /\b(anime|manga|shonen|seinen|otaku|waifu|ghibli|naruto|one piece|demon slayer|jujutsu|dragon ball|pokemon)\b/,
  ],
  [
    'gaming',
    /\b(gaming|gamer|videojuegos?|video ?games?|nintendo|playstation|xbox|steam|zelda|mario|minecraft|fortnite|roblox|elden ring|league of legends|valorant|pokemon|rpg)\b/,
  ],
  [
    'movies-tv',
    /\b(cine|peliculas?|movies?|films?|series?|netflix|hbo|hollywood|television|tv|sitcom|documental|disney|marvel|star wars|harry potter)\b/,
  ],
  [
    'literature',
    /\b(libros?|books?|literatura|literature|novelas?|novels?|autores?|authors?|poesia|poetry|escritores?|shakespeare)\b/,
  ],
  [
    'pop-culture',
    /\b(cultura pop|pop culture|memes?|fandoms?|famosos?|celebrities|influencers?|viral|tendencias?|trends?|internet)\b/,
  ],
  [
    'music',
    /\b(musica|music|cantantes?|singers?|rock|pop|rap|hip ?hop|k-?pop|reggaeton|conciertos?|album(?:es)?|banda|band|taylor swift|bad bunny)\b/,
  ],
  [
    'science',
    /\b(ciencia|science|espacio|space|fisica|physics|quimica|chemistry|biologia|biology|astronomia|astronomy|universo|universe|experimentos?)\b/,
  ],
  [
    'sports',
    /\b(deportes?|sports?|futbol|football|soccer|nba|nfl|tenis|tennis|beisbol|baseball|olimpic(?:os|as)?|olympics?|mundial|world cup)\b/,
  ],
  [
    'geography',
    /\b(geografia|geography|paises|countries|capitales?|capitals?|ciudades?|cities|mapas?|maps?|banderas?|flags?)\b/,
  ],
  [
    'history',
    /\b(historia|history|imperios?|empires?|guerras?|wars?|antiguedad|ancient|medieval|revolucion|revolution|egipto|egypt|romanos?|vikingos?)\b/,
  ],
  [
    'technology',
    /\b(tecnologia|technology|tech|software|hardware|gadgets?|apps?|programacion|coding|codigo|robots?|inteligencia artificial)\b/,
  ],
  [
    'animals',
    /\b(animales?|animals?|perros?|dogs?|gatos?|cats?|mascotas?|pets?|vida salvaje|wildlife|dinosaurios?|dinosaurs?|aves|birds?|oceanos?)\b/,
  ],
  [
    'food-drink',
    /\b(comida|food|bebidas?|drinks?|recetas?|recipes?|cocina|cooking|gastronomia|cafe|coffee|vino|wine|cerveza|beer|restaurantes?|postres?)\b/,
  ],
  [
    'relationships',
    /\b(relaciones|relationships?|parejas?|couples?|amor|love|citas?|dating|amistad|friendship|banderas rojas|red flags|crush|rupturas?)\b/,
  ],
  [
    'lifestyle',
    /\b(estilo de vida|lifestyle|rutinas?|routines?|habitos?|habits?|viajes?|travel|hogar|home|moda|fashion|diseno|design|productividad|bienestar|wellness)\b/,
  ],
  [
    'culture',
    /\b(cultura|culture|arte|art|mitologia|mythology|idiomas?|languages?|tradiciones?|traditions?|religion|filosofia)\b/,
  ],
];

/** Hubs de tipo (no de tema): no sirven como categoría de un quiz. */
const TYPE_HUB_SLUGS = new Set(['personality', 'trivia']);

export const isTopicCategory = (slug: string) => !TYPE_HUB_SLUGS.has(slug);

/** Slug de la primera regla que coincide con el tema, o `null` si ninguna aplica. */
export function suggestCategorySlug(topic: string): string | null {
  const normalized = normalize(topic);
  return RULES.find(([, match]) => match.test(normalized))?.[0] ?? null;
}

/** La categoría sugerida para el tema dentro de las categorías disponibles. */
export function suggestCategory<T extends { slug: string }>(
  topic: string,
  categories: T[]
): T | undefined {
  const slug = suggestCategorySlug(topic);
  return slug ? categories.find((category) => category.slug === slug) : undefined;
}
