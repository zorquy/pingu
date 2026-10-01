#!/bin/bash
# La suite. Reconstruida tras perderse el entorno el 2026-08-28.
#
# Tanda 405: las pruebas se cogen DEL WORKTREE de la rama `pruebas`, que es
# donde viven de verdad, y no de las copias que hubiera en el scratchpad.
# Antes la lista era una lista escrita a mano y corría lo que encontrase en
# el directorio de trabajo: las pruebas que nunca se copiaron allí salían
# «AUSENTE» y las nuevas no estaban ni en la lista — la 398, la 399, la
# 400, la 402, la 403 y la 405 no se habían corrido NI UNA VEZ en la suite.
# Una lista curada a mano se queda vieja; el directorio no.
SC=/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad
PR=/tmp/wt-pruebas/pruebas
cd "$SC" || exit 1
> suite.log
# Orden: primero las de siempre (torneos y foro, que son las más largas) y
# luego las de tanda por número, para que un fallo de lo nuevo se lea al
# final y no haya que buscarlo.
PRUEBAS=$(cd "$PR" && ls test-*.mjs | grep -v '^test-tanda-' | sort)
PRUEBAS="$PRUEBAS $(cd "$PR" && ls test-tanda-*.mjs 2>/dev/null | sort -t- -k3 -n)"
for p in $PRUEBAS; do
  [ -f "$PR/$p" ] || { echo "AUSENTE $p" >> suite.log; continue; }
  if /opt/node22/bin/node "$PR/$p" > "/tmp/suite-$p.out" 2>&1; then
    echo "VERDE  $p" >> suite.log
  else
    echo "ROJO   $p" >> suite.log
    grep -h "FALLA" "/tmp/suite-$p.out" | head -6 >> suite.log
  fi
done
echo "FIN" >> suite.log
