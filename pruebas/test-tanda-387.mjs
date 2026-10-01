// Tanda 387 — el XP de los torneos, y el nivel junto al nombre.
//
// PINGU: «deberíamos meter experiencia por jugar torneos y ganar torneos
// también», y «que se vea que la gente se curra las cosas».
//
// Lo que esta prueba mira y no supone:
//   · Que los umbrales de nivel de la BASE y los del JS dicen lo mismo.
//     Son una copia, y una copia sin vigilar se separa sin dar error:
//     alguien con 4.000 puntos se quedaría con la chapa de Novato.
//   · Que el contador del barredor sale en los DOS `return`. Hay uno
//     temprano —cuando ningún torneo tiene ronda activa— y una fase que
//     se cuente solo en el otro miente en casi todas las pasadas.
//   · Que la chapa se enseña junto al nombre en el hilo de actividad, y
//     que sin `total_xp` NO se enseña nada: enseñar «Novato» sería
//     inventarse un cero.
//   · Y que el nombre NO se tiñe por nivel: los cinco colores de las
//     chapas dan entre 2,1 y 3,3 sobre blanco, así que como letra no se
//     leen. El color del nombre es del rango y de nadie más.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('\n── 1. Los umbrales de nivel, en dos idiomas ──')
{
  // `js/gamification.js` importa `./supabase.js`, que arrastra el
  // navegador entero: no se puede importar desde Node. Así que se lee
  // como TEXTO, igual que la 322 hace con IDIOMA_POR_MERCADO.
  const js = leer('js/gamification.js')
  const bloque = js.slice(js.indexOf('export const LEVEL_THRESHOLDS'))
  const enJs = [...bloque.slice(0, bloque.indexOf(']')).matchAll(/level: '([^']+)', min: (\d+)/g)]
    .map(([, nombre, min]) => [nombre, Number(min)])
  check('se leen los cinco niveles del JS', enJs.length === 5, JSON.stringify(enJs))

  const sql = leer('supabase-migration-torneos-xp.sql')
  const fn = sql.slice(sql.indexOf('function public.nivel_de_xp'))
  const enSql = [...fn.slice(0, fn.indexOf('$$;')).matchAll(/>= (\d+)\s+then '([^']+)'/g)]
    .map(([, min, nombre]) => [nombre, Number(min)])
    .reverse()
  // El `else 'Novato'` no lleva número: es el suelo, y su mínimo es 0.
  const suelo = /else '([^']+)'/.exec(fn)?.[1]
  const sqlEntero = [[suelo, 0], ...enSql]
  check('y los cinco de la migración', sqlEntero.length === 5, JSON.stringify(sqlEntero))
  check('los dos dicen LO MISMO',
    JSON.stringify(enJs) === JSON.stringify(sqlEntero),
    `js=${JSON.stringify(enJs)} sql=${JSON.stringify(sqlEntero)}`)
}

