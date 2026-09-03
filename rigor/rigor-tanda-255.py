#!/usr/bin/env python3
# Rigor de la tanda 255. SIEMPRE en segundo plano.
import subprocess, sys, os
REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
HOME = 'js/home.js'
JUE = 'js/torneos/jueces.js'
RON = 'js/torneos/ronda.js'
TOR = 'js/torneos/torneo.js'

MUTACIONES = [
    # ── La tarjeta de la portada ──
    ('la portada enseña torneos que no admiten inscripciones', HOME,
     "      .eq('status', 'registration_open')",
     "      .in('status', ['registration_open', 'draft', 'in_progress'])"),

    ('la portada enseña torneos que ya se jugaron', HOME,
     "      .gte('start_at', new Date().toISOString())",
     "      .gte('start_at', '2000-01-01T00:00:00.000Z')"),

    ('no se elige el que antes se juega', HOME,
     "      .order('start_at', { ascending: true })",
     "      .order('start_at', { ascending: false })"),

    ('la sección vacía se queda ocupando sitio', HOME,
     "    if (!torneo) return recogerSeccion('torneoPortadaSeccion')",
     "    if (!torneo) return"),

    ('se inventan plazas de un torneo sin aforo', HOME,
     "    if (torneo.max_players != null) {",
     "    if (true) {"),

    ('las plazas cuentan también a quien se dio de baja', HOME,
     "        .eq('status', 'active')",
     ""),

    ('la tarjeta no lleva a ESE torneo', HOME,
     "      <a class=\"reto-tarjeta\" href=\"/torneo?slug=${encodeURIComponent(torneo.slug)}\">",
     "      <a class=\"reto-tarjeta\" href=\"/torneos\">"),

    ('«mañana» se dice como si fuera hoy', HOME,
     "  if (dias === 1) return `Mañana a las ${hora}`",
     "  if (dias === 1) return `Hoy a las ${hora}`"),

    # ── El sondeo: llamadas al juez ──
    ('quien solo mira vuelve a pedir la cola del juez', JUE,
     "  if (puedeAtender || tengoMesa) {",
     "  if (true) {"),

    ('al jugador se le trae la cola entera, no la suya', JUE,
     "    if (!puedeAtender) q = q.eq('created_by', yo())\n",
     ""),

    ('el organizador pierde la cola entera', JUE,
     "  const puedeAtender = Boolean(ctx.perfil?.is_admin || ctx.esJuez)",
     "  const puedeAtender = false"),

    ('quien juega se queda sin sus llamadas', JUE,
     "  const tengoMesa = Boolean(yo() && mesas.some((m) => m.player_a_id === yo() || m.player_b_id === yo()))",
     "  const tengoMesa = false"),

    # ── El sondeo: reportes y resultados ──
    ('los reportes se vuelven a pedir para todo el mundo', RON,
     "      necesitaReportes\n        ? supabase.from('match_reports').select('*').in('match_id', idsPartidas)\n        : Promise.resolve({ data: [] }),",
     "      supabase.from('match_reports').select('*').in('match_id', idsPartidas),"),

    ('quien juega se queda sin los reportes de su mesa', RON,
     "    const necesitaReportes = Boolean(\n      ctx.perfil?.is_admin || ctx.esJuez || (mi && partidas.some((m) => m.player_a_id === mi || m.player_b_id === mi))\n    )",
     "    const necesitaReportes = Boolean(ctx.perfil?.is_admin || ctx.esJuez)"),

    ('el marcador se le esconde a quien solo mira', RON,
     "      supabase.from('match_results').select('*').in('match_id', idsPartidas),",
     "      necesitaReportes ? supabase.from('match_results').select('*').in('match_id', idsPartidas) : Promise.resolve({ data: [] }),"),

    # ── El sondeo: la decklist propia ──
    ('se pide la decklist de quien ni siquiera juega', TOR,
     "  if (!miInscripcion) {\n    miDecklist = null\n    decklistsEntregadas = []\n    return\n  }\n",
     ""),

    ('quien juega se queda sin su propia decklist', TOR,
     "  if (!miInscripcion) {\n    miDecklist = null",
     "  if (true) {\n    miDecklist = null"),
]


def correr():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-tanda-255.mjs'],
                       capture_output=True, text=True, timeout=900)
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
