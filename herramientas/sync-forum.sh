#!/bin/bash
# Copia el sitio al entorno de pruebas conservando el doble de Supabase.
#
# El stub NO puede vivir en el repo (norma de CLAUDE.md), así que se
# guarda aparte y se vuelve a poner en su sitio después de cada copia.
SC=/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad
REPO=/home/user/pingu
# Los dobles salen del ARBOL de la rama `pruebas`, que es donde viven de
# verdad. Hasta la tanda 419 se copiaban de una copia suelta en el
# scratchpad, y esa copia se queda vieja sin que nada lo cante: la del
# 2026-10-01 no tenia el juez de la 394 ni la proyeccion de la 413, asi
# que la prueba 394 salio ROJA por el doble y no por la web. Es el mismo
# fallo que tenia correr-suite.sh con las copias de las pruebas.
WT=${WT:-/tmp/wt-pruebas}
mkdir -p "$SC/test-forum"
rm -rf "$SC/test-forum"
mkdir -p "$SC/test-forum"
(cd "$REPO" && tar --exclude=node_modules --exclude=.git -cf - .) | tar -xf - -C "$SC/test-forum"
cp "$WT/herramientas/stub-supabase.js" "$SC/test-forum/js/supabase.js"
# El vivo también se sustituye: el de verdad abre un websocket contra el
# Supabase de PRODUCCIÓN, y eso una prueba no lo puede hacer.
cp "$WT/herramientas/stub-vivo.js" "$SC/test-forum/js/vivo.js"
# La página del laboratorio del editor de texto: monta initRichTextEditor a
# pelo, sin guía ni foro alrededor. No puede vivir en el repo (es prueba),
# así que entra aquí después de cada copia, igual que los dobles.
cp "$WT/rte-lab.html" "$SC/test-forum/rte-lab.html"
cp -r "$WT/fotos" "$SC/test-forum/fotos"
# La página para mirar cómo queda la portada de un vídeo.
cp "$WT/yt-lab.html" "$SC/test-forum/yt-lab.html"
