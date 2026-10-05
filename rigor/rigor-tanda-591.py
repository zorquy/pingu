"""Rigor de la tanda 591 — enlaces cortos (/rep/<id> y /lab/<id>).

Lo que se rompe aquí no da error: un enlace que sale largo sin decir por
qué, uno corto que abre otra cosa, una base que deja listar lo de todos, o
un tope que no frena.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

EC = 'js/enlace-corto.js'
REP = 'js/repeticiones.js'
DAT = 'js/repeticiones/datos.js'
LAB = 'js/constructor/laboratorio.js'
CON = 'js/constructor.js'
MIG = 'supabase-migration-enlaces-cortos.sql'
TOML = 'netlify.toml'

MUTACIONES = [
    # Las piezas
    (EC, 'un id corto no se reconoce', "export const esIdCorto = (id) => /^[a-z2-9]{8}$/.test(String(id || ''))", "export const esIdCorto = (id) => /^[a-z2-9]{10}$/.test(String(id || ''))"),
    (EC, 'las posiciones van por /rep/', "`${origen}/${tipo === 'posicion' ? 'lab' : 'rep'}/${encodeURIComponent(id)}`", "`${origen}/rep/${encodeURIComponent(id)}`"),
    (EC, 'no poder preguntar se dice como «no existe»', "  if (error) throw Object.assign(new Error(faltaLaMigracion(error) ? `Los enlaces cortos aún no están: falta poner ${FICHERO_ENLACES} en la base.` : 'No se ha podido abrir el enlace: prueba otra vez en un momento.'), { falta: faltaLaMigracion(error) })", '  if (error) return null'),
    (TOML, 'sin la redirección de /rep/', 'from = "/rep/:id"', 'from = "/repe/:id"'),
    (DAT, 'la guardada vuelve al enlace largo', "export const enlaceCorto = (id, origen = location.origin) => `${origen}/rep/${encodeURIComponent(id)}`", "export const enlaceCorto = (id, origen = location.origin) => `${origen}/repeticiones?r=${encodeURIComponent(id)}`"),
    # Repeticiones
    (REP, 'sin cuenta sale largo', "      url = enlaceCortoDe('repeticion', await acortar('repeticion', carga))", "      throw new Error('sin corto')"),
    (REP, '«el largo» no cambia lo que se copia', '      cuerpo.dataset.url = largo\n', ''),
    (REP, 'un corto se abre como guardada', "  if (q.get('r') && esIdCorto(q.get('r'))) {", "  if (false) {"),
    (REP, 'una posición por /rep/ no se va al laboratorio', "  if (fila.tipo === 'posicion') {\n    location.replace(`/laboratorio#${fila.carga}`)", "  if (false) {\n    location.replace(`/laboratorio#${fila.carga}`)"),
    # El laboratorio
    (LAB, 'el corto dice «no se guarda en ningún sitio»', '      corto = true\n', ''),
    (LAB, 'la posición sale larga', "      url = enlaceCorto('posicion', await acortar('posicion', carga))", "      throw new Error('sin corto')"),
    (CON, '/lab/<id> no abre nada', '  else if (posCorta) {', '  else if (false) {'),
    # La base
    (MIG, 'la misma carga es otro enlace', '  if v_id is not null then\n    return v_id;\n  end if;\n\n  -- Sin conexión', '  if false then\n    return v_id;\n  end if;\n\n  -- Sin conexión'),
    (MIG, 'sin tope por hora', "and e.creado_at > now() - interval '1 hour'\n  ) >= 30 then", "and e.creado_at > now() - interval '1 hour'\n  ) >= 300 then"),
    (MIG, 'sin tope por día', "where e.creado_at > now() - interval '1 day') >= 3000 then", "where e.creado_at > now() - interval '1 day') >= 30000 then"),
    (MIG, 'cualquier carga', "  if (p_tipo = 'repeticion' and p_carga !~ '^(p|t)=[A-Za-z0-9_-]+$')", "  if false and (p_tipo = 'repeticion' and p_carga !~ '^(p|t)=[A-Za-z0-9_-]+$')"),
    (MIG, 'se puede listar', 'revoke all on table public.enlaces_cortos from anon, authenticated;\n', 'grant select on table public.enlaces_cortos to anon, authenticated;\n'),
    (MIG, 'sin cabeceras, todos en el mismo tope', 'where e.quien = v_quien and e.creado_at', "where coalesce(e.quien, '') = coalesce(v_quien, '') and e.creado_at"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-591.mjs')
