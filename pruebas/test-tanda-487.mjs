// Tanda 487 — el null que borra una foto buena al reimportar.
//
// Lo dejó señalado la sesión de COWORK, que midió TCGdex de verdad (un HEAD
// por carta a las 20.442 asiáticas): **la API se calla `image` en miles de
// cartas cuyo fichero SÍ está publicado**. En japonés dice 3.882 y existen
// 7.365; en chino tradicional, 2.146 contra 2.242.
//
// `cardToRow` pone `image_path: null` cuando el campo no viene. Eso es
// inofensivo al INSERTAR —la columna nace vacía igual— y destructivo al
// REIMPORTAR: las dos importaciones escriben con `merge-duplicates`, así
// que el null PISA una foto que ya estuviera guardada. O sea que «importar
// los que faltan» borraría todo escaneo encontrado buscando el fichero a
// mano, **sin dar ningún error** — y además la carta se queda marcada como
// ya mirada.
//
// Y no vale omitir la clave y ya: PostgREST exige que todos los objetos de
// UNA sentencia tengan LAS MISMAS claves. Son dos sentencias.
import { readFileSync } from 'node:fs'
import { porImagen, cardToRow } from '/home/user/pingu/js/catalogo-tcgdex.js'

const leer = (p) => readFileSync(`/home/user/pingu/${p}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. `cardToRow` sigue poniendo el null (no se cambia ahí) ──')
//
// A propósito: la fila que sale de aquí describe lo que la API dijo, y lo
// que la API dijo es «no hay imagen». Quien no puede mandar ese null es el
// que ESCRIBE con merge-duplicates, que es otra decisión y otro sitio.
{
  const sinFoto = cardToRow({ id: 'SM1M-1', localId: '001', name: 'トロピウス' }, 'SM1M', 'JP')
  check('una carta sin `image` sale con `image_path: null`', sinFoto.image_path === null, JSON.stringify(sinFoto))
  const conFoto = cardToRow({ id: 'SV1a-1', localId: '001', name: 'トロピウス', image: 'https://assets.tcgdex.net/ja/SV/SV1a/001' }, 'SV1a', 'JP')
  check('  …y una con `image`, con su camino', conFoto.image_path === 'SV/SV1a/001', JSON.stringify(conFoto.image_path))
}

console.log('\n── 2. `porImagen` las parte en dos ──')
{
  const filas = [
    { id: 'a', market: 'JP', image_path: 'SV/SV1a/001' },
    { id: 'b', market: 'JP', image_path: null },
    { id: 'c', market: 'JP', image_path: 'SV/SV1a/003' },
    { id: 'd', market: 'JP', image_path: '' },
  ]
  const { con, sin } = porImagen(filas)
  check('las que traen foto, aparte', con.length === 2 && con.every((f) => f.image_path), JSON.stringify(con.map((f) => f.id)))
  check('  …y mencionan la columna', con.every((f) => 'image_path' in f))
  check('las que no, aparte', sin.length === 2, JSON.stringify(sin.map((f) => f.id)))
  // LO QUE IMPORTA: no la mencionan. Una columna que no se menciona en un
  // `merge-duplicates` no se toca, y eso es todo el arreglo.
  check('  …y NO mencionan la columna', sin.every((f) => !('image_path' in f)), JSON.stringify(sin))
  // La cadena vacía cuenta como «no hay»: un `image_path: ''` montaría la
  // dirección `/ja//low.webp`, que es una foto rota guardada como buena.
  check('la cadena vacía cuenta como que no hay', sin.some((f) => f.id === 'd'))
  // Y no se pierde ni se inventa nada más de la fila.
  check('lo demás de la fila se conserva', sin.every((f) => f.id && f.market), JSON.stringify(sin))
  check('ni una fila se cae', con.length + sin.length === filas.length)
}

