-- ════════════════════════════════════════════════════════════════════
--  Que el panel pueda LEER por dónde va el relleno (tanda 510)
-- ════════════════════════════════════════════════════════════════════
--
-- `scrydex_estado` nació con RLS puesta y SIN NINGUNA POLÍTICA, que para
-- escribir es correcto —la escribe la función programada con la clave de
-- servicio, que se salta la RLS— pero deja al navegador leyendo CERO
-- FILAS. Y aquí está lo malo: **la RLS no da error, devuelve una lista
-- vacía**, así que el botón «¿Cómo va el relleno?» decía «todavía no ha
-- corrido ninguna vez» aunque llevara toda la noche corriendo.
--
-- Una mentira en lo primero que hay que mirar por la mañana, y de la
-- familia de siempre: un vacío que se lee como una respuesta cuando en
-- realidad es «no tienes permiso».
--
-- Solo LECTURA y solo para el admin del sitio. Nadie más tiene por qué
-- ver por dónde va una importación.
drop policy if exists "scrydex_estado_lee_admin" on public.scrydex_estado;
create policy "scrydex_estado_lee_admin"
  on public.scrydex_estado for select to authenticated using (public.is_admin());

-- Qué hay ahora mismo, para pegarlo en la bitácora.
select clave, valor, updated_at from public.scrydex_estado;