console.log('\n── 2. El reparto no se puede repetir ni atascar ──')
{
  const sql = leer('supabase-migration-torneos-xp.sql')
  // La idempotencia no es «con cuidado»: es una clave y un `do nothing`.
  check('los premios llevan la pareja (torneo, persona) como clave',
    /primary key \(tournament_id, user_id\)/.test(sql))
  check('y el INSERT no repite', /on conflict \(tournament_id, user_id\) do nothing/.test(sql))
  // Y el XP solo se suma por lo que el INSERT metió DE VERDAD.
  check('el XP se suma solo por las filas nuevas',
    /returning user_id, amount/.test(sql) && /from metidos m/.test(sql))
  // El nivel, en el MISMO update que el XP: si se dejara para otra
  // pasada, entre las dos habría alguien con 4.000 y chapa de Novato.
  const upd = sql.slice(sql.indexOf('update public.user_profiles'))
  check('el nivel se recalcula en el mismo update que el XP',
    /level = public\.nivel_de_xp/.test(upd.slice(0, upd.indexOf('returning'))), upd.slice(0, 220))
  // La cola tiene que poder vaciarse: «lo miré y no había nada» se marca
  // igual que «lo miré y repartí» (tandas 333, 380 y 381).
  const fin = sql.slice(sql.indexOf('if v_jugadores >= 4'))
  check('se marca el torneo aunque no se reparta nada',
    fin.indexOf('update public.tournaments set xp_awarded_at') > fin.indexOf('end if;'), 'el sello está dentro del if')
  // Sin podio sellado no se reparte: eso es «aún no se sabe», no «no ha
  // ganado nadie».
  check('sin podio congelado no se reparte', /and podium is not null/.test(sql))
  // Y nadie con sesión puede llamarla: escribe en user_profiles.
  check('la función no está al alcance de nadie con sesión',
    /revoke all on function public\.torneos_repartir_xp\(uuid\) from public, anon, authenticated/.test(sql))
  // Estar inscrito no es haber jugado: si contara la inscripción, cuatro
  // cuentas apuntadas y ni una partida serían XP gratis.
  check('hay que haber jugado una mesa, no solo apuntarse',
    /from public\.tournament_matches m/.test(sql) && /m\.status in \('finished'/.test(sql))
  check('y un torneo de menos de cuatro no reparte', /if v_jugadores >= 4 then/.test(sql))
}

console.log('\n── 3. El barredor cuenta en los dos returns ──')
{
  // La trampa: `procesar()` tiene un `return` temprano para cuando no hay
  // ninguna ronda activa. Una fase nueva que se cuente solo en el return
  // final sale a cero en casi todas las pasadas, y eso no da error: el
  // registro dice que no pasó nada.
  const f = leer('netlify/functions/torneos-barredor.mjs')
  const cuerpo = f.slice(f.indexOf('async function procesar'))
  const contadores = [...cuerpo.matchAll(/^\s*let (\w+) = 0$/gm)].map((m) => m[1])
  check('hay contadores que vigilar', contadores.length >= 5, contadores.join(','))
  // El `return` de «sin clave de servicio» se queda fuera: es la salida
  // de emergencia, no ha corrido ninguna fase y no tiene qué contar.
  // El `return` de «sin clave de servicio» se queda fuera: es la salida
  // de emergencia, no ha corrido ninguna fase y no tiene qué contar.
  //
  // Y a cada contador se le exigen solo los returns que vienen DESPUÉS
  // de donde se incrementa: el return temprano no puede contar una fase
  // que todavía no ha corrido. Esa es la regla, y así no hace falta una
  // lista de excepciones que se quede vieja.
  const returns = [...cuerpo.matchAll(/return \{[^}]*\}/gs)]
    .filter((m) => m[0].includes('ok: true') && !m[0].includes('saltado'))
    .map((m) => ({ texto: m[0], donde: m.index }))
  check('y hay más de un return', returns.length >= 2, `${returns.length}`)
  const huecos = []
  for (const c of contadores) {
    const sube = cuerpo.search(new RegExp(`\\b${c}\\+\\+`))
    if (sube === -1) continue
    for (const [i, r] of returns.entries()) {
      if (r.donde > sube && !new RegExp(`\\b${c}\\b`).test(r.texto)) {
        huecos.push(`${c} se cuenta antes del return ${i + 1} y no sale en él`)
      }
    }
  }
  check('ningún contador se queda fuera de un return', huecos.length === 0, huecos.join(' | '))
  // Y el tope, porque una función programada de Netlify se mata a los 30 s.
  check('el reparto va con tope por pasada', /xp_awarded_at=is\.null[^`]*limit=\d+/.test(f))
}

console.log('\n── 4. El hilo de actividad va LIMPIO ──')
{
  // La 387 metió aquí la chapa del nivel y PINGU la quitó al verla
  // (tanda 389): «antes se veía más limpio». Y tenía razón por el mismo
  // motivo que el nombre no se tiñe — casi todo el mundo es Novato, así
  // que era una pastilla gris idéntica en cada fila. Peor aún en las
  // filas de «se ha unido a PokeDoc», que son Novato POR DEFINICIÓN: una
  // marca que no puede decir nada nuevo nunca.
  //
  // Esto lo vigila para que no vuelva a entrar por descuido.
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } })
  await page.addInitScript(() => {
    window.__FAKE_PERFILES__ = [
      { id: 'admin-1', username: 'Oak', display_name: 'Oak', is_admin: true, total_xp: 9000 },
    ]
    window.__FAKE_GUIAS__ = Array.from({ length: 5 }, (_, i) => ({ title: `Guía ${i + 1}` }))
    window.__FAKE_NOTICIAS__ = []
    window.__FAKE_TEMAS__ = []
  })
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const filas = await page.locator('#homeActivityFeed .activity-item').count()
  check('el hilo de actividad tiene filas', filas > 0, `${filas}`)
  check('y ninguna lleva chapa de nivel',
    (await page.locator('#homeActivityFeed .nivel-chapa').count()) === 0)
  // El NOMBRE sí sigue llevando el color de su rango: eso son tres
  // valores, no cinco, y no se repite en cada línea.
  const fila = page.locator('#homeActivityFeed .activity-item').first()
  const color = await fila.locator('.activity-name').evaluate((e) => getComputedStyle(e).color)
  const token = await page.evaluate(() => {
    const d = document.createElement('i')
    d.style.color = getComputedStyle(document.documentElement).getPropertyValue('--rango-admin')
    document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c
  })
  check('pero el nombre sigue con el color de su rango', color === token, `${color} vs ${token}`)
  await browser.close()
}

console.log('\n── 5. El nombre NO se tiñe por nivel ──')
{
  // El barrido: ninguno de los cinco colores de nivel puede acabar
  // pintando letra. Están elegidos para el fondo oscuro y para una
  // chapa, cuya CSS los oscurece un 45% — como texto sobre blanco dan
  // entre 2,1 y 3,3, y la WCAG pide 4,5.
  const g = leer('js/gamification.js')
  const colores = [...g.matchAll(/color: '(#[0-9a-f]{6})'/gi)].map((m) => m[1].toLowerCase())
  check('se leen los cinco colores de nivel', colores.length === 5, colores.join(','))

  const L = (h) => {
    const [r, v, a] = h.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * v + 0.0722 * a
  }
  const contra = (a, b) => {
    const [x, y] = [L(a), L(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  // Esto no es un fallo que arreglar: es la RAZÓN de que el nivel vaya en
  // chapa y no en el nombre. Si algún día alguien los aclara para poder
  // teñir, esta comprobación se cae y hay que venir a decidirlo a mano.
  const flojos = colores.filter((c) => contra(c, '#ffffff') < 4.5)
  check('los cinco siguen sin valer como letra sobre blanco',
    flojos.length === 5, `valen como letra: ${colores.filter((c) => !flojos.includes(c)).join(',')}`)

  // Un hex suelto en una hoja no prueba nada: dos de estos cinco están
  // en el CSS por otras cosas (un verde de «hecho», un azul de aviso).
  // Lo que importa es que nadie pueda COGER un color de nivel para
  // pintar con él: `NIVEL_ESTILOS` no sale de gamification.js, y el
  // único que lo lee es `levelBadgeHtml`, que lo mete en `--chapa`.
  const fuera = []
  for (const f of ['js', 'js/mi-coleccion', 'js/torneos', 'js/constructor']) {
    let entradas = []
    try { entradas = readdirSync(`${RAIZ}/${f}`) } catch { continue }
    for (const e of entradas) {
      if (!e.endsWith('.js') || `${f}/${e}` === 'js/gamification.js') continue
      if (/\bNIVEL_ESTILOS\b/.test(readFileSync(`${RAIZ}/${f}/${e}`, 'utf8'))) fuera.push(`${f}/${e}`)
    }
  }
  check('la paleta de niveles no sale de gamification.js', fuera.length === 0, fuera.join(','))
  check('  …y quien la lee la mete en --chapa, no en un color',
    /--chapa:\$\{estilo\.color\}/.test(leer('js/gamification.js')))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
