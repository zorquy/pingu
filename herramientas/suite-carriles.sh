#!/bin/bash
# La suite en carriles (tanda 825, Q1). Entera y en serie llevaba horas: aquí
# se reparte en N copias del sitio, cada una con su servidor (puertos 8901…),
# su log y su lista, y al acabar se juntan los logs en uno.
#
#   bash suite-carriles.sh 3                    # todas, en 3 carriles
#   bash suite-carriles.sh 3 test-tanda-3*.mjs  # solo esas
#
# Cada carril usa SU copia (PD_BASE), así que no se pisan entre ellos ni con
# la suite de siempre (8892). Las pruebas que leen el repo leen el mismo
# /home/user/pingu: NO edites el repo mientras corre.
N=${1:-3}; shift
SC=/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad
WT=${WT:-/tmp/wt-pruebas}
PR=$WT/pruebas
cd "$PR" || exit 1
if [ $# -gt 0 ]; then LISTA="$*"; else
  LISTA="$(ls test-*.mjs | grep -v '^test-tanda-' | sort) $(ls test-tanda-*.mjs | sort -t- -k3 -n)"
fi
PIDS=()
for c in $(seq 1 "$N"); do
  D="$SC/carril-$c"; PUERTO=$((8900 + c))
  rm -rf "$D"; mkdir -p "$D"
  (cd /home/user/pingu && tar --exclude=node_modules --exclude=.git -cf - .) | tar -xf - -C "$D"
  cp "$WT/herramientas/stub-supabase.js" "$D/js/supabase.js"
  cp "$WT/herramientas/stub-vivo.js" "$D/js/vivo.js"
  cp "$WT/rte-lab.html" "$WT/yt-lab.html" "$D/" 2>/dev/null; cp -r "$WT/fotos" "$D/fotos" 2>/dev/null
  sed -e "s#^RAIZ = .*#RAIZ = '$D'#" -e "s/8892/$PUERTO/" "$WT/herramientas/servir.py" > "$SC/servir-carril-$c.py"
  python3 "$SC/servir-carril-$c.py" & PIDS+=($!)
done
sleep 1
i=0
for p in $LISTA; do echo "$p" >> "$SC/carril-$(( i % N + 1 )).lista.tmp"; i=$((i+1)); done
TRABAJOS=()
for c in $(seq 1 "$N"); do
  ( > "$SC/carril-$c.log"
    for p in $(cat "$SC/carril-$c.lista.tmp" 2>/dev/null); do
      if PD_SITIO="$SC/carril-$c" PD_BASE="http://localhost:$((8900 + c))" /opt/node22/bin/node "$PR/$p" > "/tmp/carril-$p.out" 2>&1; then echo "VERDE  $p" >> "$SC/carril-$c.log"
      else echo "ROJO   $p" >> "$SC/carril-$c.log"; grep -h "FALLA" "/tmp/carril-$p.out" | head -6 >> "$SC/carril-$c.log"; fi
    done ) & TRABAJOS+=($!)
done
wait "${TRABAJOS[@]}"
for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null; done
cat "$SC"/carril-*.log > "$SC/carriles.log"; rm -f "$SC"/carril-*.lista.tmp
echo "FIN: $(grep -c '^VERDE' "$SC/carriles.log") verdes, $(grep -c '^ROJO' "$SC/carriles.log") rojos" | tee -a "$SC/carriles.log"
