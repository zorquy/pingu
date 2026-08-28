#!/usr/bin/env python3
"""Rompe la parte de pantalla de la tanda 223; mira si test-torneos-18 se entera."""
import subprocess, sys, os
REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
L = 'js/torneos/torneos.js'
B = 'js/torneos/borrar.js'

ROTURAS = [
    ('el corte de terminados desaparece (se enseñan todos)', L,
     '  const terminados = (verTodosLosTerminados ? acabados : acabados.slice(0, TERMINADOS_DE_GOLPE)).map((t) => tarjeta(t))',
     '  const terminados = acabados.map((t) => tarjeta(t))'),
    ('«ver más» no aparece nunca', L,
     "      pie: ocultos > 0 ? `<button type=\"button\" class=\"btn-secondary torneo-ver-mas\" id=\"btnVerMasTerminados\">Ver ${ocultos} más</button>` : '',",
     "      pie: '',"),
    ('«ver más» no hace nada al pulsarlo', L,
     """  document.getElementById('btnVerMasTerminados')?.addEventListener('click', () => {
    verTodosLosTerminados = true
    recargarLista()
  })""", ''),
    ('«ver más» miente en la cuenta', L,
     '  const ocultos = acabados.length - terminados.length', '  const ocultos = 1'),
    ('la tarjeta pierde el botón de borrar', L,
     """        puedeBorrar
          ? `<button type="button" class="torneo-borrar torneo-borrar-fila" data-borrar="${escapeHtml(t.id)}" data-nombre="${escapeHtml(t.name)}" data-dentro="${ocupadas}">Borrar</button>`
          : ''""", "        false ? '' : ''"),
    ('borra al primer toque, sin preguntar', L,
     """    if (boton.dataset.confirmar !== '1') {
      boton.dataset.confirmar = '1'
      boton.textContent = textoConfirmarBorrado(dentro)
      return
    }
""", ''),
    ('borra el torneo equivocado', L,
     '    const { error, diferido } = await borrarTorneo(boton.dataset.borrar, dentro)',
     '    const { error, diferido } = await borrarTorneo(boton.dataset.nombre, dentro)'),
    ('el aviso de la lista no dice a cuánta gente afecta', L,
     "        ? `«${boton.dataset.nombre}» cancelado. Se avisa a ${dentro} inscrito${dentro === 1 ? '' : 's'} y desaparece en un minuto.`",
     "        ? `«${boton.dataset.nombre}» cancelado.`"),
    ('con gente dentro borra igualmente de golpe', B,
     '  const diferido = inscritosDentro > 0', '  const diferido = false'),
    ('sin gente dentro tampoco borra (todo diferido)', B,
     '  const diferido = inscritosDentro > 0', '  const diferido = true'),
    ('el diferido no marca la fecha de borrado', B,
     '          delete_after_notice_at: new Date().toISOString(),', ''),
    ('el diferido no reabre el aviso de cancelación', B,
     '          cancel_notified_at: null,', ''),
]


def correr():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True, text=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-torneos-18.mjs'],
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
        print(f'✔ pillado: {nombre} — {fallos[0][:70]}', flush=True)

subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True, text=True)
print()
if malas:
    print(f'✘ {len(malas)} roturas sin detectar:')
    for m in malas:
        print('   -', m)
    sys.exit(1)
print(f'✔ las {len(ROTURAS)} roturas se detectan')
