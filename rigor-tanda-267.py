#!/opt/homebrew/bin/python3
"""Rigor de la tanda 267: se rompe el editor a propósito, pieza por pieza,
y se comprueba que test-tanda-267 se entera. Una prueba que sigue verde con
el código roto no está probando nada.

Se ejecuta SIEMPRE en segundo plano: si algo la corta a mitad, el repo se
queda con una mutación puesta."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'
FICH = os.path.join(REPO, 'js/richtext-editor.js')

# (nombre, texto original, texto mutado)
MUTACIONES = [
    ('sin desmontar el párrafo entero en asegurarFigura',
     "if (el.tagName === 'IMG' && imagenesDeBloque(bloqueDe(el)).length > 1) {",
     "if (false && el.tagName === 'IMG' && imagenesDeBloque(bloqueDe(el)).length > 1) {"),

    ('las figuras salen del párrafo en orden inverso',
     "    p.replaceWith(...figuras)\n    return figuras",
     "    p.replaceWith(...[...figuras].reverse())\n    return figuras"),

    ('un párrafo con varias imágenes deja de contar como pila de imágenes',
     "    return [...el.querySelectorAll('img')]\n  }",
     "    const t = [...el.querySelectorAll('img')]\n    return t.length === 1 ? t : []\n  }"),

    ('la fila se planta antes del párrafo y no de la primera figura',
     "    figuras[0].before(fila)",
     "    figuras[0].parentNode.insertBefore(fila, figuras[0].parentNode.firstChild)"),

    ('se avisa de que no se puede aunque haya imágenes de sobra',
     "    if (elegidas.length < 2) {",
     "    if (elegidas.length < 99) {"),

    ('el aviso vuelve a mover la imagen antes de rendirse',
     "      showToast('Para hacer una fila hace falta otra imagen justo detrás, sin texto en medio.')\n      return",
     "      figuraDeImagen(seleccionado)\n      showToast('Para hacer una fila hace falta otra imagen justo detrás, sin texto en medio.')\n      emit()\n      return"),

    ('la fila empieza en la primera del párrafo y no en la elegida',
     "      if (desde < 0) lista.push(seleccionado)\n      else for (const img of hermanas.slice(desde)) if (lista.length < n) lista.push(img)",
     "      if (desde < 0) lista.push(seleccionado)\n      else for (const img of hermanas) if (lista.length < n) lista.push(img)"),

    ('no se deja cursor detrás de la fila',
     "    ponerCursorEn(fila.nextElementSibling)\n    seleccionar(seleccionado)",
     "    seleccionar(seleccionado)"),

    ('recolocar columnas se salta lo elegido a mano',
     "    if (columnasAMano.has(fila)) return\n    const cuantas",
     "    const cuantas"),

    ('las imágenes nuevas se tratan sobre la marcha, no recogidas antes',
     "      for (const img of nuevas) {",
     "      for (const img of [...surfaceEl.querySelectorAll('img')].filter((i) => nuevas.includes(i) || true)) {"),

    ('un párrafo con texto también se desmonta',
     "    if (!el || el.tagName !== 'P' || el.textContent.trim()) return []",
     "    if (!el || el.tagName !== 'P') return []"),

    ('la fila se queda siempre en dos columnas',
     "    fila.setAttribute('data-cols', String(Math.max(2, figuras.length)))",
     "    fila.setAttribute('data-cols', '2')"),
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
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-267.mjs')],
                           capture_output=True, text=True, cwd=SC)
        if r.returncode == 0:
            print(f'❌ SIN DETECTAR: {nombre}', flush=True)
            sin_detectar.append(nombre)
        else:
            fallos = r.stdout.count('FALLA')
            print(f'✅ detectada ({fallos} fallos): {nombre}', flush=True)
finally:
    open(FICH, 'w').write(original)
    subprocess.run([os.path.join(SC, 'sync-forum.sh')], capture_output=True)

if sin_detectar:
    print(f'\n❌ {len(sin_detectar)} sin detectar:')
    for n in sin_detectar:
        print('  -', n)
    sys.exit(1)
print('\n✅ Las 12 mutaciones detectadas')
