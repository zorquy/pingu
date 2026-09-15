"""Rigor de la tanda 268: se rompe cada pieza del arreglo y se comprueba
que test-tanda-268 se entera. En segundo plano SIEMPRE: si esto se corta
a mitad, el repo se queda con una mutación puesta."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'
FICH = os.path.join(REPO, 'js/richtext-editor.js')

MUTACIONES = [
    ('las figuras y las filas vuelven a ser editables',
     "      if (pieza.getAttribute('contenteditable') !== 'false') pieza.setAttribute('contenteditable', 'false')",
     "      if (false) pieza.setAttribute('contenteditable', 'false')"),

    ('el pie de foto se queda sin poder escribirse',
     "      if (pie.getAttribute('contenteditable') !== 'true') pie.setAttribute('contenteditable', 'true')",
     "      pie.setAttribute('contenteditable', 'false')"),

    ('Backspace debajo de una pieza vuelve al borrado del navegador',
     "      if (esBloqueOpaco(previo)) {\n        e.preventDefault()",
     "      if (false && esBloqueOpaco(previo)) {\n        e.preventDefault()"),

    ('Backspace quita la pieza a la primera, sin enseñarla',
     "        const yaElegida = seleccionado && previo.contains(contenedor(seleccionado))\n        if (yaElegida) {",
     "        const yaElegida = true\n        if (yaElegida) {"),

    ('Supr encima de una pieza deja de tener trato',
     "    if (esBloqueOpaco(siguiente)) {\n      e.preventDefault()",
     "    if (false && esBloqueOpaco(siguiente)) {\n      e.preventDefault()"),

    ('el Ctrl+A propio desaparece',
     "    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'a' || e.key === 'A')) {",
     "    if (false && (e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'a' || e.key === 'A')) {"),

    ('el borrado a mano de la selección se rinde siempre',
     "    if (!piezas.some((pieza) => r.intersectsNode(pieza))) return false",
     "    return false"),

    ('una figura vacía se queda siendo figura',
     "      if (fig.querySelector('img, tcg-deck, yt-video')) continue",
     "      continue"),

    ('el artículo puede terminar en pieza, sin sitio donde escribir',
     "    const ultimo = surfaceEl.lastElementChild\n    if (ultimo && esBloqueOpaco(ultimo)) {",
     "    const ultimo = surfaceEl.lastElementChild\n    if (false && ultimo && esBloqueOpaco(ultimo)) {"),

    ('las flechas dentro de una fila vuelven a mover la fila entera',
     "      if (filaDeLaCaja && (accion === 'subir' || accion === 'bajar')) {",
     "      if (false && filaDeLaCaja && (accion === 'subir' || accion === 'bajar')) {"),

    ('en el borde de la fila la carta ya no sale',
     "        if (alPrincipio || alFinal) {",
     "        if (false) {"),

    ('quitar una carta deja el hueco en la fila',
     "        caja.remove()\n        encogerColumnas(suFila)",
     "        caja.remove()"),

    ('pinchar en una pieza deja de colocar el cursor',
     "    const pieza = piezaDeBloque(e.target)\n    if (!pieza) return\n    e.preventDefault()",
     "    const pieza = piezaDeBloque(e.target)\n    if (true || !pieza) return\n    e.preventDefault()"),

    ('el cursor cae siempre por debajo de la pieza',
     "    cursorJuntoA(pieza, e.clientY < caja.top + caja.height / 2, !enLaImagen)",
     "    cursorJuntoA(pieza, false, !enLaImagen)"),

    ('el repaso al abrir la guía se quita',
     "  sanearEstructura()\n\n  // Al abrir el editor con una guía que ya tenía listas",
     "  // Al abrir el editor con una guía que ya tenía listas"),
]

original = open(FICH).read()
sin_detectar = []
try:
    for nombre, viejo, nuevo in MUTACIONES:
        if original.count(viejo) != 1:
            print(f'⚠️  ANCLA MALA ({original.count(viejo)} veces): {nombre}', flush=True)
            sin_detectar.append(nombre + ' (ancla mala)')
            continue
        open(FICH, 'w').write(original.replace(viejo, nuevo))
        subprocess.run([os.path.join(SC, 'sync-forum.sh')], capture_output=True)
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-268.mjs')],
                           capture_output=True, text=True, cwd=SC)
        if r.returncode == 0:
            print(f'❌ SIN DETECTAR: {nombre}', flush=True)
            sin_detectar.append(nombre)
        else:
            print(f'✅ detectada ({r.stdout.count("FALLA")} fallos): {nombre}', flush=True)
finally:
    open(FICH, 'w').write(original)
    subprocess.run([os.path.join(SC, 'sync-forum.sh')], capture_output=True)

if sin_detectar:
    print(f'\n❌ {len(sin_detectar)} sin detectar:')
    for n in sin_detectar:
        print('  -', n)
    sys.exit(1)
print(f'\n✅ Las {len(MUTACIONES)} mutaciones detectadas')
