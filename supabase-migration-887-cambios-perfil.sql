-- ════════════════════════════════════════════════════════════════════
-- Tanda 887: lo que DA una persona, para su perfil.
--
-- soyfedeegb, en el foro: «visualizar las cartas buscadas y disponibles
-- para trade por los demás usuarios en su perfil». Lo que BUSCA ya es
-- público (user_wants, 376). Lo que DA vive en `user_collection.cambio`
-- y esa tabla no se abre: sale por funciones `security definer` que
-- devuelven solo lo que se puede enseñar (376: ni lo que pagaste, ni el
-- valor a mano, ni las notas). Las que hay van por carta
-- (intercambios_de_carta) o cruzan con quien mira; faltaba la de UNA
-- persona entera, que es lo que pinta la pestaña «Cambios» del perfil.
--
-- Se ve sin cuenta, como el Mercado: dar una carta es decirlo en voz
-- alta. Sin lo de un baneado. Ejecutar en el SQL Editor; re-ejecutable.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.intercambios_de_persona(p_user uuid, p_limite int default 500)
returns table (
  card_id text,
  market text,
  idioma text,
  estado text,
  variante text,
  gradeo text,
  cambio int
)
language sql
stable
security definer
set search_path = public
as $$
  select c.card_id, c.market, c.idioma, c.estado, c.variante, c.gradeo, c.cambio
  from public.user_collection c
  join public.user_profiles p on p.id = c.user_id
  where c.user_id = p_user
    and c.cambio > 0
    and not coalesce(p.is_banned, false)
  order by c.updated_at desc nulls last, c.card_id
  limit greatest(1, least(coalesce(p_limite, 500), 2000));
$$;

revoke all on function public.intercambios_de_persona(uuid, int) from public;
grant execute on function public.intercambios_de_persona(uuid, int) to anon, authenticated;

notify pgrst, 'reload schema';
