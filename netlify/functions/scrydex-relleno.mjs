import {
  cabecerasDe, urlDeSonda, filaDeCartaConScrydex, nombreQueHayQueArreglar,
  numeroComparable, laCarta,
} from '../lib/scrydex.mjs'

// Rellenar el catálogo occidental con Scrydex, SOLA y toda la noche (509).
//
// PINGU, antes de irse a la cama: «quiero que me rellenes todas las cartas
// posibles, todos los logos posibles […] mañana cuando me despierte quiero
// poder recomendar esta parte de la web a mis amigos».
//
// Por eso esto es una función PROGRAMADA y no un botón: un botón necesita
// a alguien delante. Las tandas 507 y 508 dejaron los 167 sets emparejados
// y verificados; esto baja sus cartas.
//
// ── POR QUÉ ESTO NO CUESTA 21.476 PETICIONES ──
//
// Porque su LISTADO trae la carta COMPLETA —imagen, ilustrador, Pokédex,
// PS, rareza y la expansión entera anidada—, así que el catálogo inglés
// son ~101 páginas de 250. Es lo CONTRARIO de TCGdex, donde el listado de
// un set es un «SetResume» y engordar cuesta una petición por carta
// (tandas 233 y 322). Son dos costes que no se parecen en nada y conviene
// no confundirlos.
//
// ── CÓMO SE REANUDA ──
//
// Una función programada de Netlify se mata a los 30 segundos, así que
// lleva su propio presupuesto de tiempo y lo que no da tiempo se queda
// para la pasada siguiente (la lección de la 322). La posición vive en
// `scrydex_estado`, que es lo ÚNICO que no se puede sacar de los datos:
// por qué página de las SUYAS iba.
//
// ── LO QUE NO HACE, A PROPÓSITO ──
//
// · No inserta cartas que no tengamos. Ellos tienen 25.209 y nosotros
//   21.476; sus ids son suyos y los nuestros vienen de TCGdex, así que
//   insertar dejaría un catálogo con dos nomenclaturas y las colecciones
//   de la gente apuntando a una de ellas. Las cuenta y las deja dichas.
// · No toca `rarity`, `types` ni `category`: lo nuestro está en español y
//   lo suyo en inglés (ver `filaDeCartaConScrydex`).
// · No toca un set cuyo emparejamiento no esté verificado.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
// ── UN MERCADO POR PASADA, Y POR PARÁMETRO (tanda 537) ──
//
// Esto llevaba `WEST` y `en` a fuego, con su porqué al lado, y el porqué
// era que el japonés no estaba emparejado. Ya lo está (la 530 trajo sus 231
// expansiones), así que lo que faltaba era que esta función supiera
// trabajar para los dos.
//
// Y va por PARÁMETRO y no copiando el fichero: dos copias de un bucle con
// frenos se separan sin que nadie se entere, y entonces el freno que
// arreglas en una sigue roto en la otra (la lección de la 471, que costó
// una guarda mirando a un fichero vacío durante tres tandas).
const MERCADO_POR_DEFECTO = 'WEST'
const IDIOMA_POR_DEFECTO = 'en'
const PAGINA = 250
// Presupuesto de tiempo: Netlify mata a los 30 s. Se para en 20 para que
// dé tiempo a escribir lo que lleve y a guardar por dónde iba.
const MS_DE_MARGEN = 20_000
const CLAVE_POR_DEFECTO = 'cartas-west'
// Un respiro entre peticiones, como en `cartas-detalle` (tanda 233). Sin
// él son 60 peticiones seguidas en doce segundos contra una API de pago
// que no conozco: un 429 pararía la pasada entera, y la primera pasada de
// verdad es A CIEGAS —desde este contenedor su red está cerrada, así que
// no he podido probarla ni una vez—. Pararse por educación cuesta unos
// segundos; que te corten cuesta la noche.
const MS_ENTRE_PETICIONES = 250
// Cuántas veces se reintenta la MISMA página antes de pasar de largo.
const FALLOS_PARA_SALTAR = 5
const respirar = (ms) => new Promise((r) => setTimeout(r, ms))
// ── EL FRENO, que es lo que impide que esto se coma el plan ──
//
// Sin él: un barrido completo son 101 páginas = 101 créditos, y a 60
// páginas por pasada cada cinco minutos son **48 barridos en una noche =
// 4.848 créditos**, con 5.000 al MES. Se habría comido el plan entero
// antes de que nadie se despertara, y encima para reescribir lo mismo.
//
// Así que para por DOS sitios, y hacen falta los dos:
//
//   1. **Si no queda ninguna carta por marcar, no gasta ni un crédito.**
//      El trabajo está hecho y la función se calla sola.
//   2. **Y un tope de barridos completos**, porque lo primero no basta:
//      hay cartas nuestras que NO EXISTEN en su catálogo —ellos tienen
//      25.209 y nosotros 21.476, pero no son el mismo conjunto—, así que
//      esas no se marcan nunca y «quedan pendientes» sería verdad para
//      siempre. Sin el tope, el freno de arriba no frena.
// UNO, no dos. Cada carta suya sale EXACTAMENTE UNA VEZ en la
// paginación, así que un barrido completo las ve todas: el segundo
// reescribiría las mismas 21.476 filas por 101 créditos más. Y si una
// pasada se muere a medias no se pierde nada, porque se reanuda por la
// página guardada y no volviendo a empezar.
//
// PINGU: «gástame los créditos mínimos, que acabo de pagar el plan y
// seguramente tengamos que hacer más peticiones estos días para corregir
// cosas». Con esto el catálogo entero cuesta ~101 de los 5.000.
const BARRIDOS_MAXIMOS = 1
// Pasado ese tope se vuelve a mirar de vez en cuando, porque salen cartas
// nuevas: una vez por semana, que son 101 créditos y no 4.848.
const DIAS_ENTRE_REPASOS = 7

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      ...(opciones ? { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
      ...(opciones?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return opciones ? null : res.json()
}

// Cuántas cartas nuestras no ha tocado todavía Scrydex. Sale de un
// `count` de PostgREST, que no baja ni una fila.
// ¿Queda alguna carta nuestra sin tocar por Scrydex? No hace falta el
// número exacto —la decisión es «sí o no»— y una fila es más barato que
// un `count` sobre 21.476. Si la consulta falla se contesta que SÍ: el
// tope de barridos protege igual, y pararse por un fallo de red sería
// dejar el trabajo a medias por el motivo equivocado.
async function quedanPendientes(pedir, MERCADO) {
  try {
    const r = await pedir(`tcg_cards?select=id&market=eq.${MERCADO}&scrydex_at=is.null&limit=1`)
    return Array.isArray(r) ? r.length > 0 : true
  } catch {
    return true
  }
}

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, escribirImpl = null,
  estadoImpl = null, guardarEstadoImpl = null, reloj = () => Date.now(),
  paginas = 60,
  mercado = MERCADO_POR_DEFECTO, idioma = IDIOMA_POR_DEFECTO, claveEstado = CLAVE_POR_DEFECTO,
} = {}) {
  const MERCADO = mercado
  const IDIOMA = idioma
  const CLAVE_ESTADO = claveEstado
  const { cabeceras, faltan } = cabecerasDe(env)
  if (faltan) return { estado: 500, cuerpo: { error: `Faltan en Netlify: ${faltan.join(' y ')}.` } }
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { estado: 500, cuerpo: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' } }
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < MS_DE_MARGEN

  const pedir = restImpl || ((ruta) => rest(ruta, clave))
  const guardar = escribirImpl || ((tabla, filas) => rest(tabla, clave, { method: 'POST', body: JSON.stringify(filas) }))
  const leerEstado = estadoImpl || (async () => {
    const f = await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`)
    return f?.[0]?.valor || {}
  })
  const guardarEstado = guardarEstadoImpl || ((valor) => rest('scrydex_estado', clave, {
    method: 'POST',
    body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: new Date().toISOString() }]),
  }))

  // ── Quién es quién: el emparejamiento ya verificado por la 507 ──
  //
  // Un set sin `scrydex_id` no está verificado y NO se toca: un par falso
  // metería las cartas de otro set dentro del nuestro sin dar error, que
  // es lo que costaron las tandas 504 y 505.
  const sets = await pedir(`tcg_sets?select=id,scrydex_id&market=eq.${MERCADO}&scrydex_id=not.is.null&limit=400`)
  const nuestroSetDe = new Map()
  for (const s of sets || []) nuestroSetDe.set(String(s.scrydex_id).toLowerCase(), s.id)
  if (!nuestroSetDe.size) {
    return { estado: 409, cuerpo: { error: 'Ningún set tiene `scrydex_id`: pasa antes «Traer los logos de Scrydex» en /admin.' } }
  }

  const estado = await leerEstado()
  let pagina = Number(estado?.pagina) > 0 ? Number(estado.pagina) : 1
  let total = Number(estado?.total) || 0
  const barridos = Number(estado?.barridos) || 0

  // ── PARADO: ni un crédito más (tanda 526) ──
  //
  // Se mira ANTES de pedirle nada a Scrydex y después de leer el estado,
  // que sale de nuestra base y es gratis. Lo pone `tropiezo` cuando el
  // que falla cinco veces seguidas somos nosotros, y lo quita un humano
  // —`supabase-migration-scrydex-reiniciar-relleno.sql`—, a propósito: si
  // se quitara solo, volvería a gastar sin que nadie haya mirado por qué
  // fallaba.
  if (estado?.parado) {
    return {
      estado: 200,
      cuerpo: {
        PARADO: estado.parado,
        creditos: 0,
        pagina,
        porque: 'falló nuestra base cinco veces seguidas. No se gasta nada hasta que alguien lo mire y lo reanude.',
      },
    }
  }

  // ── ¿Hay algo que hacer? ──
  //
  // Se pregunta ANTES de gastar un crédito, y la respuesta sale de
  // nuestra propia base, que es gratis. Si no queda nada por marcar, o si
  // ya se han dado los barridos que tocaban y no toca repaso, se calla.
  const pendientes = await quedanPendientes(pedir, MERCADO)
  const enMitadDeUnBarrido = pagina > 1
  const diasDesdeElUltimo = estado?.completadoEn
    ? (Date.now() - Date.parse(estado.completadoEn)) / 86_400_000
    : Infinity
  const tocaRepaso = barridos >= BARRIDOS_MAXIMOS && diasDesdeElUltimo >= DIAS_ENTRE_REPASOS
  if (!enMitadDeUnBarrido && !tocaRepaso && (!pendientes || barridos >= BARRIDOS_MAXIMOS)) {
    return {
      estado: 200,
      cuerpo: {
        hecho: true,
        creditos: 0,
        porque: !pendientes
          ? 'no queda ninguna carta por marcar'
          : `ya se han dado ${barridos} barridos completos; lo que queda son cartas que su catálogo no tiene`,
        quedanPendientes: pendientes,
        barridos,
        proximoRepasoEnDias: Math.max(0, Math.ceil(DIAS_ENTRE_REPASOS - diasDesdeElUltimo)),
      },
    }
  }

  let vistas = 0
  let escritas = 0
  let nombresArreglados = 0
  let sinSetNuestro = 0
  let sinCartaNuestra = 0
  let paginasHechas = 0
  let conNombreOccidental = 0
  const rarezas = new Map()
  const ejemplosDeNombre = []

  // ── UN TROPIEZO ES UN TROPIEZO, VENGA DE DONDE VENGA (tanda 510) ──
  //
  // Esto estaba escrito SOLO para un fallo de su API, y por debajo se
  // colaba el nuestro: la petición a Scrydex va ANTES de hablar con
  // Supabase, así que si Supabase falla **el crédito ya está gastado**, la
  // página no avanza, y se reintenta cada cinco minutos para siempre — 288
  // créditos al día. Es la cuarta vez esta noche con la misma forma, y las
  // tres anteriores me las había mirado sin ver esta.
  // ── Y SALTAR NO VALE PARA LOS DOS LADOS (tanda 526) ──
  //
  // Anoche junté los dos fallos en este mismo manejador y la mitad quedó
  // mal: saltarse la página es lo correcto cuando **esa página** es la
  // mala —un 500 suyo, un id raro—, porque el problema se queda atrás. Si
  // el que falla es NUESTRO Supabase, la página no tiene nada que ver, y
  // saltarla es pagar un crédito por página para no escribir nada: cinco
  // intentos × 101 páginas = **505 créditos para un barrido en blanco**.
  // Es exactamente lo que pasó: el panel decía «página 42» y las cartas
  // escritas eran CERO.
  //
  // Así que lo nuestro PARA, y para de verdad: queda escrito en el estado
  // y la pasada siguiente se sale antes de pedirle nada a Scrydex. Un
  // fallo que se repite en nuestro lado no se arregla reintentando, se
  // arregla mirándolo — y mientras tanto no se paga.
  const tropiezo = async (porque, codigo, { nuestro = false } = {}) => {
    const fallos = (Number(estado?.fallos) || 0) + 1
    const seRinde = fallos >= FALLOS_PARA_SALTAR
    const seSalta = seRinde && !nuestro
    const separa = seRinde && nuestro
    await guardarEstado({
      pagina: seSalta ? pagina + 1 : pagina,
      total,
      barridos,
      fallos: seSalta ? 0 : fallos,
      ...(seSalta ? { saltadas: [...(estado?.saltadas || []), pagina].slice(-20) } : {}),
      ...(separa ? { parado: porque } : {}),
      error: porque,
      cuando: new Date().toISOString(),
    })
    return {
      estado: codigo,
      cuerpo: {
        error: `${porque} en la página ${pagina}`,
        pagina,
        intentos: fallos,
        ...(seSalta ? { AVISO: `Esa página ha fallado ${fallos} veces: se salta y se sigue. Quedan ~250 cartas sin marcar.` } : {}),
        ...(separa ? { PARADO: `Ha fallado ${fallos} veces seguidas y el fallo es NUESTRO, así que no se salta la página: se para. No se gastará ni un crédito más hasta que alguien lo mire.` } : {}),
      },
    }
  }

  while (paginasHechas < paginas && quedaTiempo()) {
    if (paginasHechas > 0) await respirar(MS_ENTRE_PETICIONES)
    const res = await fetchImpl(urlDeSonda(`${IDIOMA}/cards`, { page: pagina, page_size: PAGINA }), { headers: cabeceras })
    if (!res.ok) {
      // ── UNA PÁGINA QUE FALLA SIEMPRE NO PUEDE BLOQUEAR EL BARRIDO ──
      //
      // Guardar la página y salir es lo correcto para un fallo pasajero:
      // la pasada siguiente la reintenta. Pero si falla SIEMPRE —un id
      // raro, un 500 suyo que no se arregla—, se reintenta cada cinco
      // minutos **para siempre**: un crédito cada vez, 288 al día, y el
      // catálogo se queda a medias en la página 40 sin que nadie se
      // entere. Es el mismo bicho que el barrido infinito, por el otro
      // lado.
      //
      // A la quinta se pasa de largo y se deja dicho cuál se saltó. Una
      // página perdida son 250 cartas que se quedan sin marcar; un barrido
      // parado para siempre son 21.476.
      return tropiezo(`Scrydex ${res.status}`, 502)
    }
    const j = await res.json()
    const lote = Array.isArray(j?.data) ? j.data : []
    // SU page_size MANDA, no el que pedí (tanda 509): la respuesta dice el
    // que de verdad aplicó, así que no hace falta inventarse el máximo —
    // que es justo el error que costó la 501.
    const suTam = Number(j?.page_size) || lote.length || PAGINA
    total = Number(j?.total_count) || total
    paginasHechas++
    if (!lote.length) {
      // Fin del catálogo: se vuelve a empezar, porque sacan cartas nuevas.
      await guardarEstado({ pagina: 1, total, barridos: barridos + 1, completadoEn: new Date().toISOString() })
      break
    }

    try {
    // Las cartas NUESTRAS de los sets que salen en esta página.
    const susSets = [...new Set(lote.map((c) => String(c?.expansion?.id || '').toLowerCase()).filter(Boolean))]
    const nuestrosIds = susSets
      .map((s) => nuestroSetDe.get(s))
      .filter((id) => id && !/[,()"\s]/.test(id))
    const nuestras = nuestrosIds.length
      ? await pedir(
        'tcg_cards?select=id,market,set_id,local_id,name,name_es,name_en,image_scrydex,rarity_en,rarity_code,illustrator,dex_ids,hp'
        + `&market=eq.${MERCADO}&set_id=in.(${nuestrosIds.map(encodeURIComponent).join(',')})&limit=20000`,
      )
      : []
    const porClave = new Map()
    for (const c of nuestras || []) porClave.set(`${c.set_id}|${numeroComparable(c.local_id)}`, c)

    const filas = []
    const nombres = []
    for (const suya of lote) {
      vistas++
      if (suya?.rarity) rarezas.set(suya.rarity, (rarezas.get(suya.rarity) || 0) + 1)
      const nuestroSet = nuestroSetDe.get(String(suya?.expansion?.id || '').toLowerCase())
      if (!nuestroSet) { sinSetNuestro++; continue }
      const nuestra = porClave.get(`${nuestroSet}|${numeroComparable(suya?.number)}`)
      if (!nuestra) { sinCartaNuestra++; continue }
      filas.push(filaDeCartaConScrydex(nuestra, suya))
      // ¿TRAEN SUS CARTAS EL NOMBRE OCCIDENTAL? (tanda 539)
      //
      // En sus EXPANSIONES viene (`translation.en.name`, lo vimos en la
      // sonda de la 528). En sus CARTAS lo escribí dando por hecho que
      // también, y eso es justo lo que la 484 y la 486 me enseñaron a no
      // hacer: deducir de una muestra de otra cosa. Así que se CUENTA, y
      // el panel lo dirá sin que nadie pregunte ni gaste un crédito.
      if (suya?.translation?.en?.name) conNombreOccidental++
      const bueno = nombreQueHayQueArreglar(nuestra, suya)
      if (bueno) {
        // `local_id` va aquí por lo mismo que en `filaDeCartaConScrydex`:
        // es `not null` y esto es un upsert, así que sin él la sentencia
        // entera se cae con 23502 (tanda 526).
        nombres.push({ id: nuestra.id, market: nuestra.market || MERCADO, set_id: nuestra.set_id, local_id: nuestra.local_id, name: bueno })
        if (ejemplosDeNombre.length < 15) ejemplosDeNombre.push(`${nuestra.id}: «${nuestra.name}» → «${bueno}»`)
      }
    }

    if (filas.length) { await guardar('tcg_cards', filas); escritas += filas.length }
    // El nombre va en SU PROPIA sentencia: es la única columna que PISA
    // algo, y lleva claves distintas de las de arriba —PostgREST las
    // exige uniformes dentro de una misma sentencia—.
    if (nombres.length) { await guardar('tcg_cards', nombres); nombresArreglados += nombres.length }
    } catch (e) {
      // Lo nuestro también cuenta como tropiezo: si no, un Supabase que
      // falla siempre quema un crédito cada cinco minutos para siempre.
      return tropiezo(`Nuestra base: ${String(e?.message || e).slice(0, 90)}`, 500, { nuestro: true })
    }

    pagina++
    if (total && (pagina - 1) * suTam >= total) {
      await guardarEstado({ pagina: 1, total, barridos: barridos + 1, completadoEn: new Date().toISOString() })
      break
    }
    // Los fallos se cuentan SEGUIDOS, no en total: cinco tropiezos
    // sueltos a lo largo de un barrido no deben saltarse una página sana.
    await guardarEstado({
      pagina, total, barridos, fallos: 0, cuando: new Date().toISOString(),
      // Cuántas de las que se han escrito traían nombre occidental. Si
      // acaba en 0 con miles escritas, es que sus cartas no lo traen —y
      // entonces el japonés se queda en japonés por su catálogo, no por
      // nuestro código.
      conNombreOccidental, escritas,
    })
  }

  return {
    estado: 200,
    cuerpo: {
      paginasHechas,
      creditos: paginasHechas,
      barridos,
      quedabanPendientes: pendientes,
      siguientePagina: pagina,
      susCartas: total,
      vistas,
      escritas,
      conNombreOccidental,
      // EL ARREGLO DEL HALLAZGO DE LA 505: ~1.890 cartas occidentales
      // llevan el español en `name`, que es la clave con la que se cruzan
      // `tcg_card_play`, el resolutor de decklists y la huella de las
      // reimpresiones. No casan con nada, sin dar error.
      nombresArreglados,
      ejemplosDeNombre,
      // Cartas suyas de sets que no tenemos emparejados o que no tenemos.
      // Se dicen, no se insertan.
      sinSetNuestro,
      sinCartaNuestra,
      // Su vocabulario de rarezas, aprendido de los datos: es como se
      // sabe qué hay que traducir sin inventarse la lista.
      rarezasVistas: Object.fromEntries([...rarezas.entries()].sort((a, b) => b[1] - a[1])),
    },
  }
}

export default async () => {
  try {
    const r = await procesar()
    return new Response(JSON.stringify(r.cuerpo), { status: r.estado, headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const config = { schedule: '*/5 * * * *' }
