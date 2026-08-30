#!/usr/bin/env python3
"""Rompe el foro a propósito; mira si test-foro-1 y test-foro-2 se enteran."""
import subprocess, sys, os
REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
FORO = 'js/foro.js'
TEMA = 'js/tema.js'

# (nombre, fichero, viejo, nuevo, qué prueba debería enterarse)
ROTURAS = [
    # El orden de los foros está protegido por partida DOBLE: lo ordena
    # la consulta (`.order('position')`) y lo vuelve a ordenar el cliente
    # al agrupar por sección. Quitar uno de los dos no rompe nada — el
    # otro lo salva —, así que la rotura que sirve es INVERTIR el orden
    # del cliente, que es el que tiene la última palabra.
    ('el índice ordena los foros al revés', FORO,
     "const suyos = foros.filter((f) => f.section_id === s.id && !f.parent_id).sort((a, b) => a.position - b.position)",
     "const suyos = foros.filter((f) => f.section_id === s.id && !f.parent_id).sort((a, b) => b.position - a.position)", 'foro-1'),
    ('la lista de temas se trae los de TODOS los foros', FORO,
     "    .from('forum_threads')\n    .select('*')\n    .eq('board_id', foro.id)",
     "    .from('forum_threads')\n    .select('*')", 'foro-1'),
    ('el contador de temas ignora el foro (paginador fantasma)', FORO,
     "let qCuenta = supabase.from('forum_threads').select('*', { count: 'exact', head: true }).eq('board_id', foro.id)",
     "let qCuenta = supabase.from('forum_threads').select('*', { count: 'exact', head: true })", 'foro-1'),
    ('los fijados dejan de subir arriba', FORO,
     ".order('is_pinned', { ascending: false })", ".order('is_pinned', { ascending: true })", 'foro-1'),
    ('un foro que no existe se queda en blanco', FORO,
     "principal.innerHTML = `<p class=\"empty-state\">Este foro no existe o ya no está.</p>`",
     "principal.innerHTML = ''", 'foro-1'),
    ('el tema no pinta sus mensajes', TEMA,
     "    .eq('thread_id', tema.id)\n", "    .eq('thread_id', 'ninguno')\n", 'foro-2'),
    ('los mensajes salen del revés', TEMA,
     ".order('created_at', { ascending: true })", ".order('created_at', { ascending: false })", 'foro-2'),
    ('la visita deja de contarse', TEMA,
     "supabase.rpc('forum_ver_tema', { p_thread: tema.id }).then(",
     "Promise.resolve().then(", 'foro-2'),
    ('un tema cerrado deja escribir a cualquiera', TEMA,
     "  if (tema.is_locked && !soyStaff) {", "  if (false) {", 'foro-2'),
    ('el candado deja fuera hasta al equipo', TEMA,
     "  if (tema.is_locked && !soyStaff) {", "  if (tema.is_locked) {", 'foro-2'),
    ('repetir la reacción no la quita', TEMA,
     "  const laMia = boton.getAttribute('aria-pressed') === 'true'",
     "  const laMia = false", 'foro-2'),
    ('se puede reaccionar a lo propio', TEMA,
     "          ? `<span class=\"foro-reaccion foro-reaccion-quieta\" title=\"${escapeHtml(quienes)}\">${emoji} ${cuenta}</span>`\n          : ''",
     "          ? `<button type=\"button\" class=\"foro-reaccion\" data-reaccion=\"${m.id}\" data-kind=\"${kind}\">${emoji} ${cuenta}</button>`\n          : ''", 'foro-2'),
]


def correr(cual):
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True, text=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-{cual}.mjs'],
                       capture_output=True, text=True, cwd=REPO)
    salida = r.stdout + r.stderr
    fallos = [l.strip() for l in salida.splitlines() if l.startswith('  FALLA')]
    if r.returncode != 0 and not fallos:
        fallos = ['la prueba se corta: ' + (salida.strip().splitlines() or ['sin salida'])[-1][:90]]
    return (1 if fallos else 0), fallos


print('== Estado de partida ==', flush=True)
for cual in ('foro-1', 'foro-2'):
    code, fallos = correr(cual)
    print(f'   test-{cual}: {"VERDE" if code == 0 else "ROJO"} ({len(fallos)})', flush=True)
    if code != 0:
        for f in fallos[:4]:
            print('   ', f, flush=True)
        sys.exit(1)

malas = []
for nombre, fich, viejo, nuevo, cual in ROTURAS:
    ruta = os.path.join(REPO, fich)
    original = open(ruta).read()
    if viejo not in original:
        print(f'✘ NO SE PUEDE ROMPER: {nombre}', flush=True)
        malas.append(nombre)
        continue
    open(ruta, 'w').write(original.replace(viejo, nuevo, 1))
    try:
        code, fallos = correr(cual)
    finally:
        open(ruta, 'w').write(original)
    if code == 0:
        print(f'✘ LA PRUEBA NO SE ENTERA: {nombre}', flush=True)
        malas.append(nombre)
    else:
        print(f'✔ pillado: {nombre} — {fallos[0][:66]}', flush=True)

subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True, text=True)
print()
if malas:
    print(f'✘ {len(malas)} roturas sin detectar:')
    for m in malas:
        print('   -', m)
    sys.exit(1)
print(f'✔ las {len(ROTURAS)} roturas se detectan')
