#!/bin/bash
# ¿Quedó alguna mutación de un rigor sin deshacer? Se pasa ANTES de
# cualquier commit: un contenedor que se muere a mitad de una pasada deja
# el fichero roto en disco y el árbol con pinta de estar listo.
SC=/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad
if [ -f "$SC/rigor-sin-restaurar.json" ]; then
  echo "❌ HAY UNA MUTACIÓN SIN DESHACER. Ficheros afectados:"
  python3 -c "import json;print('\n'.join('  - '+k for k in json.load(open('$SC/rigor-sin-restaurar.json'))))"
  echo "Pásale: python3 -c \"import sys;sys.path.insert(0,'$SC');import rigor_comun;print(rigor_comun.rescatar())\""
  exit 1
fi
echo "✅ Sin mutaciones a medias"
