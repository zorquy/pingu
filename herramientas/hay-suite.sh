#!/bin/bash
# ¿Hay una suite corriendo? (tanda 510)
#
# Existe porque preguntarlo A MANO no funciona: `pgrep -f correr-suite`
# casa con la propia orden que lo pregunta, así que contesta «sí» siempre.
# Me ha pasado TRES veces esta noche —una con `pkill`, dos con `pgrep`— y
# la tercera después de escribir la norma. Dentro de un fichero, la línea
# de comandos del que pregunta no lleva el patrón.
otras=$(pgrep -f 'herramientas/correr-suite' | grep -vx "$$")
if [ -n "$otras" ]; then echo "SÍ (PID $otras)"; exit 0; fi
echo "NO"; exit 1
