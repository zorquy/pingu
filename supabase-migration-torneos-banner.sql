-- ═══════════════════════════════════════════════════════════════════
-- EL BANNER DEL TORNEO (tanda 242)
--
-- Lo pidió Ibai: además del icono del listado (tanda 239,
-- image_url), un banner ANCHO que preside la ficha del torneo. Misma
-- receta que entonces: una columna, y la imagen al bucket `avatars`
-- que ya existe (carpeta del usuario, torneo-banner-<ts>.<ext>) — sin
-- bucket ni política nueva.
--
-- Es re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════

alter table public.tournaments
  add column if not exists banner_url text;

-- ── Comprobación ───────────────────────────────────────────────────
select count(*) as torneos_con_banner from public.tournaments where banner_url is not null;
