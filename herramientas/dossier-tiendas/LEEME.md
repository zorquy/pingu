# Dossier y capturas de /para-tiendas (tanda 1281)

Con el sitio servido (`sync-forum.sh` + `npx serve -l 8892 test-forum`) y las
cartas reales en `test-forum/carrusel-arte/real-*.webp`:

1. `node capturas.mjs <carpeta>` — el panel de una tienda (PC y móvil).
   Las del escaparate, el pop-up y el Mercado: `../carrusel-tiendas/pantallas-tienda.mjs`.
2. `node convertir.mjs <carpeta> <sitio>/dossier-capturas jpeg 1300 0.76` — para el PDF.
3. `node hacer.mjs <salida.pdf>` — imprime `dossier.html` en A4. Va a `descargas/` de la web.
4. `node web.mjs <carpeta> /home/user/pingu/assets/tiendas` — las webp de la página.

Antes de `hacer.mjs`, en el sitio servido: `node fondos.mjs <sitio>/dossier-fondos` y las
letras estáticas de @fontsource (Inter y Outfit, 400–800, `latin-*-normal.woff2`) en
`<sitio>/dossier-fuentes/` (`npm pack @fontsource/inter @fontsource/outfit`).
