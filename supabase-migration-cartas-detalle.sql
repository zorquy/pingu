-- Las cartas, con lo que hace falta para tener página propia.
--
-- Hasta ahora `tcg_cards` guardaba lo justo para el buscador del editor
-- y para traducir una decklist: nombre, imagen, número y set. Con eso
-- una página de carta es un título, una foto y tres datos — y publicar
-- miles de páginas así no sube en Google, HUNDE el sitio entero. Es el
-- caso de libro de «contenido escaso generado en masa».
--
-- Estas columnas son lo que convierte esa página en algo que merezca
-- existir: los PS, los ataques con su coste, la habilidad, la debilidad,
-- la rareza y quién la dibujó.
--
-- ⚠️ POR QUÉ ESTABAN VACÍAS, que es la parte importante y está escrita
-- en `js/tcgdex.js` desde la tanda 233: el listado de un set trae poco
-- (id, localId, name, image) y traer lo demás exige UNA PETICIÓN POR
-- CARTA. Son ~23.000 peticiones contra un catálogo comunitario y
-- gratuito, frente a las ~220 que cuesta importar el catálogo entero.
--
-- Por eso esto NO se rellena importando: se rellena poco a poco, por
-- tandas, con la función programada `cartas-detalle`. De ahí
-- `detalle_at`: null significa «esta carta todavía no se ha engordado»,
-- y es lo que la función usa para saber por dónde sigue. Sin esa
-- columna no hay forma de reanudar y cada pasada empezaría de cero.
--
-- El orden de relleno es por fecha de salida del set, de más nuevo a más
-- viejo: los sets recientes son los que se juegan y los que la gente
-- busca. Las cartas de 2003 pueden esperar.
--
-- `regulation_mark` ya existía (supabase-migration-cartas-marcas.sql, que
-- la rellenó de una vez con un SQL de 8.300 líneas). La función la
-- repasa de paso, porque la petición por carta ya la trae y así las que
-- aquel volcado no cubrió se arreglan solas.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede volver a ejecutar
-- entera sin romper nada.

-- ── Lo que se lee en la carta ──

-- Pokémon, Entrenador o Energía. Es lo primero que decide cómo se pinta
-- la página: un Entrenador no tiene PS ni ataques.
alter table public.tcg_cards add column if not exists category text;

-- Sólo Pokémon.
alter table public.tcg_cards add column if not exists hp integer;
alter table public.tcg_cards add column if not exists types text[];
alter table public.tcg_cards add column if not exists stage text;
alter table public.tcg_cards add column if not exists evolve_from text;
alter table public.tcg_cards add column if not exists retreat integer;

-- jsonb y no columnas sueltas porque son LISTAS de tamaño variable: una
-- carta tiene uno, dos o ningún ataque, y cada ataque lleva su coste
-- (que es a su vez una lista). Aplanarlo a columnas obligaría a inventar
-- un tope arbitrario y a partirlo el día que salga una carta con tres.
alter table public.tcg_cards add column if not exists attacks jsonb;
alter table public.tcg_cards add column if not exists abilities jsonb;
alter table public.tcg_cards add column if not exists weaknesses jsonb;
alter table public.tcg_cards add column if not exists resistances jsonb;

-- Sólo Entrenador (Objeto / Partidario / Estadio / Herramienta) y sólo
-- Energía (Básica / Especial). El tipo de carta manda cuántas puedes
-- jugar por turno, así que es dato de juego, no decoración.
alter table public.tcg_cards add column if not exists trainer_type text;
alter table public.tcg_cards add column if not exists energy_type text;

-- El «apellido» del nombre: ex, V, VMAX, GX… Va aparte del nombre
-- porque es lo que dice si la carta tiene regla especial.
alter table public.tcg_cards add column if not exists suffix text;

-- ── Lo de coleccionar ──

alter table public.tcg_cards add column if not exists rarity text;
alter table public.tcg_cards add column if not exists illustrator text;

-- El texto de Pokédex del pie. No sirve para jugar y sí para leer.
alter table public.tcg_cards add column if not exists description text;

-- normal / reverse / holo / firstEdition. Es lo que distingue dos copias
-- de la MISMA carta que valen precios muy distintos.
alter table public.tcg_cards add column if not exists variants jsonb;

-- ── El marcador de relleno ──
--
-- null = sin engordar. La función programada busca por aquí.
alter table public.tcg_cards add column if not exists detalle_at timestamptz;

-- Y por si una pasada trajo basura o TCGdex corrige una carta: guardar
-- POR QUÉ no se pudo rellenar evita que la función se quede dando
-- vueltas eternamente sobre las mismas cartas rotas.
alter table public.tcg_cards add column if not exists detalle_error text;

-- ── Índices ──

-- El que usa la función para elegir la siguiente tanda. Parcial a
-- propósito: sólo indexa lo que queda por hacer, así que encoge solo
-- según avanza el relleno y acaba ocupando nada.
create index if not exists tcg_cards_sin_detalle_idx
  on public.tcg_cards (set_id)
  where detalle_at is null;

-- Para la página de colección («enséñame sólo los ex») y para las
-- listas por rareza.
create index if not exists tcg_cards_rarity_idx
  on public.tcg_cards (market, rarity);

-- ── Comprobación ──
--
-- Cuántas cartas quedan por engordar, por mercado. Al ejecutar esto por
-- primera vez saldrá el catálogo entero: es lo esperado.
select market,
       count(*) as total,
       count(*) filter (where detalle_at is not null) as con_detalle,
       count(*) filter (where detalle_error is not null) as con_error
  from public.tcg_cards
 group by market
 order by market;
