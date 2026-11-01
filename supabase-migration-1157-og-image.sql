-- Tanda 1157 (R3 de «Todas las imágenes de PokeDoc, con el mismo marco»):
-- la tarjeta del enlace de una noticia, con la marca.
--
-- Al publicar una noticia, el editor dibuja en el navegador la apaisada del
-- marco de redes (1200×630: logo, chapa NOTICIA, título y portada), la sube a
-- `guide-images` y guarda aquí su dirección. `meta-social.js` la pone de
-- og:image y twitter:image, así que al pegar el enlace en X, WhatsApp o
-- Telegram sale con la marca y no la portada pelada.
--
-- Hasta que se ejecute, nada se rompe: el editor no la escribe (lo dice en la
-- consola) y meta-social la pide con vuelta atrás a la consulta de siempre.
-- Las políticas de `guides` ya dejan escribir a quien puede guardar la noticia.
alter table public.guides add column if not exists og_image text;

comment on column public.guides.og_image is
  'Tarjeta del enlace (1157): la apaisada del marco de redes, 1200×630, que dibuja el editor al publicar una noticia. meta-social.js la usa de og:image.';
