// El selector de mazo (tanda 233): escribes «dr» y salen los Pokémon
// con su minisprite, como en trainingcourt.app. Lo pidió PINGU tras
// probar el suyo — escribir el nombre a pelo tiene dos problemas:
//
//   · Se escribe mal. «Dragapult» y «dragapul» son dos mazos distintos
//     para una matriz de enfrentamientos, y parten el histórico en dos
//     sin que nadie se dé cuenta.
//   · No enseña nada. Ver el sprite mientras eliges es lo que hace que
//     no te equivoques de Pokémon.
//
// Un mazo son DOS selectores, porque un arquetipo se nombra por una o
// dos cartas: «Gardevoir» o «Dragapult Dusknoir».
//
// Se busca sobre tres cosas, y las dos primeras son instantáneas porque
// no van a la base:
//   1. Las 1025 especies, con su minisprite.
//   2. El catálogo de arquetipos curado por los admins.
//   3. Las CARTAS de nuestro espejo, para lo que no es un Pokémon. Un
//      mazo se puede llamar por un objeto —«Martillos»— y hasta la
//      tanda 234 eso no se podía elegir: PINGU lo vio enseguida, porque
//      en trainingcourt escribes «hamm» y sale Crushing Hammer.
//      Estas tardan lo que tarde la consulta y se añaden después.
import { POKEMON_POR_DEX, POKEMON_APLASTADOS, FORMAS_TCG, OBJETOS_TCG, urlDeSprite, dexDeCarta, spriteDeObjeto, spriteDeCarta, respaldoDeSprite, atributosDeRespaldo } from './sprites-pokemon.js'
import { searchCards, cardImageUrl } from '../tcgdex.js'

// El escapado va aquí y NO se importa de app.js a propósito: app.js toca
// el DOM al cargarse, y con ese import este módulo no se podría abrir en
// Node para probar el buscador, que es la parte que puede estar mal.
function escapeHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}

// Las opciones que casan con lo tecleado. Se ordenan poniendo delante lo
// que EMPIEZA por lo buscado: con «dr», «Dragapult» tiene que salir
// antes que «Beedrill», que solo lo contiene.
//
// Los ARQUETIPOS del catálogo VUELVEN en la 1461. Se quitaron en la 238
// (Ibai: «que no salgan los arquetipos ya hechos porque no funciona»:
// salían sin sprite y no aportaban nada que elegir los Pokémon no diera), y
// desde la 1460 el catálogo son los de Limitless, con sus dos iconos (Ibai: «adelante»
// a enseñarlos). Salen con los DOS sprites del mazo y se guardan por su id
// (`a:<id>`), que es la clave con la que agrupan los de los torneos. Un
// arquetipo que se llama como una especie («Gardevoir») ocupa su sitio: la
// especie sola caería en el mismo arquetipo al agrupar (claveCanonicaDeMazo).
const aplastar = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
// La opción de un arquetipo del catálogo, con los sprites de sus iconos. La
// usa también Mis partidas al devolver al campo un mazo ya apuntado.
export function opcionDeArquetipo(a) {
  if (!a?.id || !a?.nombre) return null
  const sprites = (a.iconos || []).map((i) => (i?.nombre ? spriteDeCarta(i.nombre) : null)).filter(Boolean).slice(0, 2)
  return { tipo: 'arquetipo', valor: `a:${a.id}`, nombre: a.nombre, sprite: sprites[0] || null, sprites }
}
function opcionesDeArquetipos(q, catalogo) {
  const fuera = []
  for (const a of catalogo || []) {
    if (a?.activo === false) continue
    const opcion = opcionDeArquetipo(a)
    if (!opcion) continue
    const plano = aplastar(a.nombre)
    if (plano.includes(q)) fuera.push({ ...opcion, empieza: plano.startsWith(q) })
  }
  return fuera
}

