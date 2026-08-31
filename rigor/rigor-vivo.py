#!/usr/bin/env python3
"""Rompe el tiempo real (tanda 227); mira si test-vivo se entera."""
import subprocess, sys, os
REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
T = 'js/torneos/torneo.js'
N = 'js/notifications.js'
TEMA = 'js/tema.js'
V = 'js/vivo.js'
S = 'js/sondeo.js'

ROTURAS = [
    ('la ficha no se suscribe a nada', T,
     "      escuchar({\n        nombre: `torneo-${torneo.id}`,",
     "      if (false) escuchar({\n        nombre: `torneo-${torneo.id}`,"),
    ('deja de escuchar el chat de partida', T,
     "          { tabla: 'match_messages' },\n", ''),
    ('deja de escuchar los resultados', T,
     "          { tabla: 'match_results' },\n", ''),
    ('escucha las rondas de TODOS los torneos', T,
     "{ tabla: 'rounds', filtro: `tournament_id=eq.${torneo.id}` }",
     "{ tabla: 'rounds' }"),
    ('un evento del vivo no refresca nada', T,
     "        alCambiar: () => tic(),", "        alCambiar: () => {},"),
    # ── La red de seguridad ──
    ('el sondeo se apaga del todo con el vivo puesto', T,
     "        alEstado: (vivo) => sondeo.conVivo(vivo),",
     "        alEstado: () => sondeo.parar(),"),
    # Estas dos van contra js/sondeo.js y se prueban en NODE, no en el
    # navegador: el entorno de pruebas sustituye vivo.js entero por un
    # doble, así que romperlo allí no lo notaba nadie. Por eso el
    # engranaje del sondeo salió a su propio fichero.
    ('el sondeo no vuelve cuando el vivo se cae', S,
     "    conVivo(estaVivo) {\n      if (estaVivo === vivo) return\n      vivo = estaVivo\n      arrancar()",
     "    conVivo(estaVivo) {\n      if (estaVivo === vivo) return\n      vivo = true\n      arrancar()", 'sondeo'),
    ('el sondeo al ralentí se queda igual de rápido', S,
     "    timer = setInterval(fn, vivo ? msNormal * factorDormido : msNormal)",
     "    timer = setInterval(fn, msNormal)", 'sondeo'),
    ('cada aviso de «sigo vivo» reinicia el reloj (nunca dispara)', S,
     "      if (estaVivo === vivo) return\n", '', 'sondeo'),
    ('parar no para', S,
     "    parar() {\n      if (timer) clearInterval(timer)\n      timer = null\n    },",
     "    parar() {},", 'sondeo'),
    # ── Campanita y tema ──
    ('la campanita no escucha', N,
     "  escuchar({\n    nombre: `campanita-${session.user.id}`,",
     "  if (false) escuchar({\n    nombre: `campanita-${session.user.id}`,"),
    ('la campanita recibe los avisos de TODOS', N,
     "{ tabla: 'user_notifications', filtro: `recipient_id=eq.${session.user.id}`, evento: 'INSERT' }",
     "{ tabla: 'user_notifications', evento: 'INSERT' }"),
    ('la campanita se repinta con cualquier cambio, no solo con avisos nuevos', N,
     "filtro: `recipient_id=eq.${session.user.id}`, evento: 'INSERT' }",
     "filtro: `recipient_id=eq.${session.user.id}` }"),
    ('el tema del foro no escucha', TEMA,
     "        nombre: `tema-${tema.id}`,", "        nombre: `no-escucha-${tema.id}`,"),
    ('leer un tema estrena un sondeo (gasta más que antes)', TEMA,
     "    .then(({ escuchar }) => {\n      escuchar({",
     "    .then(({ escuchar, sondeoAdaptable }) => {\n      sondeoAdaptable(() => pintarMensajes(), 10000)\n      escuchar({"),
]


def correr(cual='vivo'):
    if cual == 'vivo':
        subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True, text=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-{cual}.mjs'],
                       capture_output=True, text=True, cwd=REPO)
    salida = r.stdout + r.stderr
    fallos = [l.strip() for l in salida.splitlines() if l.startswith('  FALLA')]
    if r.returncode != 0 and not fallos:
        fallos = ['la prueba se corta: ' + (salida.strip().splitlines() or ['sin salida'])[-1][:90]]
    return (1 if fallos else 0), fallos


print('== Estado de partida ==', flush=True)
for cual in ('vivo', 'sondeo'):
    code, fallos = correr(cual)
    print(f'   test-{cual}: {"VERDE" if code == 0 else "ROJO"} ({len(fallos)})', flush=True)
    if code != 0:
        for f in fallos[:5]:
            print('   ', f, flush=True)
        sys.exit(1)

malas = []
for rotura in ROTURAS:
    nombre, fich, viejo, nuevo = rotura[0], rotura[1], rotura[2], rotura[3]
    cual = rotura[4] if len(rotura) > 4 else 'vivo'
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
        print(f'✔ pillado: {nombre} — {fallos[0][:64]}', flush=True)

subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True, text=True)
print()
if malas:
    print(f'✘ {len(malas)} roturas sin detectar:')
    for m in malas:
        print('   -', m)
    sys.exit(1)
print(f'✔ las {len(ROTURAS)} roturas se detectan')
