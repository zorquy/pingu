#!/bin/bash
# Deja el scratchpad apuntando a esta rama (tanda 422).
#
# Los rigores viejos —y algunos trozos de los nuevos— buscan la prueba y
# el script de copia en $SC, porque cuando se escribieron las pruebas
# vivían ahí. Lo que ahí había eran COPIAS, y una copia se queda vieja sin
# que nada lo cante: el 2026-10-01 el doble de Supabase del scratchpad no
# tenía ni el juez de la 394 ni la proyección de la 413 (dos pruebas rojas
# que parecían una regresión de torneos), y de las pruebas no quedaba NI
# UNA. Y una prueba que no está hace que `node` salga con código 1, que es
# justo lo que un rigor lee como «mutación detectada»: TODAS detectadas,
# siempre, sin que nada falle.
#
# Aquí se ponen ENLACES en vez de copias. Un enlace no se queda viejo, que
# era el único problema. Esto se corre una vez por contenedor; cambiar los
# 78 rigores de sitio sería una transformación en bloque sobre ficheros
# que nadie va a releer, y el riesgo no compensa.
SC=/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad
WT=${WT:-/tmp/wt-pruebas}
mkdir -p "$SC"
enlazar() { ln -sfn "$1" "$SC/$(basename "$1")"; }
enlazar "$WT/herramientas/sync-forum.sh"
enlazar "$WT/herramientas/stub-supabase.js"
enlazar "$WT/herramientas/stub-vivo.js"
enlazar "$WT/herramientas/medir-carga.mjs"
enlazar "$WT/rigor/rigor_comun.py"
enlazar "$WT/rte-lab.html"
enlazar "$WT/yt-lab.html"
ln -sfn "$WT/fotos" "$SC/fotos"
for p in "$WT"/pruebas/*.mjs "$WT"/pruebas/*.json; do [ -e "$p" ] && enlazar "$p"; done
echo "Enlazados: $(ls -l "$SC" | grep -c '^l') ficheros apuntando a $WT"
