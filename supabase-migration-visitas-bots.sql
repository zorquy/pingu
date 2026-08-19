-- Visitas: separar personas de robots
-- ============================================================
--
-- Al investigar por qué "no salían" las visitas apareció otra cosa: cientos
-- de visitas diarias que van de guía en guía con segundos de diferencia,
-- todas anónimas. Son rastreadores (Google ejecuta JavaScript al indexar,
-- así que también dispara el registro de visitas). Buena señal para el SEO,
-- pero infla el número: con esto, el panel puede decir cuánta gente DE
-- VERDAD entra.
--
-- La columna la rellena el navegador al registrar la visita (ver
-- js/page-views.js): un robot se delata por su user agent o por
-- navigator.webdriver. No se guarda el user agent entero a propósito — un
-- booleano basta y no arrastra datos de nadie.
--
-- Nullable y SIN valor por defecto a propósito: las visitas de antes de
-- esta migración no se pueden clasificar (nunca se guardó con qué user
-- agent llegaron), y un `default false` las convertiría a todas en
-- "personas", que es mentira. Null = "de antes, sin clasificar", y el
-- panel las dice tal cual.
--
-- Es idempotente: se puede ejecutar más de una vez.

alter table public.page_views add column if not exists is_bot boolean;

-- ── Comprobación ──
-- select is_bot, count(*) from public.page_views group by is_bot;
-- (Recién migrada, todo saldrá en null: lo clasificado empieza a entrar
-- con las visitas nuevas.)
