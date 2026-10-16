-- ════════════════════════════════════════════════════════════════════
-- Noticia: el «Special Deck Set» de Mega Dragonite ex, Mega Gengar ex y
-- Mega Feraligatr ex (Japón, 13 de noviembre de 2026).
--
-- Una noticia es una fila de `guides` con `kind = 'news'` (tanda 269),
-- sin firma (author_id null, tanda 289) y con el texto en
-- `reference_blocks` como un bloque `richtext`, que es como lo guarda el
-- editor.
--
-- El disparador `guides_solo_admin_publica_noticias` devuelve a «guía»
-- cualquier noticia que no escriba un admin, y en el SQL Editor no hay
-- sesión (auth.uid() es null). Por eso se apaga para esta inserción y se
-- vuelve a encender justo después. Cada sentencia se sostiene sola.
--
-- Lo que NO hace esta inserción y hace el botón de publicar del editor:
-- abrir el hilo de la noticia en el foro Noticias (tanda 273). Si lo
-- quieres, publícala desde el editor en vez de con este fichero (abajo
-- va el texto) o ábrelo luego desde la propia noticia.
--
-- Si el canal de Telegram está encendido, `telegram-noticias` la mandará
-- sola en su siguiente pasada (telegram_sent_at nulo).
-- ════════════════════════════════════════════════════════════════════

alter table public.guides disable trigger guides_solo_admin_publica_noticias;

insert into public.guides (
  slug, title, description, kind, category_id, cover_emoji, level, guide_rarity,
  xp_reward, estimated_mins, tags, search_content, blocks, reference_blocks,
  is_pro, reference_unlocked_by_default, review_status, author_id,
  collection_order, published_at, created_at
)
values (
  'special-deck-set-mega-dragonite-gengar-feraligatr',
  'Mega Dragonite ex, Mega Gengar ex y Mega Feraligatr ex tendrán su «Special Deck Set» en Japón el 13 de noviembre',
  'Tres mazos de 60 cartas con los tres Mega Pokémon ex en arte alternativo, tapete, caja de mazo, monedas y contadores por 5.500 yenes. Lo que trae, lo que no, y qué pasa con la versión occidental.',
  'news',
  coalesce((select id from public.categories where slug = 'noticias' limit 1), (select id from public.categories limit 1)),
  'layers',
  'beginner',
  'bronze',
  0,
  2,
  array['Japón', 'Mega Evolución', 'productos', 'Mega Dragonite ex', 'Mega Gengar ex', 'Mega Feraligatr ex', 'Special Deck Set'],
  'Special Deck Set Mega Dragonite ex Mega Gengar ex Mega Feraligatr ex Japón 13 de noviembre 5500 yenes tres mazos de 60 cartas arte alternativo reimpresiones tapete caja de mazo monedas contadores Ascended Heroes Mega Moonlight Mega Forces latas Illustration Rare',
  '[]'::jsonb,
  $json$[
    {
      "type": "richtext",
      "html": "<p>Ya es oficial: el <strong>«Special Deck Set»</strong> con <strong>Mega Gengar ex</strong>, <strong>Mega Dragonite ex</strong> y <strong>Mega Feraligatr ex</strong> saldrá en Japón el <strong>13 de noviembre</strong> por <strong>5.500 yenes</strong>, en torno a 30 euros al cambio. El producto se había dejado ver en mayo en el calendario de lanzamientos japonés y hasta ahora solo se conocían los tres protagonistas.</p><h2>Qué trae la caja</h2><p>Como se esperaba, son <strong>tres mazos de 60 cartas</strong>, cada uno con uno de los tres Mega Pokémon ex como cabeza de cartel y en <strong>arte alternativo</strong>. El resto de cada mazo serán reimpresiones de cartas ya publicadas: es un producto para empezar a jugar con los tres mazos listos, no para abrir sobres.</p><p>Además de los mazos, la caja incluye:</p><ul><li>un <strong>tapete</strong> de juego,</li><li>una <strong>caja de mazo</strong>,</li><li>un <strong>estuche para contadores de daño</strong> y dos hojas de contadores,</li><li><strong>tres monedas</strong> Pokémon,</li><li>y las guías de jugador de cada mazo.</li></ul><p>Todo viene dentro de una caja de cartón del tamaño de una caja de cartas.</p><h2>Las tres cartas, en inglés ya las tenemos</h2><p>Si juegas o coleccionas en inglés, los tres Mega Pokémon ex no son nuevos: <strong>Mega Feraligatr ex</strong> llegó en la caja <em>Mega Feraligatr ex Box</em> de <em>Ascended Heroes</em>, <strong>Mega Gengar ex</strong> en las latas <em>Mega Moonlight</em>, y <strong>Mega Dragonite ex</strong> en las latas <em>Mega Forces</em>. Lo que aporta este producto es el arte alternativo de los tres y el formato de mazos jugables.</p><h2>Lo que no trae (o al menos no se ve)</h2><p>La vez anterior que salió esta línea de producto, en 2023, la caja escondía tres <strong>Illustration Rares</strong> nuevas de Bulbasaur, Charmander y Squirtle que se convirtieron en lo más buscado del set. El embalaje de este año <strong>no enseña ninguna Illustration Rare nueva</strong> en la tapa, así que, salvo sorpresa, no habría cartas inéditas más allá de los tres artes alternativos. Si aparece algo más al abrirse, lo ampliaremos aquí.</p><h2>Y en España, ¿qué?</h2><p>Es un producto <strong>japonés</strong>: en noviembre solo se podrá conseguir por importación, y con las tres cartas en japonés. No hay anuncio de una versión occidental equivalente. Los tres Mega ex ya están disponibles en inglés en los productos de arriba y, cuando salgan sus artes alternativos por aquí, los verás en el <a href=\"/lanzamientos\">calendario de lanzamientos</a> y en su expansión del catálogo.</p><p><em>Fuente: PokeBeach.</em></p>"
    }
  ]$json$::jsonb,
  false,
  true,
  'approved',
  null,
  0,
  now(),
  now()
);

alter table public.guides enable trigger guides_solo_admin_publica_noticias;

-- Comprobación: tiene que salir una fila con kind = 'news'.
select slug, kind, published_at from public.guides
  where slug = 'special-deck-set-mega-dragonite-gengar-feraligatr';
