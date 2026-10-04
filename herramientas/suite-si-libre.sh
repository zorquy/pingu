#!/bin/bash
# Correr la suite SOLO si no hay otra corriendo (tanda 510).
#
# ── POR QUÉ ES UN FICHERO Y NO UN `if` EN LA ORDEN ──
#
# Porque `pgrep -f "correr-suite.sh"` **casa con la propia orden que lo
# pregunta**: la cadena está en su línea de comandos. Lo escribí a mano en
# una orden suelta y el guardarraíl se negó a arrancar contra sí mismo,
# diciendo «ya hay una corriendo» cuando no había ninguna.
#
# Es la trampa de la tanda 312 —al barrer en busca de una cadena, todo lo
# que la CONTIENE cuenta— aplicada a procesos, y es la SEGUNDA vez esta
# noche. Dentro de un fichero, la línea de comandos del que comprueba es
# `bash suite-si-libre.sh` y no contiene el patrón, así que la pregunta
# vuelve a significar lo que dice.
#
# Y sincronizar la copia va AQUÍ DENTRO y después de la comprobación:
# `sync-forum.sh` borra y recopia el árbol, así que hacerlo mientras otra
# pasada lo lee le cambia los ficheros debajo.
HERR=/tmp/wt-pruebas/herramientas
SC=/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad

otras=$(pgrep -f 'herramientas/correr-suite' | grep -vx "$$")
if [ -n "$otras" ]; then
  echo "YA HAY UNA SUITE CORRIENDO (PID $otras) — no se lanza otra."
  exit 1
fi

if ! curl -s -o /dev/null --max-time 5 http://localhost:8892/index.html; then
  echo "El servidor del 8892 no responde; levantándolo…"
  (cd "$HERR" && nohup /usr/bin/python3 servir.py >/tmp/servir-8892.log 2>&1 &)
  sleep 2
fi

bash "$HERR/sync-forum.sh" >/dev/null 2>&1
bash "$HERR/correr-suite.sh" >/dev/null 2>&1
echo "=== SUITE ==="
echo "VERDES: $(grep -c VERDE "$SC/suite.log")  ROJOS: $(grep -c ROJO "$SC/suite.log")"
grep -A4 ROJO "$SC/suite.log"
