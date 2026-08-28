#!/usr/bin/env python3
"""Rompe el borrado de torneos (tanda 222); mira si test-torneos-16 se entera."""
import subprocess, sys, os
REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
TORNEO = 'js/torneos/torneo.js'
LISTA = 'js/torneos/torneos.js'

ROTURAS = [
    ('el botón de borrar desaparece', TORNEO,
     "    acciones.insertAdjacentHTML('beforeend', '<button class=\"torneo-borrar\" id=\"btnBorrarTorneo\">Borrar torneo</button>')\n    engancharBorrar()\n",
     ''),
    ('borra al primer toque, sin preguntar', TORNEO,
     """    if (btn.dataset.confirmar !== '1') {
      btn.dataset.confirmar = '1'
      const dentro = inscripciones.filter((i) => i.status !== 'waitlisted').length
      btn.textContent = dentro
        ? `¿Seguro? Se borra con sus ${dentro} inscrito${dentro === 1 ? '' : 's'}`
        : '¿Seguro? No hay vuelta atrás'
      return
    }
""", ''),
    ('el aviso no dice a cuánta gente afecta', TORNEO,
     '        ? `¿Seguro? Se borra con sus ${dentro} inscrito${dentro === 1 ? \'\' : \'s\'}`',
     "        ? '¿Seguro? No hay vuelta atrás'"),
    ('el segundo toque no llega a borrar', TORNEO,
     "    const { error } = await supabase.from('tournaments').delete().eq('id', torneo.id)",
     "    const { error } = await supabase.from('tournaments').select('id').eq('id', torneo.id)"),
    ('borra el torneo equivocado (todos)', TORNEO,
     "await supabase.from('tournaments').delete().eq('id', torneo.id)",
     "await supabase.from('tournaments').delete().eq('status', torneo.status)"),
    ('tras borrar te deja en la ficha muerta', TORNEO,
     "    location.href = '/torneos'", "    return"),
    ('la lista no da el aviso de borrado', LISTA,
     """  const borrado = sessionStorage.getItem('torneo-borrado')
  if (borrado) {
    sessionStorage.removeItem('torneo-borrado')
    showToast(`«${borrado}» borrado.`, 'success')
  }
""", ''),
    ('el aviso se queda pegado y repite', LISTA,
     "    sessionStorage.removeItem('torneo-borrado')\n", ''),
    ('cualquiera puede borrar (se cae la regla)', TORNEO,
     "  return Boolean(perfil?.is_admin || (torneo?.admin_id && torneo.admin_id === session?.user?.id))",
     "  return true"),
    ('solo el dueño, ni los admins', TORNEO,
     "  return Boolean(perfil?.is_admin || (torneo?.admin_id && torneo.admin_id === session?.user?.id))",
     "  return Boolean(torneo?.admin_id && torneo.admin_id === session?.user?.id)"),
]


def correr():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True, text=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-torneos-16.mjs'],
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
        print(f'✔ pillado: {nombre} — {fallos[0][:75]}', flush=True)

subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True, text=True)
print()
if malas:
    print(f'✘ {len(malas)} roturas sin detectar:')
    for m in malas:
        print('   -', m)
    sys.exit(1)
print(f'✔ las {len(ROTURAS)} roturas se detectan')
