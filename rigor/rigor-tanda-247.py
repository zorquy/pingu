#!/usr/bin/env python3
# Rigor de la tanda 247: se rompe el código A PROPOSITO, una cosa cada
# vez, y se comprueba que la suite lo pilla. Una prueba que pasa igual
# con el código roto no prueba nada.
#
# SIEMPRE en segundo plano: si esto se muere a medias deja el repo con
# una mutación puesta (ya ha pasado dos veces).
import subprocess, sys, os

REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'

MUTACIONES = [
    ('tema: el equipo deja de poder borrar', 'js/tema.js',
     '  if (soyStaff) return true\n  return tema.author_id === sesion.user.id',
     '  if (soyStaff) return false\n  return tema.author_id === sesion.user.id'),

    ('tema: el autor puede borrar aunque le hayan contestado', 'js/tema.js',
     "return tema.author_id === sesion.user.id && (tema.post_count || 0) <= 1",
     "return tema.author_id === sesion.user.id"),

    ('tema: el panel solo sale para el equipo (el autor pierde su botón)', 'js/tema.js',
     "${soyStaff || puedoBorrarTema() ? panelModeracionHtml() : ''}",
     "${soyStaff ? panelModeracionHtml() : ''}"),

    ('tema: se borra al primer clic, sin preguntar', 'js/tema.js',
     "  if (btn.dataset.confirmar !== '1') {",
     "  if (false) {"),

    ('tema: la confirmación no dice cuántas respuestas se pierden', 'js/tema.js',
     "    btn.textContent = respuestas\n      ? `¿Seguro? Se van también ${respuestas} respuesta${respuestas === 1 ? '' : 's'}`\n      : '¿Seguro? No hay vuelta atrás'",
     "    btn.textContent = '¿Seguro? No hay vuelta atrás'"),

    ('tema: el DELETE no pide de vuelta lo borrado', 'js/tema.js',
     ".delete().eq('id', tema.id).select('id')",
     ".delete().eq('id', tema.id)"),

    ('tema: no se comprueba que se haya borrado alguna fila', 'js/tema.js',
     "  if (error || !data?.length) {",
     "  if (error) {"),

    ('tema: borrar no te devuelve al foro', 'js/tema.js',
     "  window.location.href = foro ? urlForo(foro.slug) : '/foro.html'",
     "  return"),

    ('anuncio: se elige siempre el primer foro de la lista', 'js/torneos/anuncio-foro.js',
     "    lista.find((f) => deJuego(f) && deTorneos(f)) ||\n    lista.find(deTorneos) ||\n    lista.find(deJuego) ||\n    lista[0] ||",
     "    lista[0] ||"),

    ('anuncio: se mira el nombre pero no la sección', 'js/torneos/anuncio-foro.js',
     "    lista.find((f) => deJuego(f) && deTorneos(f)) ||\n    lista.find(deTorneos) ||",
     "    lista.find(deTorneos) ||"),

    ('anuncio: el desplegable no marca ninguna opción', 'js/torneos/anuncio-foro.js',
     "${f.id === porDefecto?.id ? ' selected' : ''}",
     "${''}"),

    ('anuncio: los subforos pierden su guion', 'js/torneos/anuncio-foro.js',
     "              f.parent_id ? '— ' : ''",
     "              ''"),

    ('anuncio: los foros no se ordenan (el subforo se cuela delante)', 'js/torneos/anuncio-foro.js',
     "  return raices\n    .slice()",
     "  return lista\n    .slice()"),

    ('anuncio: las secciones se pierden y todo cae en un grupo', 'js/torneos/torneo.js',
     "seccion: nombreSeccion.get(f.section_id) || 'Foro'",
     "seccion: 'Foro'"),
]

def correr():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-tanda-247.mjs'],
                       capture_output=True, text=True, timeout=600)
    return r.returncode, r.stdout

no_detectadas = []
for i, (nombre, fichero, viejo, nuevo) in enumerate(MUTACIONES, 1):
    ruta = os.path.join(REPO, fichero)
    original = open(ruta).read()
    if original.count(viejo) != 1:
        print(f'{i:2}. ⚠️  ANCLA MALA ({original.count(viejo)} coincidencias): {nombre}', flush=True)
        continue
    try:
        open(ruta, 'w').write(original.replace(viejo, nuevo))
        codigo, salida = correr()
        fallos = salida.count('FALLA')
        if codigo == 0:
            print(f'{i:2}. ❌ NO DETECTADA: {nombre}', flush=True)
            no_detectadas.append(nombre)
        else:
            print(f'{i:2}. ✅ pillada ({fallos} fallos): {nombre}', flush=True)
    finally:
        open(ruta, 'w').write(original)

subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
print()
if no_detectadas:
    print(f'❌ {len(no_detectadas)} mutaciones sin detectar:')
    for n in no_detectadas:
        print('   ·', n)
    sys.exit(1)
print(f'✅ Las {len(MUTACIONES)} mutaciones detectadas.')
