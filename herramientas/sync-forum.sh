#!/bin/bash
# Copia el sitio al entorno de pruebas conservando el doble de Supabase.
#
# El stub NO puede vivir en el repo (norma de CLAUDE.md), así que se
# guarda aparte y se vuelve a poner en su sitio después de cada copia.
SC=/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad
REPO=/home/user/pingu
mkdir -p "$SC/test-forum"
rm -rf "$SC/test-forum"
mkdir -p "$SC/test-forum"
(cd "$REPO" && tar --exclude=node_modules --exclude=.git -cf - .) | tar -xf - -C "$SC/test-forum"
cp "$SC/stub-supabase.js" "$SC/test-forum/js/supabase.js"
# El vivo también se sustituye: el de verdad abre un websocket contra el
# Supabase de PRODUCCIÓN, y eso una prueba no lo puede hacer.
cp "$SC/stub-vivo.js" "$SC/test-forum/js/vivo.js"
