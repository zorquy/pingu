#!/usr/bin/env python3
"""Rompe el repaso de móvil (tanda 221); mira si test-torneos-15 se entera."""
import subprocess, sys, os
REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
CSS = 'css/torneos.css'
TORNEO = 'js/torneos/torneo.js'
RONDA = 'js/torneos/ronda.js'

ROTURAS = [
    ('las filas de inscritos vuelven a ser flex (columnas a su aire)', CSS,
     '  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) 108px 104px;',
     '  grid-template-columns: auto auto auto auto;'),
    ('la chapa se coloca donde le pilla en vez de al margen', CSS,
     '''  .torneo-inscrito > span:not(.torneo-inscrito-nombre):not(.subtext) {
    grid-column: 1;
    justify-self: start;
  }''',
     '''  .torneo-inscrito > span:not(.torneo-inscrito-nombre):not(.subtext) {
    justify-self: start;
  }'''),
    ('los nombres largos vuelven a empujar la página', CSS,
     '''.torneo-inscrito-nombre,
.torneo-inscrito .subtext,
.torneo-decklist-marca,
#miPlazaContenido {
  overflow-wrap: anywhere;
}''', ''),
    ('la caja de anuncio vuelve a salirse en móvil', CSS,
     '.torneo-anuncio-foro select { flex: 1 1 160px; min-width: 0; max-width: 100%; }',
     '.torneo-anuncio-foro select { flex: 1 1 160px; }'),
    ('el «Enviar» del chat vuelve a desbordar', CSS,
     '.torneo-chat-envio input { flex: 1 1 auto; min-width: 0; }',
     '.torneo-chat-envio input { flex: 1 1 auto; }'),
    ('las mesas vuelven a ser tabla en móvil (arrastrar de lado)', CSS,
     '''  .torneo-mesas-tabla thead {
    display: none;
  }''', ''),
    ('las celdas de mesa pierden su etiqueta', RONDA,
     'data-etiqueta="Jugador B"', 'data-b="Jugador B"'),
    ('la ficha vuelve a enseñar «undefined min»', TORNEO,
     "`${torneo.checkin_minutes ?? 5} min`", '`${torneo.checkin_minutes} min`'),
]


def correr():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True, text=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-torneos-15.mjs'],
                       capture_output=True, text=True, cwd=REPO)
    salida = r.stdout + r.stderr
    fallos = [l.strip() for l in salida.splitlines() if l.startswith('  FALLA')]
    if r.returncode != 0 and not fallos:
        fallos = ['la prueba se corta: ' + (salida.strip().splitlines() or ['sin salida'])[-1][:90]]
    return (1 if fallos else 0), fallos


print('== Estado de partida ==', flush=True)
code, fallos = correr()
print(f'   {"VERDE" if code == 0 else "ROJO"} ({len(fallos)})', flush=True)
if code != 0:
    for f in fallos[:6]:
        print('   ', f, flush=True)
    sys.exit(1)

malas = []
for nombre, fich, viejo, nuevo in ROTURAS:
    ruta = os.path.join(REPO, fich)
    original = open(ruta).read()
    if viejo not in original:
        print(f'✘ NO SE PUEDE ROMPER: {nombre}', flush=True)
        malas.append(nombre)
        continue
    open(ruta, 'w').write(original.replace(viejo, nuevo, 1))
    try:
        code, fallos = correr()
    finally:
        open(ruta, 'w').write(original)
    if code == 0:
        print(f'✘ LA PRUEBA NO SE ENTERA: {nombre}', flush=True)
        malas.append(nombre)
    else:
        print(f'✔ pillado: {nombre} — {fallos[0][:80]}', flush=True)

subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True, text=True)
print()
if malas:
    print(f'✘ {len(malas)} roturas sin detectar:')
    for m in malas:
        print('   -', m)
    sys.exit(1)
print(f'✔ las {len(ROTURAS)} roturas se detectan')
