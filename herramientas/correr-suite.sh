#!/bin/bash
# La suite. Reconstruida tras perderse el entorno el 2026-08-28: hoy
# cubre torneos (tandas 223, 229 y 230) y el foro (tanda 226). Las pruebas de
# foro, guías y cursos se perdieron con el contenedor y NO están aquí.
SC=/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad
cd "$SC"
PRUEBAS="test-migraciones.mjs test-tcgdex-codigo.mjs test-selector-mazo.mjs test-sets-live.mjs test-decklist-idiomas.mjs test-sprites.mjs test-partidas.mjs test-partidas-pagina.mjs test-torneos-22.mjs test-torneos-23.mjs test-meta-torneo.mjs test-torneos-21.mjs test-torneos-20.mjs test-vivo.mjs test-sondeo.mjs test-foro-1.mjs test-foro-2.mjs test-torneos-19.mjs test-torneos-18.mjs test-torneos-17.mjs test-torneos-16.mjs test-torneos-15.mjs test-tanda-247.mjs test-tanda-248.mjs test-correos.mjs test-tanda-251.mjs test-tanda-252.mjs test-tanda-253.mjs test-tanda-254.mjs test-tanda-255.mjs test-tanda-256.mjs test-tanda-261.mjs test-tanda-262.mjs test-tanda-266.mjs test-tanda-267.mjs test-tanda-268.mjs test-tanda-269.mjs test-tanda-270.mjs test-tanda-271.mjs test-tanda-272.mjs test-tanda-273.mjs test-tanda-275.mjs test-tanda-276.mjs test-tanda-277.mjs test-tanda-278.mjs test-tanda-280.mjs test-tanda-282.mjs test-tanda-286.mjs test-tanda-287.mjs test-tanda-288.mjs test-tanda-289.mjs test-tanda-290.mjs test-tanda-291.mjs test-tanda-292.mjs test-tanda-293.mjs test-tanda-294.mjs test-tanda-295.mjs test-tanda-296.mjs test-tanda-297.mjs test-tanda-298.mjs test-tanda-299.mjs test-tanda-300.mjs test-tanda-301.mjs test-tanda-302.mjs test-tanda-305.mjs test-tanda-306.mjs test-tanda-308.mjs test-noticias.mjs test-ficha-guia.mjs test-tanda-309.mjs test-tanda-310.mjs test-tanda-311.mjs test-tanda-312.mjs test-tanda-313.mjs test-tanda-314.mjs test-tanda-315.mjs test-tanda-316.mjs test-tanda-319.mjs test-tanda-320.mjs test-tanda-321.mjs test-tanda-322.mjs test-tanda-323.mjs test-tanda-324.mjs test-tanda-325.mjs test-tanda-326.mjs test-tanda-327.mjs test-tanda-328.mjs"
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
