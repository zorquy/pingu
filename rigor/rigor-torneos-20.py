# Rigor del escaparate (tanda 228) y del recorte de consultas.
# Cada rotura debe hacer fallar la prueba que le toca. Ojo: hay que
# sincronizar el entorno DESPUÉS de romper, o se prueba la copia vieja.
import subprocess, sys
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'
NODE = '/opt/node22/bin/node'

ROTURAS = [
    # ── El escaparate ──
    ('js/torneos/torneo.js', 'test-torneos-20.mjs', 'vuelve el rebote a la portada',
     "  soloMirando = !session", "  soloMirando = !session\n  if (!session) { window.location.href = '/index.html'; return }"),
    # El doble ignora las columnas del select, así que esto NO se puede
    # probar en el navegador: se prueba atando la lista al grant del SQL.
    ('js/torneos/torneo.js', 'test-torneos-21.mjs', 'el visitante pide todas las columnas',
     "soloMirando ? COLUMNAS_PUBLICAS_INSCRIPCION.join(', ') : '*'", "'*'"),
    ('js/torneos/comun.js', 'test-torneos-21.mjs', 'la lista del cliente se desincroniza del grant',
     "  'dropped_after_round_id',\n]", "  'dropped_after_round_id',\n  'tcg_live_username',\n]"),
    ('supabase-migration-torneos-publico.sql', 'test-torneos-21.mjs', 'el grant se desincroniza del cliente',
     "      id, tournament_id, user_id, status, registered_at, dropped_at, dropped_after_round_id",
     "      id, tournament_id, user_id, status, registered_at, dropped_at"),
    ('supabase-migration-torneos-publico.sql', 'test-torneos-21.mjs', 'se le devuelve al anónimo la tabla entera',
     "    revoke select on public.tournament_registrations from anon;", ""),
    ('js/torneos/torneo.js', 'test-torneos-20.mjs', 'el usuario de TCG Live se pinta a cualquiera',
     "  if (soloMirando || !i.tcg_live_username) return ''", "  if (!i.tcg_live_username) return ''"),
    ('js/torneos/torneo.js', 'test-torneos-20.mjs', 'sin torneo se rebota en vez de avisar',
     "    pintarNoDisponible()", "    window.location.href = '/torneos.html'"),
    ('js/torneos/torneo.js', 'test-torneos-20.mjs', 'no hay invitación a entrar',
     "  if (soloMirando) {\n    const vuelta =", "  if (false) {\n    const vuelta ="),
    ('js/torneos/torneo.js', 'test-torneos-20.mjs', 'el enlace de entrar no vuelve al torneo',
     "href=\"/auth.html?volver=${vuelta}\"", "href=\"/auth.html\""),
    ('js/torneos/torneo.js', 'test-torneos-20.mjs', 'las decklists se piden sin sesión',
     "  if (soloMirando) {\n    decklistsTorneo = null\n    decklistsEntregadas = []\n    miDecklist = null\n    return\n  }", ""),
    ('js/torneos/jueces.js', 'test-torneos-20.mjs', 'la caja de jueces se enseña al visitante',
     "  if (!yo()) {\n    caja.classList.add('hidden')\n    return\n  }", ""),
    ('js/torneos/jueces.js', 'test-torneos-20.mjs', 'el bye se cuela como partida del visitante (jueces)',
     "  miPartida = mi && rondaViva", "  miPartida = rondaViva"),
    ('js/torneos/ronda.js', 'test-torneos-20.mjs', 'el bye se cuela como «tu partida»',
     "  const mia = yo && actual", "  const mia = actual"),
    ('js/torneos/ronda.js', 'test-torneos-20.mjs', 'la columna de TCG Live sale sin sesión',
     "  const verTcgLive = Boolean(miId())", "  const verTcgLive = true"),
    # ── El recorte de consultas ──
    ('js/torneos/jueces.js', 'medir', 'jueces vuelve a pedir las solicitudes',
     "  solicitudes = ctx.solicitudes || []",
     "  solicitudes = (await supabase.from('judge_applications').select('*').eq('tournament_id', ctx.torneo.id)).data || []"),
    ('js/torneos/jueces.js', 'medir', 'jueces vuelve a pedir rondas y mesas',
     "  let rondas = ctx.ciclo?.rondas\n  let mesas = ctx.ciclo?.partidas",
     "  let rondas = null\n  let mesas = null"),
    ('js/torneos/jueces.js', 'medir', 'jueces vuelve a pedir las decklists',
     "    if (ctx.decklistsTorneo) {", "    if (false) {"),
    ('js/torneos/ronda.js', 'medir', 'el historial de cruces vuelve al refresco',
     "  ctx.ciclo = { rondas, partidas }",
     "  ctx.ciclo = { rondas, partidas }\n  await cargarHistorial()"),
    ('js/torneos/torneo.js', 'medir', 'el hilo del foro se busca en cada refresco',
     "  if (!hiloForoId) {", "  if (true) {"),
]

def sincronizar():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True)

def medir():
    r = subprocess.run([NODE, f'{SC}/medir-carga.mjs'], capture_output=True, text=True)
    for linea in r.stdout.split('\n'):
        if linea.startswith('Cada refresco:'):
            return int(linea.split(':')[1].strip().split()[0])
    return -1

sincronizar()
BASE = medir()
print(f'consultas por refresco, sin romper nada: {BASE}\n')

fallos = []
for rel, prueba, nombre, viejo, nuevo in ROTURAS:
    ruta = f'{REPO}/{rel}'
    original = open(ruta, encoding='utf-8').read()
    if viejo not in original:
        fallos.append(f'{nombre}: NO SE ENCUENTRA el trozo')
        print(f'!! {nombre}: no se encuentra el trozo')
        continue
    open(ruta, 'w', encoding='utf-8').write(original.replace(viejo, nuevo, 1))
    try:
        sincronizar()
        if prueba == 'medir':
            # Aquí la «prueba» es el contador: si la rotura no sube las
            # consultas, el recorte no estaba recortando nada.
            n = medir()
            detectada = n > BASE
            extra = f'({BASE} → {n})'
        else:
            r = subprocess.run([NODE, f'{SC}/{prueba}'], capture_output=True, text=True)
            detectada = r.returncode != 0
            extra = ''
    finally:
        open(ruta, 'w', encoding='utf-8').write(original)
    if detectada:
        print(f'detectada     {nombre} {extra}')
    else:
        fallos.append(nombre)
        print(f'NO DETECTADA  {nombre} {extra}')

sincronizar()
print(f'\n{len(ROTURAS) - len(fallos)}/{len(ROTURAS)} detectadas')
sys.exit(1 if fallos else 0)
