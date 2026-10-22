-- Tanda 974 — Un solo «Me ha servido» en las guías.
--
-- PINGU eligió la opción A: al final de una guía había dos cosas que
-- preguntaban lo mismo, el botón «Me ha servido» (`guide_helpful`) y la caja
-- «¿Te ha servido esta guía? Sí / No tanto» (`guide_reviews`, Sí = 5 y
-- No tanto = 2). La web ya solo enseña el botón. Esto copia los «Sí» que ya
-- había (rating >= 4) al contador, para que ninguna guía empiece de cero.
--
-- · Sin XP otra vez: el autor ya cobró por esas valoraciones, así que el
--   disparador `trg_xp_autor_por_agradecimiento` se apaga SOLO durante la
--   copia. Va todo en un `do`: si algo falla, no queda apagado.
-- · Lo que ya está no se toca (`on conflict do nothing`): quien pulsó los
--   dos sigue contando una vez.
-- · El autor no cuenta en su propia guía (la política de inserción tampoco
--   le deja).
-- · `guide_reviews` NO se borra: los «No tanto» se quedan guardados, sin
--   enseñarse.
--
-- Se puede ejecutar dos veces: la segunda no copia nada.

do $$
begin
  alter table public.guide_helpful disable trigger trg_xp_autor_por_agradecimiento;

  insert into public.guide_helpful (guide_id, user_id, created_at)
  select r.guide_id, r.reviewer_id, r.created_at
    from public.guide_reviews r
    join public.guides g on g.id = r.guide_id
   where r.rating >= 4
     and r.reviewer_id is distinct from g.author_id
  on conflict (guide_id, user_id) do nothing;

  alter table public.guide_helpful enable trigger trg_xp_autor_por_agradecimiento;
end $$;

-- Para mirar después:
-- select count(*) from guide_helpful;
-- select tgname, tgenabled from pg_trigger where tgname = 'trg_xp_autor_por_agradecimiento';  -- 'O' = encendido