export function buscarOpciones(texto, catalogo = [], limite = 40) {
  const q = String(texto || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (!q) return []

  const opciones = []

  for (let i = 0; i < POKEMON_POR_DEX.length; i++) {
    const plano = POKEMON_APLASTADOS[i]
    if (!plano.includes(q)) continue
    opciones.push({
      tipo: 'pokemon',
      // La clave de agrupación es la misma que usa arquetipos.js para un
      // mazo deducido, así que una partida apuntada a mano cae en la
      // misma casilla que las de los torneos.
      valor: `d:${POKEMON_POR_DEX[i].toLowerCase()}`,
      nombre: POKEMON_POR_DEX[i],
      sprite: urlDeSprite(i + 1),
      empieza: plano.startsWith(q),
    })
  }

  // Las FORMAS con carta propia (las máscaras de Ogerpon, Bloodmoon
  // Ursaluna): antes solo salía la especie base y las cuatro máscaras
  // eran indistinguibles. Los alias en español no se enseñan — serían
  // el mismo Pokémon dos veces — pero sí casan con lo tecleado, para
  // que «cimiento» encuentre su máscara.
  for (const f of FORMAS_TCG) {
    const plano = f.nombre.toLowerCase().replace(/[^a-z0-9]/g, '')
    const enEspanol = f.alias
      ? String(f.nombre)
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : plano
    if (!enEspanol.includes(q)) continue
    const visible = f.alias ? FORMAS_TCG.find((x) => !x.alias && x.dex === f.dex) : f
    if (!visible) continue
    // Si su versión visible ya está en la lista (casó por su propio
    // nombre), el alias no añade nada.
    if (opciones.some((o) => o.nombre === visible.nombre)) continue
    opciones.push({
      tipo: 'pokemon',
      valor: `d:${visible.nombre.toLowerCase()}`,
      nombre: visible.nombre,
      sprite: urlDeSprite(visible.dex),
      empieza: enEspanol.startsWith(q),
    })
  }

  // Las MEGAS que NO están en la lista curada (tanda 323).
  //
  // `FORMAS_TCG` lleva las megas comprobadas contra la CDN, y la última
  // sonda es del 2026-09-02: todo lo que ha salido después no aparece
  // aquí. Le pasó a Mega-Zeraora — quien la buscaba encontraba
  // «Zeraora» a secas y no había forma de apuntar la partida.
  //
  // El resto del módulo ya sabía resolverlas: `dexDeCarta` pasa por
  // `dexDeClave`, que registra sola cualquier «Mega X» cuya X sea una
  // especie, con su número sintético y su slug. El sprite funcionaba
  // desde el principio; lo único que no se enteraba era ESTE buscador,
  // que recorre listas fijas.
  //
  // Solo se ofrecen si se teclea «mega» y al menos dos letras más. Así
  // nadie ve «Mega Caterpie» por casualidad: solo sale lo que has
  // pedido por su nombre. Y si la CDN todavía no tiene ese sprite, el
  // respaldo da el de la especie base, que es mejor que un hueco.
  const resto = q.startsWith('mega') ? q.slice(4) : ''
  if (resto.length >= 2) {
    // Las especies que YA tienen mega en la lista curada no se
    // sintetizan. No basta con comparar nombres: Charizard y Mewtwo
    // vienen en dos sabores («Mega Charizard X» y «Mega Charizard Y»),
    // así que un «Mega Charizard» a secas pasaría el filtro por nombre
    // y ofrecería una carta que NO EXISTE, encima delante de las dos
    // que sí. Se compara por la ESPECIE, que es lo que las une.
    //
    // Y esto es TAMBIÉN lo que impide los duplicados, así que no hay
    // descarte por nombre detrás: lo había, y el rigor lo marcó como
    // «sin detectar» con razón — quitarlo no cambiaba nada, porque una
    // mega curada nunca llega hasta aquí. Dos guardas que se cubren la
    // una a la otra no las prueba nadie.
    const yaCuradas = new Set(
      FORMAS_TCG.filter((f) => f.base && String(f.nombre).startsWith('Mega ')).map((f) => f.base)
    )
    for (let i = 0; i < POKEMON_POR_DEX.length; i++) {
      if (yaCuradas.has(i + 1)) continue
      if (!POKEMON_APLASTADOS[i].includes(resto)) continue
      const nombre = `Mega ${POKEMON_POR_DEX[i]}`
      // Llamarla es lo que la REGISTRA: sin esto el sprite saldría null.
      const dex = dexDeCarta(nombre)
      if (!dex) continue
      opciones.push({
        tipo: 'pokemon',
        valor: `d:${nombre.toLowerCase()}`,
        nombre,
        sprite: urlDeSprite(dex),
        empieza: POKEMON_APLASTADOS[i].startsWith(resto),
      })
    }
  }

  // Los OBJETOS con sprite propio (el martillo), al primer golpe de
  // tecla y con su sprite — sin esperar al espejo de cartas, que es lo
  // que hacía que el martillo tardara o no saliera. El alias en español
  // casa con lo tecleado pero enseña el nombre del catálogo (inglés),
  // que es como está en las decklists.
  for (const o of OBJETOS_TCG) {
    const plano = String(o.nombre)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
    if (!plano.includes(q)) continue
    const visible = o.alias ? OBJETOS_TCG.find((x) => !x.alias && x.sprite === o.sprite) : o
    if (!visible || opciones.some((x) => x.nombre === visible.nombre)) continue
    opciones.push({
      tipo: 'carta',
      valor: `d:${visible.nombre.toLowerCase()}`,
      nombre: visible.nombre,
      sprite: visible.sprite,
      empieza: plano.startsWith(q),
    })
  }

  // Los arquetipos del catálogo (1461): el que se llama como una especie
  // ocupa su sitio, con los sprites del mazo.
  const arquetipos = opcionesDeArquetipos(q, catalogo)
  const suyos = new Set(arquetipos.map((a) => a.nombre.toLowerCase()))
  const todas = [...arquetipos, ...opciones.filter((o) => !suyos.has(o.nombre.toLowerCase()))]

  // Los que EMPIEZAN por lo tecleado, delante: con «dr» hay que ver
  // «Dragapult» antes que «Beedrill», que solo lo contiene. Y NO se
  // ordena por longitud —se probó y hundía a «Dragapult» debajo de
  // «Drampa» y «Dreepy», que es justo lo contrario de lo que hace falta.
  // A igualdad, el mazo antes que la especie suelta («Dragapult Dusknoir»
  // arriba de «Dragonite» al escribir «drag»).
  todas.sort(
    (a, b) =>
      Number(b.empieza) - Number(a.empieza) ||
      Number(b.tipo === 'arquetipo') - Number(a.tipo === 'arquetipo') ||
      a.nombre.localeCompare(b.nombre)
  )
  return todas.slice(0, limite)
}

// ── Las cartas que NO son Pokémon ──
//
// Van aparte de buscarOpciones() porque esto SÍ va a la base y aquello
// no: la lista tiene que aparecer al primer golpe de tecla, y las cartas
// se cuelan detrás cuando llegan.
//
// Se quitan las que son un Pokémon: esas ya salen arriba con su sprite,
// que se reconoce mejor que una miniatura de carta, y si no saldrían
// repetidas una vez por cada set en el que se han impreso.
export async function buscarCartas(texto, limite = 10) {
  const q = String(texto || '').trim()
  if (q.length < 3) return [] // con menos de tres letras devuelve media base
  let cartas = []
  try {
    ;({ cartas } = await searchCards(q, { limite: 40 }))
  } catch {
    return []
  }

  const vistos = new Set()
  const salida = []
  for (const c of cartas) {
    if (dexDeCarta(c.name)) continue
    const clave = String(c.name).toLowerCase()
    // La misma carta está impresa en varios sets: una vez basta.
    if (vistos.has(clave)) continue
    vistos.add(clave)
    // Un objeto con sprite propio (el martillo) sale como sprite, no
    // como recorte de carta: mismo trato que le da trainingcourt.
    const deObjeto = spriteDeObjeto(c.name)
    salida.push({
      tipo: 'carta',
      valor: `d:${clave}`,
      nombre: c.name,
      sprite: deObjeto || cardImageUrl(c.image_path, 'low'),
      esCarta: !deObjeto,
    })
    if (salida.length >= limite) break
  }
  return salida
}

// ── El trozo de pantalla ──
//
// No usa <select>: un desplegable nativo no lleva imágenes ni se puede
// filtrar escribiendo. Es un campo de texto con una lista debajo, que es
// lo que hace trainingcourt y lo que la gente espera de un buscador.
//
// `alElegir` recibe { valor, nombre, sprite } o null si se vacía.
export function montarSelectorMazo(contenedor, { catalogo = [], marcador = 'Elige un Pokémon…', alElegir } = {}) {
  let elegido = null
  let abierto = false
  let resaltado = 0
  let opciones = []

  contenedor.classList.add('selector-mazo')
  contenedor.innerHTML = `
    <div class="selector-mazo-campo">
      <span class="selector-mazo-marco selector-mazo-sprite hidden"><img loading="lazy" alt="" /></span>
      <span class="selector-mazo-marco selector-mazo-sprite2 hidden"><img loading="lazy" alt="" /></span>
      <input type="text" class="selector-mazo-texto" placeholder="${escapeHtml(marcador)}" autocomplete="off"
             role="combobox" aria-expanded="false" aria-autocomplete="list" />
      <button type="button" class="selector-mazo-limpiar hidden" aria-label="Quitar">×</button>
    </div>
    <ul class="selector-mazo-lista hidden" role="listbox"></ul>`

  const campo = contenedor.querySelector('.selector-mazo-texto')
  const lista = contenedor.querySelector('.selector-mazo-lista')
  const sprite = contenedor.querySelector('.selector-mazo-sprite')
  const spriteImg = sprite.querySelector('img')
  // El segundo Pokémon de un arquetipo del catálogo (1461).
  const sprite2 = contenedor.querySelector('.selector-mazo-sprite2')
  const sprite2Img = sprite2.querySelector('img')
  const limpiar = contenedor.querySelector('.selector-mazo-limpiar')

  // El sprite del campo, con la misma red que la lista: cada fallo baja
  // un peldaño de la cadena de respaldos —la especie base primero, y el
  // segundo origen si la caída es de la CDN entera—, y agotada la
  // cadena se esconde el marco. Nunca el icono roto.
  spriteImg.addEventListener('error', () => {
    const respaldo = respaldoDeSprite(spriteImg.src)
    if (respaldo && spriteImg.src !== respaldo) spriteImg.src = respaldo
    else sprite.classList.add('hidden')
  })
  sprite2Img.addEventListener('error', () => {
    const respaldo = respaldoDeSprite(sprite2Img.src)
    if (respaldo && sprite2Img.src !== respaldo) sprite2Img.src = respaldo
    else sprite2.classList.add('hidden')
  })
  // Los sprites del campo para una opción (o ninguno).
  function pintarCampo(o) {
    sprite.classList.toggle('hidden', !o?.sprite)
    sprite.classList.toggle('es-carta', Boolean(o?.esCarta))
    if (o?.sprite) spriteImg.src = o.sprite
    const segundo = o?.sprites?.[1] || null
    sprite2.classList.toggle('hidden', !segundo)
    if (segundo) sprite2Img.src = segundo
  }

  function cerrar() {
    abierto = false
    lista.classList.add('hidden')
    campo.setAttribute('aria-expanded', 'false')
  }

  function pintarLista() {
    lista.innerHTML = opciones
      .map(
        (o, i) => `
      <li class="selector-mazo-opcion ${i === resaltado ? 'resaltada' : ''}" role="option"
          aria-selected="${i === resaltado}" data-i="${i}">
        ${
          // Un arquetipo del catálogo (1461), con los DOS Pokémon del mazo.
          // Una carta no se enseña entera (a este tamaño no se lee):
          // se recorta su ilustración en un cuadrado, como el
          // minisprite de un Pokémon. El marco es quien recorta.
          // Un sprite de forma que la CDN no tenga cae al de su especie
          // base (atributosDeRespaldo) en vez de al icono roto.
          o.sprites?.length > 1
            ? `<span class="selector-mazo-pareja">${o.sprites.map((u) => `<img src="${escapeHtml(u)}" alt="" loading="lazy"${atributosDeRespaldo(u)} />`).join('')}</span>`
            : o.sprite
            ? o.esCarta
              ? `<span class="selector-mazo-marco es-carta"><img src="${escapeHtml(o.sprite)}" alt="" loading="lazy" /></span>`
              : `<img src="${escapeHtml(o.sprite)}" alt="" loading="lazy"${atributosDeRespaldo(o.sprite)} />`
            : '<span class="selector-mazo-hueco"></span>'
        }
        <span>${escapeHtml(o.nombre)}</span>${o.tipo === 'arquetipo' ? '<small class="selector-mazo-etiqueta">Mazo</small>' : ''}
      </li>`
      )
      .join('')
    lista.classList.toggle('hidden', !opciones.length)
    abierto = opciones.length > 0
    campo.setAttribute('aria-expanded', String(abierto))
  }

  function elegir(o) {
    elegido = o
    campo.value = o ? o.nombre : ''
    pintarCampo(o)
    limpiar.classList.toggle('hidden', !o)
    cerrar()
    alElegir?.(o)
  }

  // Cada búsqueda lleva su número. Las cartas tardan lo que tarde la
  // base, y sin esto la respuesta de una búsqueda vieja podría llegar
  // DESPUÉS de otra más nueva y pisarla: escribes «martillo», llega lo
  // de «mar» y se queda ahí.
  let busqueda = 0

  campo.addEventListener('input', () => {
    // Al escribir se deshace la elección: si no, el campo diría una cosa
    // y el valor guardado sería otra.
    if (elegido) {
      elegido = null
      pintarCampo(null)
      limpiar.classList.add('hidden')
      alElegir?.(null)
    }
    const mia = ++busqueda
    const texto = campo.value
    opciones = buscarOpciones(texto, catalogo)
    resaltado = 0
    pintarLista()

    // Y detrás, lo que no es un Pokémon. Va después a propósito: la
    // lista tiene que responder a la primera tecla, y esto va a la base.
    buscarCartas(texto).then((cartas) => {
      if (mia !== busqueda || !cartas.length) return
      // Las que ya estén (un arquetipo catalogado con ese nombre) no se
      // repiten.
      const yaEstan = new Set(opciones.map((o) => o.nombre.toLowerCase()))
      const nuevas = cartas.filter((c) => !yaEstan.has(c.nombre.toLowerCase()))
      if (!nuevas.length) return
      opciones = [...opciones, ...nuevas]
      pintarLista()
    })
  })

  campo.addEventListener('keydown', (e) => {
    if (!abierto) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      resaltado = (resaltado + (e.key === 'ArrowDown' ? 1 : -1) + opciones.length) % opciones.length
      pintarLista()
      lista.children[resaltado]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (opciones[resaltado]) elegir(opciones[resaltado])
    } else if (e.key === 'Escape') {
      cerrar()
    }
  })

  // `mousedown` y no `click`: el `blur` del campo llega antes que el
  // click y cerraría la lista sin haber elegido nada.
  lista.addEventListener('mousedown', (e) => {
    const li = e.target.closest('[data-i]')
    if (!li) return
    e.preventDefault()
    elegir(opciones[Number(li.dataset.i)])
  })

  campo.addEventListener('blur', () => setTimeout(cerrar, 120))
  limpiar.addEventListener('click', () => {
    elegir(null)
    campo.focus()
  })

  return {
    valor: () => elegido,
    limpiar: () => elegir(null),
    // Poner un valor DESDE FUERA, sin pasar por la lista (tanda 251).
    // Lo necesita editar una ronda ya apuntada: el mazo del rival hay
    // que devolverlo al campo tal y como se guardó.
    //
    // No avisa con `alElegir`: quien llama ya sabe lo que ha puesto, y
    // avisarle de su propio cambio le haría creer que ha sido la
    // persona quien lo ha tocado.
    poner: (opcion) => {
      elegido = opcion || null
      campo.value = elegido ? elegido.nombre : ''
      // El src va en el <img>, no en su marco (aquí se ponía en el span y el
      // sprite no salía al editar): `pintarCampo` lo hace así.
      pintarCampo(elegido)
      limpiar.classList.toggle('hidden', !elegido)
      cerrar()
    },
  }
}
