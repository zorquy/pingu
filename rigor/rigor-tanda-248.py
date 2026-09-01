#!/usr/bin/env python3
# Rigor de la tanda 248. SIEMPRE en segundo plano.
import subprocess, sys, os

REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'

MUTACIONES = [
    # La regresión exacta que se acaba de arreglar.
    ('vuelve a meter las cerradas en «En juego»', 'js/torneos/torneos.js',
     "const enJuego = torneos.filter((t) => t.status === 'in_progress').map((t) => tarjeta(t))",
     "const enJuego = torneos.filter((t) => ['registration_closed', 'in_progress'].includes(t.status)).map((t) => tarjeta(t))"),

    ('«Por empezar» se queda vacía', 'js/torneos/torneos.js',
     "const porEmpezar = torneos.filter((t) => t.status === 'registration_closed').map((t) => tarjeta(t))",
     "const porEmpezar = []"),

    ('«Por empezar» se traga también las abiertas', 'js/torneos/torneos.js',
     "const porEmpezar = torneos.filter((t) => t.status === 'registration_closed').map((t) => tarjeta(t))",
     "const porEmpezar = torneos.filter((t) => ['registration_open', 'registration_closed'].includes(t.status)).map((t) => tarjeta(t))"),

    ('la pestaña nueva desaparece del menú', 'js/torneos/torneos.js',
     "    { id: 'porempezar', texto: 'Por empezar', filas: porEmpezar },\n",
     ""),

    ('la pestaña nueva se va detrás de «En juego»', 'js/torneos/torneos.js',
     "    { id: 'porempezar', texto: 'Por empezar', filas: porEmpezar },\n    { id: 'enjuego', texto: 'En juego', filas: enJuego },",
     "    { id: 'enjuego', texto: 'En juego', filas: enJuego },\n    { id: 'porempezar', texto: 'Por empezar', filas: porEmpezar },"),

    ('se pintan las pestañas vacías', 'js/torneos/torneos.js',
     "  const conAlgo = grupos.filter((g) => g.filas.length)",
     "  const conAlgo = grupos"),

    # El perfil.
    ('el perfil vuelve a decir que juegas lo que no ha empezado', 'js/perfil.js',
     "else if (t.status === 'in_progress' && inscrito !== 'dropped') jugando.push(t)",
     "else if (['registration_closed', 'in_progress'].includes(t.status) && inscrito !== 'dropped') jugando.push(t)"),

    ('el perfil pierde las cerradas por el camino', 'js/perfil.js',
     "else if (['registration_open', 'registration_closed'].includes(t.status) && inscrito !== 'dropped') apuntado.push(t)",
     "else if (t.status === 'registration_open' && inscrito !== 'dropped') apuntado.push(t)"),

    ('el perfil no separa: todo a «Jugando ahora»', 'js/perfil.js',
     "    else if (t.status === 'in_progress' && inscrito !== 'dropped') jugando.push(t)\n    else if (['registration_open', 'registration_closed'].includes(t.status) && inscrito !== 'dropped') apuntado.push(t)",
     "    else if (inscrito !== 'dropped') jugando.push(t)"),
]

def correr():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-tanda-248.mjs'],
                       capture_output=True, text=True, timeout=600)
    return r.returncode, r.stdout

no_detectadas = []
for i, (nombre, fichero, viejo, nuevo) in enumerate(MUTACIONES, 1):
    ruta = os.path.join(REPO, fichero)
    original = open(ruta).read()
    if original.count(viejo) != 1:
        print(f'{i:2}. ⚠️  ANCLA MALA ({original.count(viejo)}): {nombre}', flush=True)
        continue
    try:
        open(ruta, 'w').write(original.replace(viejo, nuevo))
        codigo, salida = correr()
        if codigo == 0:
            print(f'{i:2}. ❌ NO DETECTADA: {nombre}', flush=True)
            no_detectadas.append(nombre)
        else:
            print(f'{i:2}. ✅ pillada ({salida.count("FALLA")} fallos): {nombre}', flush=True)
    finally:
        open(ruta, 'w').write(original)

subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
print()
if no_detectadas:
    print(f'❌ {len(no_detectadas)} sin detectar:')
    for n in no_detectadas: print('   ·', n)
    sys.exit(1)
print(f'✅ Las {len(MUTACIONES)} mutaciones detectadas.')
