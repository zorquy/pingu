// Tanda 861 — las versiones con nombre (y con producto propio) de TCGGO.
//
// PINGU, con el Drakloak de Ascended Heroes: TCGGO lo tiene tres veces —la
// Standard (31610), la «Energy Symbol Pattern» (50937) y la «Quick Ball»
// (50939)—, las tres con el número 159 y CADA UNA con su producto de
// Cardmarket. Hasta ahora una versión tenía que ser del mismo producto (la
// Reverse del Snorlax, 807), así que estas se contaban como «otra carta».
// Las fichas de esta prueba son LAS QUE PEGÓ PINGU, tal cual (fixtures-861/):
// la 31610 (sin `version`), la 50939 («Quick Ball», producto 870386) y la
// 40760 (la Reverse del Tangrowth de Lost Thunder: sin `version` y con el
// mismo producto que la normal, la forma vieja).
//   1. Lo puro del servidor: qué es cada una y la fila que se guarda.
//   2. La pasada repasa UNA vez lo ya recorrido por arriba.
//   3. Lo puro de la web: el nombre de cada versión y la lista con la Standard.
//   4. La ficha de /carta con las tres del Drakloak.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const lib = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
const fn = await import(`${RAIZ}/netlify/functions/tcggo-versiones.mjs`)
const fixture = (n) => JSON.parse(readFileSync(join(AQUI, 'fixtures-861', `carta-${n}.json`), 'utf8'))
const F = { 31610: fixture(31610), 50939: fixture(50939), 40760: fixture(40760) }
const carta = (n) => lib.cartaDeRespuesta(F[n])

console.log('── 1. Lo puro del servidor ──')
{
  // Nuestro Drakloak, como lo ve la pasada: con el id de TCGGO de su fila de precio y su producto.
  const drakloak = { id: 'me2pt5-159', set_id: 'me2pt5', local_id: '159', nombre: 'Drakloak', producto: 869770, principal: 31610 }
  // Y una hermana de galería con el MISMO número y otro nombre (TG159, que `soloDigitos` deja en 159).
  const galeria = { id: 'me2pt5tg-TG159', set_id: 'me2pt5tg', local_id: 'TG159', nombre: 'Dragapult ex', producto: 111, principal: 777 }
  check('la Standard (31610) es la carta misma', lib.decidirVersion(carta(31610), [drakloak, galeria]).tipo === 'principal')
  const q = lib.decidirVersion(carta(50939), [drakloak, galeria])
  check('la «Quick Ball» (50939), con OTRO producto pero con `version`, es una versión del Drakloak: por el nombre', q.tipo === 'version' && q.carta.id === 'me2pt5-159', JSON.stringify(q))
  check('  …y no de la hermana de galería con el mismo número', lib.decidirVersion(carta(50939), [galeria]).tipo === 'otraCarta')
  const sinVersion = lib.decidirVersion({ ...carta(50939), version: undefined }, [drakloak])
  check('  …pero sin el campo `version`, otro producto sigue siendo otra carta (la sellada)', sinVersion.tipo === 'otraCarta', JSON.stringify(sinVersion))
  const tangrowth = { id: 'sm8-2', set_id: 'sm8', local_id: '2', nombre: 'Tangrowth', producto: 365605, principal: 8499 }
  check('la Reverse del Tangrowth (40760): mismo producto, sin `version`, versión como siempre', lib.decidirVersion(carta(40760), [tangrowth]).tipo === 'version')
  check('la etiqueta: la de TCGGO cuando la da, null cuando no', lib.etiquetaDeVersion(carta(50939)) === 'Quick Ball' && lib.etiquetaDeVersion(carta(40760)) === null && lib.etiquetaDeVersion({ version: '  ' }) === null)
  const fila = lib.filaDeVersion(carta(50939), drakloak, { ahora: new Date('2026-10-15T10:00:00Z') })
  check('la fila guarda la etiqueta, el producto de la versión y su precio', fila.etiqueta === 'Quick Ball' && fila.cm_id_product === 870386 && fila.cm_low === 0.07 && fila.cm_low_es === 0.02 && fila.card_id === 'me2pt5-159', JSON.stringify(fila))
  check('  …y la del Tangrowth va sin etiqueta', lib.filaDeVersion(carta(40760), tangrowth).etiqueta === null)
}

console.log('── 2. La pasada repasa una vez lo ya recorrido ──')
{
  // Un doble mínimo: nuestra base no sabe nada (todo vacío) y TCGGO contesta
  // solo a la sonda; con eso basta para ver por dónde empieza a pedir.
  const pedidas = []
  const pasada = async (estadoIni) => {
    let estado = estadoIni
    const r = await fn.procesar({
      env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' },
      fetchImpl: async (url) => {
        const id = Number(String(url).split('/').pop())
        pedidas.push(id)
        if (id === fn.ID_DE_SONDA) return { ok: true, status: 200, text: async () => JSON.stringify(F[31610]) }
        return { ok: false, status: 404, text: async () => '{"message":"Not found"}' }
      },
      restImpl: async () => [], guardarImpl: async () => {}, borrarImpl: async () => {},
      estadoImpl: async () => estado, guardarEstadoImpl: async (v) => { estado = JSON.parse(JSON.stringify(v)) },
      pausa: async () => {}, ahora: new Date('2026-10-15T10:00:00Z'),
    })
    return { r, estado: () => estado }
  }
  // Un estado de producción: arriba y abajo acabados, en refresco.
  const acabado = { sonda: { fecha: 'x', ruta: 'r' }, subiendo: { siguiente: 60000, vaciosSeguidos: 2000, acabado: true, acabadoAt: '2026-10-14T00:00:00Z' }, bajando: { siguiente: 0, sinVersionSeguidos: 0, acabado: true, acabadoAt: '2026-10-14T00:00:00Z' }, maxVisto: 57999 }
  const a = await pasada(acabado)
  check('con todo recorrido, la primera pasada vuelve a subir desde el 43551 (el repaso de la 861)', a.r.modo === 'subiendo' && pedidas[0] === fn.INICIO && a.estado().repaso861, JSON.stringify({ modo: a.r.modo, primeras: pedidas.slice(0, 3), repaso: a.estado().repaso861 }))
  const b = await pasada(a.estado())
  check('  …y la siguiente sigue por donde iba, sin volver a empezar', b.r.modo === 'subiendo' && pedidas[8] > pedidas[7] && pedidas[8] > fn.INICIO, JSON.stringify(pedidas.slice(6, 10)))
  check('  …con el máximo visto intacto', b.estado().maxVisto === 57999)
}

// Las partes 3 y 4 (el bloque «Versiones en Cardmarket» de /carta) se fueron
// con el bloque en la 998: cada versión es ya una chapa del precio, como en
// el pop-up. Lo vigila test-tanda-998-pantalla.mjs.

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