console.log('\n── 3. Y no se rompe con lo raro ──')
{
  check('sin filas', porImagen([]).con.length === 0 && porImagen([]).sin.length === 0)
  check('con nada', porImagen(null).sin.length === 0 && porImagen(undefined).con.length === 0)
  const { con, sin } = porImagen([null, { id: 'x' }, undefined])
  check('los huecos se caen', con.length === 0 && sin.length === 1, JSON.stringify(sin))
  // PostgREST exige MISMAS claves por sentencia: si un grupo saliera con
  // formas distintas, la sentencia entera fallaría.
  const mezcla = porImagen([{ id: 'a', market: 'JP', image_path: null }, { id: 'b', market: 'JP' }])
  const claves = mezcla.sin.map((f) => Object.keys(f).sort().join(','))
  check('cada grupo sale con las MISMAS claves', new Set(claves).size === 1, JSON.stringify(claves))
}

console.log('\n── 4. Los dos sitios que escriben cartas lo usan ──')
//
// Son los dos únicos, y los dos escriben con `merge-duplicates`. Si
// mañana aparece un tercero, esta comprobación no lo ve — pero el barrido
// de abajo sí: busca un upsert de `tcg_cards` que NO pase por aquí.
{
  const admin = leer('admin/js/admin.js')
  const asia = leer('netlify/functions/catalogo-asia.mjs')
  check('/admin lo importa', /porImagen/.test(admin) && /from '\.\.\/\.\.\/js\/tcgdex\.js'/.test(admin))
  check('  …y parte el upsert', /const \{ con, sin \} = porImagen\(filas\)/.test(admin))
  check('  …escribiendo los DOS grupos', /for \(const grupo of \[con, sin\]\)/.test(admin))
  check('`catalogo-asia` lo importa', /porImagen/.test(asia))
  check('  …y parte el insert', /const \{ con, sin \} = porImagen\(filas\)/.test(asia))
  check('  …escribiendo los DOS grupos', /for \(const grupo of \[con, sin\]\)/.test(asia))
}

console.log('\n── 5. El barrido: nadie escribe `tcg_cards` sin partir ──')
//
// La forma del fallo y no el caso (la lección de la 303): cualquier
// escritura futura de `tcg_cards` con merge-duplicates tiene el mismo
// agujero, así que se busca la FORMA.
{
  const ficheros = [
    'admin/js/admin.js',
    'netlify/functions/catalogo-asia.mjs',
    'netlify/functions/cartas-detalle.mjs',
    'js/tcgdex.js',
    'js/catalogo-tcgdex.js',
  ]
  const culpables = []
  for (const f of ficheros) {
    const txt = leer(f)
    // Un upsert de cartas: o `.upsert(` sobre `tcg_cards`, o un POST con
    // `merge-duplicates` a `tcg_cards?on_conflict=`.
    const hayUpsert =
      /from\('tcg_cards'\)\s*\.upsert\(/.test(txt) || /tcg_cards\?on_conflict=[^']*'[\s\S]{0,400}?merge-duplicates/.test(txt)
    if (hayUpsert && !/porImagen/.test(txt)) culpables.push(f)
  }
  check('ninguno escribe cartas sin pasar por `porImagen`', culpables.length === 0, culpables.join(', '))
  // Y que el barrido LLEGUE: de ficheros donde no encuentra ni un upsert
  // no se puede decir nada (la lección de la 307).
  const conUpsert = ficheros.filter((f) => {
    const txt = leer(f)
    return /from\('tcg_cards'\)\s*\.upsert\(/.test(txt) || /tcg_cards\?on_conflict=/.test(txt)
  })
  check('  …y el barrido encuentra los que hay', conUpsert.length >= 2, conUpsert.join(', '))
}

console.log('\n── 6. El porqué está escrito donde se va a leer ──')
{
  const puro = leer('js/catalogo-tcgdex.js')
  check('`porImagen` explica qué pisa el null', /PISA una foto/.test(puro))
  check('  …y por qué son DOS sentencias', /LAS MISMAS claves/.test(puro))
  check('y `CLAUDE.md` tiene los números medidos', /7\.365/.test(leer('CLAUDE.md')))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
