# Propuesta «PokeDoc como app» (noche del 25-10-2026)

Los prototipos de la propuesta no son dibujos: son CSS (y un poco de DOM) que se
inyecta sobre la web real servida por el stub y se fotografía antes y después,
en móvil (390×844) y PC (1440×900).

- `comun.mjs`: fixtures y rutas de imágenes de las capturas.
- `propuestas.mjs`: `SHELL` (A1, la fila de pestañas en vez de la burbuja), `CAB`
  (A2, cabecera de detalle), `ACENTO` (C) y la lista `PROPUESTAS` con el CSS/JS de cada una.
- `despues.mjs [id…]`: captura `prop/<id>-<antes|despues>-<movil|pc>.png`
  (`SOLO_MOVIL=1` para solo el móvil). Las fuentes de Google van inline en `fuentes/`.
- `dom.mjs <ruta> [movil|pc] [tope]`: esquema del DOM visible, para escribir inyecciones.
- `montar.py`: `propuesta-app.src.html` + `{{img:ID}}` → `propuesta-app.html` + `img/`.

Artifact publicado: https://claude.ai/artifact/8rb55os45sKstBwDRQmrHF
