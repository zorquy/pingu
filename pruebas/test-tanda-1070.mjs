// Tanda 1070 — los torneos apuntados con tu mazo guardado y tu puesto, tu
// mazo predeterminado, y la imagen del torneo con varios diseños.
//
// Ibai: «al guardar tus partidas/torneos jugados, que puedas seleccionar algún
// mazo de tu constructor en vez de añadir a mano tu mazo», «un input
// (opcional) que sea la posición en el torneo, que salga al exportar la
// imagen o que puedas elegir varios formatos… para todos los gustos» y «un
// mazo predeterminado para tus torneos».
//
// Aquí, lo que no necesita pantalla:
//   1. Lo puro: el puesto («3.º de 24», «Campeón», lo imposible), lo elegido
//      del dibujo, el mosaico, el tono de «Color»; el mazo predeterminado
//      (cuándo se pone y cuándo se quita) y el orden de tus mazos; leer el
//      puesto de dos campos.
//   2. La migración contra PostgreSQL (sql-tanda-1070.sql: 43
//      comprobaciones de permisos, arrastre y puesto).
//   3. La misma migración sentencia a sentencia, cada una en su conexión,
//      como el SQL Editor (631), sobre una base que ya tiene lo de antes.
//   4. /admin la vigila.
// Las pantallas, en test-tanda-1070-pantalla.mjs.
import { readFileSync } from 'node:fs'
import { spawnSync, execFileSync } from 'node:child_process'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || process.env.RAIZ || '/home/user/pingu'

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Lo puro ──')
{
  const I = await import(`${RAIZ}/js/partida-imagen.js`)
  const p3 = I.textoDePuesto(3, 24)
  check('3.º de 24: «3.º», «3.º de 24», «de 24 jugadores», Top 4, bronce', p3?.corto === '3.º' && p3.largo === '3.º de 24' && p3.jugadores === 'de 24 jugadores' && p3.etiqueta === 'Top 4' && p3.medalla === 'bronce', JSON.stringify(p3))
  check('1.º es «Campeón» en oro; 2.º, «Subcampeón» en plata', I.textoDePuesto(1).etiqueta === 'Campeón' && I.textoDePuesto(1).medalla === 'oro' && I.textoDePuesto(2).etiqueta === 'Subcampeón' && I.textoDePuesto(2).medalla === 'plata')
  check('5.º a 8.º, Top 8 (azul); 12.º, Top 16; 40.º, sin etiqueta', I.textoDePuesto(7).etiqueta === 'Top 8' && I.textoDePuesto(7).medalla === 'azul' && I.textoDePuesto(12).etiqueta === 'Top 16' && I.textoDePuesto(40).etiqueta === '')
  check('sin saber cuántos erais: «7.º» a secas', I.textoDePuesto(7).largo === '7.º' && I.textoDePuesto(7).jugadores === '')
  check('lo que no es un puesto no se enseña (0, -1, 2,5, texto, nulo)', [0, -1, 2.5, 'tres', null, undefined].every((x) => I.textoDePuesto(x) === null))
  check('ni uno imposible: 30.º de 24', I.textoDePuesto(30, 24) === null)
  check('el puesto del texto viene como cadena de un campo y vale igual', I.textoDePuesto('3', '24')?.largo === '3.º de 24')

  const e = I.eleccionValida({ diseno: 'inventado', fondo: 'rosa' })
  check('lo elegido que no existe vuelve a lo de siempre (Clásico, Noche, con puesto)', e.diseno === 'clasico' && e.fondo === 'noche' && e.puesto === true, JSON.stringify(e))
  check('  …y lo que sí, se respeta', JSON.stringify(I.eleccionValida({ diseno: 'mosaico', fondo: 'claro', puesto: false })) === JSON.stringify({ diseno: 'mosaico', fondo: 'claro', puesto: false }))
  check('cuatro diseños y tres fondos', I.DISENOS.map((d) => d.id).join() === 'clasico,podio,record,mosaico' && I.FONDOS.map((f) => f.id).join() === 'noche,claro,color')

  const T = { nombre: 'Liga del jueves', donde: 'Tienda', fecha: '2026-10-23', mazo: { nombre: 'Dragapult ex' }, puesto: 3, jugadores: 24, rondas: [{ resultado: 'win' }, { resultado: 'win' }, { resultado: 'loss' }] }
  check('el texto del torneo lleva el puesto delante del récord', /🏆 Liga del jueves: 3\.º de 24 · 2-1 con Dragapult ex/.test(I.textoDeTorneo(T)), I.textoDeTorneo(T))
  check('  …y sin él si no lo quieres enseñar', /🏆 Liga del jueves: 2-1 con Dragapult ex/.test(I.textoDeTorneo(T, { puesto: false })), I.textoDeTorneo(T, { puesto: false }))
  check('  …y un torneo sin puesto, como siempre', /🏆 Liga del jueves: 2-1 con/.test(I.textoDeTorneo({ ...T, puesto: null })))

  const m7 = I.rejillaDeMosaico(7, 936 / 704)
  check('el mosaico de 7 rondas: todas, en 3 columnas y 3 filas', m7.visibles === 7 && m7.fuera === 0 && m7.columnas * m7.filas >= 7 && m7.columnas === 3, JSON.stringify(m7))
  const m20 = I.rejillaDeMosaico(20, 1)
  check('  …con 20, 15 baldosas y «y 5 más» en la 16.ª', m20.visibles === 15 && m20.fuera === 5 && m20.columnas * m20.filas >= 16, JSON.stringify(m20))
  check('  …y sin rondas, ninguna', I.rejillaDeMosaico(0).visibles === 0)

  check('«Color» toma el tono de la medalla en el podio', I.tonoDe({ rondas: T.rondas, puesto: 1 }) !== I.tonoDe({ rondas: T.rondas, puesto: 9 }))
  check('  …y fuera del podio (o sin enseñar el puesto), el del récord', I.tonoDe({ rondas: T.rondas, puesto: 9 }) === I.RESULTADO.win.color && I.tonoDe({ rondas: T.rondas, puesto: 1, conPuesto: false }) === I.RESULTADO.win.color)

  const E = await import(`${RAIZ}/js/partidas-elegir-mazo.js`)
  const predGuardado = { user_deck_id: 'mazo-1', mi_mazo: 'a:arq-1', mi_mazo_nombre: 'Dragapult' }
  const predMano = { user_deck_id: null, mi_mazo: 'd:pikachu ex', mi_mazo_nombre: 'Pikachu ex' }
  check('el predeterminado guardado coincide por el MAZO, no por su arquetipo', E.coincideConPredeterminado({ guardado: 'mazo-1', clave: 'd:otro' }, predGuardado) && !E.coincideConPredeterminado({ guardado: null, clave: 'a:arq-1' }, predGuardado))
  check('  …y el escrito a mano, por su clave (y solo a mano)', E.coincideConPredeterminado({ guardado: null, clave: 'd:pikachu ex' }, predMano) && !E.coincideConPredeterminado({ guardado: 'mazo-9', clave: 'd:pikachu ex' }, predMano))
  check('marcado y no lo era: se pone', E.cambioDePredeterminado({ marcado: true, valor: { guardado: 'mazo-2', clave: 'd:x', nombre: 'X' }, predet: predGuardado }) === 'poner')
  check('desmarcado y lo era: se quita', E.cambioDePredeterminado({ marcado: false, valor: { guardado: 'mazo-1', clave: 'a:arq-1' }, predet: predGuardado }) === 'quitar')
  check('marcado y ya lo era, o desmarcado y no lo era: nada', E.cambioDePredeterminado({ marcado: true, valor: { guardado: 'mazo-1', clave: 'a:arq-1' }, predet: predGuardado }) === null && E.cambioDePredeterminado({ marcado: false, valor: { guardado: 'mazo-2', clave: 'd:x' }, predet: predGuardado }) === null)
  check('  …y sin mazo elegido no se pone nada', E.cambioDePredeterminado({ marcado: true, valor: null, predet: null }) === null)
  check('la fila del predeterminado: el mazo y su arquetipo enteros', JSON.stringify(E.filaDePredeterminado({ guardado: 'mazo-2', clave: 'd:x', nombre: 'X' })) === JSON.stringify({ user_deck_id: 'mazo-2', mi_mazo: 'd:x', mi_mazo_nombre: 'X' }) && JSON.stringify(E.filaDePredeterminado({ guardado: null, clave: null })) === JSON.stringify({ user_deck_id: null, mi_mazo: null, mi_mazo_nombre: null }))
  const lista = E.mazosParaElegir([{ id: 'a', name: 'A' }, { id: 'b', name: 'B', format: 'expanded' }, { id: 'c', name: '' }], { predet: { user_deck_id: 'b' }, actual: 'borrado' })
  check('tus mazos: el predeterminado primero, el resto como llegan', lista.map((m) => m.id).join() === 'b,a,c,borrado', lista.map((m) => m.id).join())
  check('  …con el que la fila ya tenía aunque no esté entre los tuyos (472)', lista.at(-1).perdido === true && /ya no está/.test(lista.at(-1).nombre))
  check('  …y uno sin nombre se llama «Mazo sin nombre»', lista.find((m) => m.id === 'c').nombre === 'Mazo sin nombre')
  check('se abre con tus mazos si tienes; a mano si no', E.origenInicial({ hayMazos: true }) === 'guardado' && E.origenInicial({ hayMazos: false }) === 'mano')
  check('  …con lo de la última vez',  E.origenInicial({ hayMazos: true, recordado: 'mano' }) === 'mano')
  check('  …y el predeterminado manda sobre lo recordado', E.origenInicial({ hayMazos: true, recordado: 'mano', predet: predGuardado }) === 'guardado' && E.origenInicial({ hayMazos: true, recordado: 'guardado', predet: predMano }) === 'mano')

  const M = await import(`${RAIZ}/js/partidas-mazos.js`)
  check('leer el puesto: vacío es «no se sabe»', JSON.stringify(M.leerPuesto('', ' ')) === JSON.stringify({ puesto: null, jugadores: null }))
  check('  …«3» de «24»', JSON.stringify(M.leerPuesto('3', '24')) === JSON.stringify({ puesto: 3, jugadores: 24 }))
  check('  …el puesto solo, sin jugadores', JSON.stringify(M.leerPuesto('7', '')) === JSON.stringify({ puesto: 7, jugadores: null }))
  check('  …0, decimales o letras: error en palabras', [M.leerPuesto('0', ''), M.leerPuesto('2.5', ''), M.leerPuesto('x', ''), M.leerPuesto('', '1')].every((r) => r.error))
  check('  …y «30.º de 24», también', /No puedes quedar 30\.º de 24/.test(M.leerPuesto('30', '24').error || ''))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La base, contra PostgreSQL ──')
const PSQL = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres']
const hayBase = spawnSync('psql', [...PSQL, '-c', 'select 1'], { encoding: 'utf8' }).status === 0
if (!hayBase) {
  console.log('   (no hay PostgreSQL en /var/tmp:5433 — las pruebas de la base NO se han corrido aquí)')
} else {
  const r = spawnSync('psql', [...PSQL, '-v', `raiz=${RAIZ}`, '-f', new URL('./sql-tanda-1070.sql', import.meta.url).pathname], { encoding: 'utf8', timeout: 120000 })
  const salida = `${r.stdout || ''}${r.stderr || ''}`
  const oks = (salida.match(/ {2}ok {2}/g) || []).length
  const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
  check(`PostgreSQL: ${oks} comprobaciones, ninguna falla (ni un error al ejecutarla dos veces)`, oks >= 43 && !fallos.length, fallos.slice(0, 3).join(' | '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Sentencia a sentencia, como el SQL Editor ──')
// Las sentencias de primer nivel de una migración con cuerpos `$$…$$`: los
// cuerpos se apartan antes de partir por `;` y se devuelven después.
function sentencias(sql) {
  const cuerpos = []
  const sin = sql.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, (m) => `\u0000${cuerpos.push(m) - 1}\u0000`).replace(/--[^\n]*/g, '')
  return sin
    .split(/;\s*(?:\n|$)/)
    .map((x) => x.replace(/\u0000(\d+)\u0000/g, (_, i) => cuerpos[Number(i)]).trim())
    .filter(Boolean)
}
if (hayBase) {
  const sql = readFileSync(`${RAIZ}/supabase-migration-1070-torneos-mazo-y-puesto.sql`, 'utf8')
  const partes = sentencias(sql)
  check('la migración se parte en sentencias (y los cuerpos de función van enteros)', partes.length > 20 && partes.some((p) => /create or replace function public\.match_log_torneo_arrastra/.test(p) && /end \$\$$/.test(p)), partes.length)
  check('sin tablas temporales ni begin/commit que dependan de ir juntas', !/\bcreate\s+(temp|temporary)\s+table\b/i.test(sql) && !/^\s*begin\s*;/im.test(sql))
  // La base de antes: lo mismo que el .sql de la prueba, sin la 1070.
  const previa = `
drop schema if exists auth cascade;
create schema auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
drop table if exists public.match_log, public.match_log_torneos, public.match_log_ajustes, public.user_decks, public.user_profiles cascade;
drop function if exists public.match_log_mazo_propio() cascade;
drop function if exists public.match_log_torneo_arrastra() cascade;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create table public.user_profiles (id uuid primary key);`
  execFileSync('psql', [...PSQL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', previa], { stdio: 'ignore' })
  for (const f of ['supabase-migration-mazos.sql', 'supabase-migration-partidas.sql', 'supabase-migration-partidas-torneos.sql', 'supabase-migration-partidas-editar.sql', 'supabase-migration-partidas-cerrar.sql']) {
    execFileSync('psql', [...PSQL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', `${RAIZ}/${f}`], { stdio: 'ignore' })
  }
  let error = ''
  for (const s of partes) {
    try {
      execFileSync('psql', [...PSQL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', s], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      error = `${String(e.stderr || e.message).split('\n')[0]} ← ${s.slice(0, 80)}`
      break
    }
  }
  check('se ejecuta entera, cada sentencia en su conexión (sin la 627 puesta antes)', !error, error)
  const leer = (q) => execFileSync('psql', [...PSQL, '-X', '-At', '-c', q], { encoding: 'utf8' }).trim()
  check('  …y deja las tres columnas, la tabla y los cuatro disparadores', leer("select count(*) from information_schema.columns where table_name = 'match_log_torneos' and column_name in ('user_deck_id','puesto','jugadores')") === '3' && leer("select to_regclass('public.match_log_ajustes') is not null") === 't' && leer("select count(*) from pg_trigger where tgname in ('match_log_mazo_propio','match_log_torneos_mazo_propio','match_log_ajustes_mazo_propio','match_log_torneo_arrastra')") === '4')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. /admin la vigila ──')
{
  const chequeo = readFileSync(`${RAIZ}/js/schema-check.js`, 'utf8')
  check('el chequeo de /admin mira el puesto del torneo y la tabla del predeterminado', /tabla: 'match_log_torneos', columna: 'puesto', fichero: 'supabase-migration-1070-torneos-mazo-y-puesto\.sql'/.test(chequeo) && /tabla: 'match_log_ajustes', columna: 'user_deck_id', fichero: 'supabase-migration-1070-torneos-mazo-y-puesto\.sql'/.test(chequeo))
  const js = readFileSync(`${RAIZ}/js/mis-partidas.js`, 'utf8')
  // «Un select del cliente que pide una columna NUEVA no se empuja antes que
  // la migración» (624): las columnas nuevas solo se piden en la sonda, que
  // sabe fallar, y solo se ESCRIBEN detrás de `torneoAlDia`.
  check('las columnas nuevas del torneo se escriben solo con la base al día', /if \(torneoAlDia\) Object\.assign\(campos, \{ user_deck_id/.test(js) && /if \(puesto && torneoAlDia\)/.test(js))
}

console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
