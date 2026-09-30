// Tanda 388 — que el XP llegue de verdad.
//
// Tres agujeros que salieron al repasar la 387, todos de la misma
// familia: algo contestaba «bien» sin haber hecho nada.
//
//   1. El `revoke all … from public` de la 387 le quitaba el permiso
//      también a `service_role`, porque lo tenía POR SER public. El
//      barredor habría recibido «permission denied», la fase se habría
//      ido al catch y no se habría repartido XP JAMÁS — con el registro
//      diciendo tranquilamente «XP de torneos aparcado».
//   2. `addXP` leía, sumaba y escribía, así que el premio que caía en
//      medio se perdía. Medido contra Postgres: 105 donde tocaba 255.
//   3. Y al pasar a `xp_sumar`, «no hubo error» se tomaba por «sumó»:
//      una respuesta vacía dejaba el premio sin dar y `addXP` devolvía
//      0 como si todo hubiera ido bien.
//
// Más el cuarto, que era de la 387 y se le escapó: el podio solo se
// congelaba si el organizador volvía a ABRIR la ficha, y sin podio
// sellado el barredor no reparte nada.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('\n── 1. Quien revoca a public tiene que dar a alguien ──')
{
  // La FORMA del fallo, no el caso: una función nace con EXECUTE para
  // PUBLIC, así que `service_role` y `authenticated` lo tienen por eso y
  // no por un permiso propio. Revocar a public se lo quita a TODOS, y
  // una función que nadie puede ejecutar no da error al crearse.
  const migraciones = readdirSync(RAIZ).filter((f) => /^supabase-migration-.*\.sql$/.test(f))

  // Quién se llama desde FUERA de la base: el cliente con
  // `supabase.rpc('x')` y las funciones de Netlify con `rpc/x`. Eso es lo
  // que decide si hace falta un grant — un disparador (`returns trigger`)
  // o un ayudante que solo llaman otras funciones no lo necesita, y
  // exigírselo llenaría esto de excepciones.
  const desdeFuera = new Set()
  const barrer = (d) => {
    for (const e of readdirSync(`${RAIZ}/${d}`, { withFileTypes: true })) {
      if (e.isDirectory()) { if (e.name !== 'vendor') barrer(`${d}/${e.name}`); continue }
      if (!/\.(js|mjs)$/.test(e.name)) continue
      const t = readFileSync(`${RAIZ}/${d}/${e.name}`, 'utf8')
      for (const m of t.matchAll(/rpc\(\s*['"`]([\w]+)['"`]|['"`]rpc\/([\w]+)/g)) {
        desdeFuera.add(m[1] || m[2])
      }
    }
  }
  barrer('js')
  barrer('netlify')
  check('se ve a quién se llama desde fuera', desdeFuera.size > 3, `${desdeFuera.size}`)

  const mudas = []
  for (const f of migraciones) {
    const t = leer(f)
    for (const m of t.matchAll(/revoke all on function ([\w.]+)\(([^)]*)\)\s*from\s+([^;]+);/gi)) {
      const [, nombre, args, aQuien] = m
      if (!/\bpublic\b/.test(aQuien)) continue
      const corto = nombre.replace(/^public\./, '')
      if (!desdeFuera.has(corto)) continue
      const daAAlguien = new RegExp(
        `grant execute on function ${nombre.replace('.', '\\.')}\\(${args.replace(/\s+/g, '\\s*')}\\)\\s*to`,
        'i'
      )
      if (!daAAlguien.test(t)) mudas.push(`${f}: ${corto}(${args})`)
    }
  }
  check('toda función que se llama desde fuera y revoca public se le da a alguien',
    mudas.length === 0, mudas.join(' | '))

  // Y las dos de XP, nombradas: la del barredor va con la clave de
  // servicio y la del cliente con la de quien tiene sesión.
  const xpT = leer('supabase-migration-torneos-xp.sql')
  check('  torneos_repartir_xp se le da a service_role',
    /grant execute on function public\.torneos_repartir_xp\(uuid\) to service_role/.test(xpT))
  const xpA = leer('supabase-migration-xp-atomico.sql')
  check('  xp_sumar se le da a authenticated', /to authenticated/.test(xpA))
  check('  …y se le quita a anon', /revoke all on function public\.xp_sumar\(int\) from public, anon/.test(xpA))
}

console.log('\n── 2. La suma pasa dentro de la base ──')
{
  const sql = leer('supabase-migration-xp-atomico.sql')
  // La frase tiene que sumar SOBRE la columna, no sobre un número que
  // el cliente leyó antes. Eso es lo único que no se puede perder.
  check('el XP se suma sobre la propia columna',
    /set total_xp = coalesce\(total_xp, 0\) \+ p_cuanto/.test(sql))
  check('el nivel se recalcula en el mismo update', /level = public\.nivel_de_xp/.test(sql))
  // El id no es un parámetro: así no hay nada que falsear para sumarle
  // XP a otra persona.
  check('no se le puede decir a QUIÉN sumarle', /where id = auth\.uid\(\)/.test(sql) &&
    !/p_user|p_usuario/.test(sql))
  check('sin sesión no suma', /if auth\.uid\(\) is null then/.test(sql))
  check('y un premio absurdo se rechaza', /p_cuanto <= 0 or p_cuanto > 500/.test(sql))
  // Lo tercero: no puede contestar «bien» sin haber sumado.
  check('si no hay perfil, revienta en vez de contestar bien',
    /if v_total is null then\s*\n\s*raise exception/.test(sql))
}

console.log('\n── 3. El cliente no se cree un «bien» vacío ──')
{
  const g = leer('js/gamification.js')
  // No basta con `!error`: hace falta un número. Con el doble, la RPC
  // contesta sin error y sin datos, y así se veía el fallo.
  const rama = g.slice(g.indexOf("supabase.rpc('xp_sumar'"))
  check('hace falta un total y no solo la ausencia de error',
    /Number\.isFinite\(nuevo\) && nuevo > 0/.test(rama.slice(0, 700)), rama.slice(0, 260))
  // Y sin error pero sin total NO se grita: se sigue por el camino viejo.
  check('sin error y sin total, se sigue callado por el camino viejo',
    /if \(error && !noHayFuncion\(error\)\)/.test(rama.slice(0, 1200)))

  // El predicado está copiado de js/torneos/comun.js porque ese fichero
  // pesa 5,8 KB gzip y la portada no tiene ese margen. Una copia sin
  // vigilar se separa y no avisa (lección de la 322).
  const c = leer('js/torneos/comun.js')
  const codigos = (t) => [...t.matchAll(/'(PGRST\d+|42883)'/g)].map((m) => m[1]).sort()
  const aqui = codigos(g.slice(g.indexOf('const noHayFuncion'), g.indexOf('const noHayFuncion') + 400))
  const alli = codigos(c.slice(c.indexOf('export function faltaLaRpc'), c.indexOf('export function faltaLaRpc') + 500))
  check('las dos copias del «no existe esa función» dicen lo mismo',
    aqui.length >= 2 && JSON.stringify(aqui) === JSON.stringify(alli), `gamification=${aqui} comun=${alli}`)
}

console.log('\n── 4. El podio se congela al TERMINAR, no al visitar ──')
{
  const r = leer('js/torneos/ronda.js')
  const fn = r.slice(r.indexOf('async function terminarTorneo'))
  const conComentarios = fn.slice(0, fn.indexOf('\n}\n'))
  // Sin comentarios: el comentario de encima NOMBRA a `podioDelTorneo()`,
  // así que mirar posiciones sobre el texto crudo casaba con la
  // explicación y no con la llamada. La trampa de la 312: al barrer
  // código en busca de una cadena, todo lo que la CONTIENE cuenta.
  const cuerpo = conComentarios.replace(/\/\/[^\n]*/g, '')
  check('terminarTorneo sella el podio', /champion_id: podio\[0\], podium: podio/.test(cuerpo), cuerpo.slice(0, 200))
  // El ORDEN importa: podioDelTorneo() devuelve vacío si el torneo no
  // está en `finished`, así que el estado va en ctx ANTES de preguntar.
  check('  …y pone el estado en ctx antes de preguntar por el podio',
    cuerpo.indexOf("ctx.torneo.status = 'finished'") < cuerpo.indexOf('podioDelTorneo()'),
    `estado en ${cuerpo.indexOf("ctx.torneo.status = 'finished'")}, podio en ${cuerpo.indexOf('podioDelTorneo()')}`)
  // Si no se puede sellar no se deshace nada: el torneo YA terminó.
  check('  …y si el sello falla, el torneo sigue terminado',
    /if \(!error\) Object\.assign\(ctx\.torneo, cambios\)/.test(cuerpo))
  // Y sellarResultado se queda como red, no como único camino.
  check('sellarResultado sigue existiendo como red',
    /async function sellarResultado/.test(leer('js/torneos/torneo.js')))
}

console.log('\n── 5. Y el XP sigue entrando (con el puente puesto) ──')
{
  // El doble no tiene `xp_sumar` y contesta sin error y sin datos, que es
  // justo el caso que rompía: si `addXP` se lo creyera, el XP no subiría.
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)))
  await page.goto('http://localhost:8892/index.html', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const r = await page.evaluate(async () => {
    const { supabase } = await import('/js/supabase.js')
    const g = await import('/js/gamification.js')
    const leer = async () =>
      (await supabase.from('user_profiles').select('*').in('id', ['admin-1'])).data?.[0]?.total_xp ?? 0
    await supabase.from('user_profiles').update({ total_xp: 100 }).eq('id', 'admin-1')
    const antes = await leer()
    const devuelto = await g.addXP('admin-1', 7)
    return { antes, devuelto, despues: await leer() }
  })
  check('el XP sube aunque la RPC no esté', r.despues === r.antes + 7, JSON.stringify(r))
  check('  …y addXP devuelve el total nuevo', r.devuelto === r.antes + 7, JSON.stringify(r))
  check('sin errores en la página', errs.length === 0, errs.join(' | '))
  await browser.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
