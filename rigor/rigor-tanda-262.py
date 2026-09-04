#!/usr/bin/env python3
# Rigor de la tanda 262. SIEMPRE en segundo plano.
import subprocess, sys, os
REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
PAL = 'js/torneos/palmares.js'
USU = 'js/usuario.js'
CSS = 'css/perfil.css'
HTML = 'usuario.html'

MUTACIONES = [
    ('ganar cuenta además como podio', PAL,
     "    if (puesto === 0) campeonatos++\n    else if (puesto > 0) podios++",
     "    if (puesto === 0) campeonatos++\n    if (puesto >= 0) podios++"),

    ('quedar cuarto cuenta como podio', PAL,
     "    else if (puesto > 0) podios++",
     "    else podios++"),

    ('los hitos se dan con uno menos', PAL,
     "  return HITOS.filter((h) => cuentas[h.familia] >= h.pide).map((h) => h.id)",
     "  return HITOS.filter((h) => cuentas[h.familia] >= h.pide - 1).map((h) => h.id)"),

    ('solo se queda el hito más alto', PAL,
     "  return HITOS.filter((h) => cuentas[h.familia] >= h.pide).map((h) => h.id)",
     "  return HITOS.filter((h) => cuentas[h.familia] >= h.pide).map((h) => h.id).slice(-1)"),

    ('el top cut se cuenta como podio', PAL,
     "  const cuentas = { jugados, podios, campeonatos, topCut: topCut ? 1 : 0 }",
     "  const cuentas = { jugados, podios, campeonatos: podios, topCut: topCut ? 1 : 0 }"),

    ('la meta siguiente es la ya conseguida', PAL,
     "  const pendiente = HITOS.filter((h) => h.familia === 'jugados').find((h) => jugados < h.pide)",
     "  const pendiente = HITOS.filter((h) => h.familia === 'jugados').find((h) => jugados >= h.pide)"),

    ('lo que falta se cuenta al revés', PAL,
     "  return pendiente ? { ...pendiente, faltan: pendiente.pide - jugados } : null",
     "  return pendiente ? { ...pendiente, faltan: jugados } : null"),

    ('cualquier logro cuenta como de torneo', PAL,
     "  return String(id ?? '').startsWith('torneo_')",
     "  return true"),

    ('la vitrina enseña logros que no se han ganado', USU,
     "  const medallas = definiciones.filter((d) => esLogroDeTorneo(d.id) && suyos.has(d.id))",
     "  const medallas = definiciones.filter((d) => esLogroDeTorneo(d.id))"),

    ('la medalla no dice qué es al pasar por encima', USU,
     '''title="${escapeHtml(m.title)} — ${escapeHtml(
            m.description || ''
          )}"''',
     'title=""'),

    ('la rareza no llega a la medalla (el oro se ve como bronce)', USU,
     '''class="palmares-medalla rarity-${escapeHtml(m.rarity || 'bronze')}"''',
     'class="palmares-medalla"'),

    ('el resumen vuelve a salir pegado', USU,
     "    .filter(Boolean)\n    .join(' · ')",
     "    .filter(Boolean)\n    .join('')"),

    ('no se dice lo que falta para la siguiente', USU,
     "    falta && nombreHito ? `a ${falta.faltan} de ${nombreHito}` : '',",
     "    '',"),

    ('la ficha de una persona se queda otra vez sin estos estilos', HTML,
     '  <link rel="stylesheet" href="/css/perfil.css" />',
     ''),

    ('las medallas dejan de distinguirse por rareza', CSS,
     ".palmares-medalla.rarity-gold {\n  border-color: rgba(217, 164, 6, 0.55);\n  background: rgba(217, 164, 6, 0.1);\n}",
     ".palmares-medalla.rarity-gold {\n  border-color: var(--border);\n}"),
]


def correr():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-tanda-262.mjs'],
                       capture_output=True, text=True, timeout=600)
    return r.returncode, r.stdout


sin = []
for i, (nombre, fichero, viejo, nuevo) in enumerate(MUTACIONES, 1):
    ruta = os.path.join(REPO, fichero)
    original = open(ruta).read()
    if original.count(viejo) != 1:
        print(f'{i:2}. ⚠️  ANCLA MALA ({original.count(viejo)}): {nombre}', flush=True)
        sin.append(nombre + ' (ancla mala)')
        continue
    try:
        open(ruta, 'w').write(original.replace(viejo, nuevo))
        codigo, salida = correr()
        if codigo == 0:
            print(f'{i:2}. ❌ NO DETECTADA: {nombre}', flush=True)
            sin.append(nombre)
        else:
            print(f'{i:2}. ✅ pillada ({salida.count("FALLA")} fallos): {nombre}', flush=True)
    finally:
        open(ruta, 'w').write(original)

subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
print()
if sin:
    print(f'❌ {len(sin)} sin detectar:')
    for n in sin: print('   ·', n)
    sys.exit(1)
print(f'✅ Las {len(MUTACIONES)} mutaciones detectadas.')
