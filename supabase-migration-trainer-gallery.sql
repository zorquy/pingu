-- Las cuatro Trainer Gallery, que están partidas en dos (tanda 432).
--
-- ── EL DIAGNÓSTICO ──
--
-- Cada Trainer Gallery existe DOS VECES en `tcg_sets`, y cada mitad tiene
-- la parte que le falta a la otra:
--
--   swsh10.5tg  «Astral Radiance Trainer Gallery»  sin código, sin fecha, 30 cartas
--   swsh10tg    «Astral Radiance Trainer Gallery»  ASR, 2022-05-27,   0 cartas
--
-- Y lo mismo con la 9.5/9, la 11.5/11 y la 12.5/12. En total, 120 cartas
-- en filas sin código y cuatro filas con código y sin cartas.
--
-- Las consecuencias, las dos sin dar ningún error:
--
--   1. Esas 120 cartas salen SIN IMAGEN. No es que TCGdex no las tenga:
--      es que la cadena de escaneo monta la dirección de Limitless con el
--      CÓDIGO DE TCG LIVE del set, y el código está en la otra fila. Con
--      el código puesto se ven solas, igual que ya se ve la Galarian
--      Gallery de Crown Zenith, que es el mismo caso (`CRZ_GG1`).
--   2. Las cuatro filas vacías salen en la estantería como «0 de 30» para
--      siempre: una colección que no se puede completar nunca.
--
-- ── LO QUE HACE ESTO ──
--
-- Le da a la fila que TIENE las cartas el código y la fecha de su gemela,
-- y después borra la gemela vacía. No toca ninguna carta ni ninguna
-- colección: los identificadores de carta no cambian.
--
-- Va con guardas y es idempotente: si ya se ejecutó, no hace nada.

begin;

-- ── 1. Pasarle el código y la fecha a la fila que tiene las cartas ──
--
-- Se empareja por NOMBRE y mercado, y solo cuando la de destino está a
-- null: si alguien ya lo arregló a mano, esto no lo pisa.
with pares as (
  select
    conCartas.id as destino,
    vacia.tcg_online_code as codigo,
    vacia.release_date as fecha,
    vacia.logo_path as logo,
    vacia.symbol_url as simbolo
  from tcg_sets conCartas
  join tcg_sets vacia
    on vacia.market = conCartas.market
   and vacia.name = conCartas.name
   and vacia.id <> conCartas.id
   and vacia.tcg_online_code is not null
  where conCartas.market = 'WEST'
    and conCartas.tcg_online_code is null
    and exists (select 1 from tcg_cards c where c.set_id = conCartas.id and c.market = conCartas.market)
    and not exists (select 1 from tcg_cards c where c.set_id = vacia.id and c.market = vacia.market)
)
update tcg_sets s
set tcg_online_code = coalesce(s.tcg_online_code, p.codigo),
    release_date    = coalesce(s.release_date, p.fecha),
    logo_path       = coalesce(s.logo_path, p.logo),
    symbol_url      = coalesce(s.symbol_url, p.simbolo)
from pares p
where s.id = p.destino and s.market = 'WEST';

-- ── 2. Borrar las filas vacías que han quedado duplicadas ──
--
-- Solo las que: no tienen NI UNA carta, tienen una gemela con el mismo
-- nombre que sí las tiene, y nadie las ha marcado como favoritas. Lo
-- último importa: un favorito apuntando a un set borrado deja una
-- estrella que no lleva a ninguna parte.
--
-- Si alguna tiene favoritos, se queda y hay que mirarla a mano: es mejor
-- un duplicado a la vista que un favorito roto en silencio.
delete from tcg_sets vacia
where vacia.market = 'WEST'
  and not exists (select 1 from tcg_cards c where c.set_id = vacia.id and c.market = vacia.market)
  and exists (
    select 1 from tcg_sets gemela
    where gemela.market = vacia.market
      and gemela.name = vacia.name
      and gemela.id <> vacia.id
      and exists (select 1 from tcg_cards c where c.set_id = gemela.id and c.market = gemela.market)
  )
  and not exists (
    select 1 from collection_favorite_sets f where f.set_id = vacia.id
  );

commit;

-- ── Para comprobar que ha ido bien ──
--
-- Las cuatro filas que quedan tienen que tener código, fecha y 30 cartas.
-- select id, name, tcg_online_code, release_date,
--        (select count(*) from tcg_cards c where c.set_id = s.id) as cartas
-- from tcg_sets s
-- where market = 'WEST' and name like '%Trainer Gallery%'
-- order by name;
