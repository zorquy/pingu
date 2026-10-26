# Propuesta «PokeDoc, contenido primero» (26-10-2026)

PINGU: «hay muchos sitios con demasiadas cosas en pantalla antes de ver el
contenido». Barrido del móvil (iPhone 390×844, oscuro, con sesión) y maquetas
del «después» como CSS/DOM inyectado sobre la web real servida por el stub.

- `barrido.mjs`: la primera pantalla de las 32 páginas → `antes/`.
- `arriba.mjs <tope> <rutas…>`: lo de arriba de una página (sin svg), para escribir inyecciones.
- `propuestas.mjs`: `COMUN` (chips de 36 px con 44 de toque) y `PROPUESTAS` (css, js y el
  selector `contenido` con el que se mide dónde empieza lo que se viene a ver).
- `despues.mjs [id…]`: `prop/<id>-<antes|despues>-<movil|pc>.png` y `medidas.json`.
- `montar.py <dir>`: `compacta.src.html` + `{{img:ID}}` → `<dir>/compacta.html` + `img/*.jpg`.
- `hoja.py`: hojas de contactos para mirarlas en parejas.

Artifact: https://claude.ai/artifact/SXrQvs5nhgHPZKMuLJzRre
