#!/bin/bash
# La suite. Reconstruida tras perderse el entorno el 2026-08-28: hoy
# cubre torneos (tandas 223, 229 y 230) y el foro (tanda 226). Las pruebas de
# foro, guías y cursos se perdieron con el contenedor y NO están aquí.
SC=/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad
cd "$SC"
PRUEBAS="test-sprites.mjs test-partidas.mjs test-partidas-pagina.mjs test-torneos-22.mjs test-torneos-23.mjs test-meta-torneo.mjs test-torneos-21.mjs test-torneos-20.mjs test-vivo.mjs test-sondeo.mjs test-foro-1.mjs test-foro-2.mjs test-torneos-19.mjs test-torneos-18.mjs test-torneos-17.mjs test-torneos-16.mjs test-torneos-15.mjs"
> suite.log
for p in $PRUEBAS; do
  [ -f "$p" ] || { echo "AUSENTE $p" >> suite.log; continue; }
  if /opt/node22/bin/node "$p" > "/tmp/suite-$p.out" 2>&1; then
    echo "VERDE  $p" >> suite.log
  else
    echo "ROJO   $p" >> suite.log
    grep -h "FALLA" "/tmp/suite-$p.out" | head -6 >> suite.log
  fi
done
echo "FIN" >> suite.log
