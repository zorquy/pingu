#!/usr/bin/env python3
# Rigor de la tanda 253. SIEMPRE en segundo plano.
import subprocess, sys, os
REPO = '/home/user/pingu'; SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
P = 'js/perfil.js'

M = [
    ('vuelve el fallo: solo #torneos abre pestaña', P,
     "const pestanaDelHash = window.location.hash.replace('#', '')",
     "const pestanaDelHash = window.location.hash === '#torneos' ? 'torneos' : ''"),

    # NO se muta el escapado del hash, porque ya no hay escapado que
    # mutar. Se probó `CSS.escape(...)` → `...` y NINGUNA prueba lo
    # detectaba, con razón: el navegador codifica SIEMPRE las comillas
    # en el fragmento (comprobado), así que ninguna entrada podía
    # romper el selector. Era una defensa contra algo imposible. En vez
    # de dejar una rama que nada ejercita, se quitó el selector
    # construido: ahora se busca el botón entre los que hay y no hay
    # dónde colar nada.
    ('el hash abre una pestaña que no existe', P,
     "  const boton = [...document.querySelectorAll('#profileTabs .tab-btn')].find((b) => b.dataset.ptab === pestanaDelHash)",
     "  const boton = [...document.querySelectorAll('#profileTabs .tab-btn')][0]"),

    ('el aviso ya no abre la corrección', P,
     "  if (pedida && (sugerencias[pedida] || []).length) {",
     "  if (false) {"),

    ('se abre el panel de una guía SIN correcciones', P,
     "  if (pedida && (sugerencias[pedida] || []).length) {",
     "  if (pedida) {"),

    ('el parámetro se queda en la URL y reabre al recargar', P,
     "      window.history.replaceState({}, '', limpia)", "      void limpia"),

    ('se abre el panel de otra guía cualquiera', P,
     "    const guia = myGuidesCache.find((g) => g.id === pedida)\n    if (guia) {",
     "    const guia = myGuidesCache[0]\n    if (guia) {"),
]

def correr():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-tanda-253.mjs'], capture_output=True, text=True, timeout=600)
    return r.returncode, r.stdout

sin = []
for i, (nombre, f, viejo, nuevo) in enumerate(M, 1):
    ruta = os.path.join(REPO, f); original = open(ruta).read()
    if original.count(viejo) != 1:
        print(f'{i}. ⚠️ ANCLA MALA ({original.count(viejo)}): {nombre}', flush=True); sin.append(nombre); continue
    try:
        open(ruta, 'w').write(original.replace(viejo, nuevo))
        codigo, salida = correr()
        if codigo == 0:
            print(f'{i}. ❌ NO DETECTADA: {nombre}', flush=True); sin.append(nombre)
        else:
            print(f'{i}. ✅ pillada ({salida.count("FALLA")} fallos): {nombre}', flush=True)
    finally:
        open(ruta, 'w').write(original)
subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
print()
if sin:
    print(f'❌ {len(sin)} sin detectar:')
    for n in sin: print('   ·', n)
    sys.exit(1)
print(f'✅ Las {len(M)} mutaciones detectadas.')
