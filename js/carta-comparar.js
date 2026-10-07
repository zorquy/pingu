// Comparar dos cartas lado a lado (735, X8 de la lista de propuestas):
// la de la ficha a la izquierda y la que busques a la derecha, con el
// mínimo en el idioma que tienes elegido, la tendencia, la media de 30
// días, lo que se han movido en 30 y 90 días y las versiones que existen.
//
// Es un diálogo y no una página: una página nueva es un pie más que
// contar (312) y otra plantilla que mantener, y la pregunta «¿esta o
// aquella?» se hace desde una ficha concreta.
//
// Lo de arriba es puro (lo prueba node sin navegador); lo que toca la base
// entra por `import()` al abrir, que /carta no lo baja hasta que se pulsa.
import { escapeHtml } from './html.js'
import { euros, idiomaDe, precioDeFila, precioParaIdioma } from './cardmarket.js'
import { cambioEnDias } from './carta-historial.js'
import { variantesDeCarta } from './mi-coleccion/variantes.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { cadenaDeEscaneo } from './escaneo-carta.js'
import { icons } from './icons.js'
import { hojaInyectada } from './hoja.js'

const COLUMNAS = 'id, market, set_id, local_id, name, name_es, name_en, image_path, image_tcggo, variants, tcg_sets(name, name_en)'

const pct = (c) => {
  if (!c || c.pct == null) return null
  const n = Math.round(c.pct)
  return `${n > 0 ? '+' : ''}${n} %`
}

// Un lado de la comparación, ya con el precio en la mano: { carta, fila
// de tcg_card_prices o null, histórico (filas de tcg_card_history) }.
// `null` en un campo es «no se sabe» y se pinta «—»: nunca un cero.
export function datosDeLado({ carta, fila = null, historico = [] } = {}, idioma = 'es') {
  const precio = precioDeFila(fila)
  const desde = precioParaIdioma(precio, idioma)
  return {
    nombre: nombreDeCarta(carta),
    detalle: [nombreDeSet(carta?.tcg_sets), carta?.local_id].filter(Boolean).join(' · '),
    desde: desde?.valor ?? null,
    // Si el mínimo no es el del idioma elegido, se dice: comparar el
    // español de una con el general de la otra sin avisar sería trampa.
    desdeGeneral: Boolean(desde) && desde.idioma !== idioma,
    tendencia: precio?.tendencia ?? null,
    media30: precio?.media30 ?? null,
    mes: pct(cambioEnDias(historico, idioma, 30)),
    trimestre: pct(cambioEnDias(historico, idioma, 90)),
    versiones: variantesDeCarta(carta, null)?.map((v) => v.nombre) ?? null,
  }
}

// Las filas de la tabla: [{ rotulo, a, b, menor }]. `menor` marca la más
// barata en las filas de precio, solo si las dos tienen cifra.
export function filasDeComparacion(a, b) {
  const dinero = (rotulo, campo, nota = () => '') => {
    const va = a[campo]
    const vb = b[campo]
    const menor = va != null && vb != null && va !== vb ? (va < vb ? 'a' : 'b') : null
    return { rotulo, a: va == null ? '—' : euros(va) + nota(a), b: vb == null ? '—' : euros(vb) + nota(b), menor }
  }
  const texto = (rotulo, campo, vacio = '—') => ({ rotulo, a: a[campo] ?? vacio, b: b[campo] ?? vacio, menor: null })
  return [
    dinero('Desde', 'desde', (l) => (l.desdeGeneral ? ' *' : '')),
    dinero('Tendencia', 'tendencia'),
    dinero('Media 30 días', 'media30'),
    texto('Últimos 30 días', 'mes', 'Sin histórico'),
    texto('Últimos 90 días', 'trimestre', 'Sin histórico'),
    { rotulo: 'Versiones', a: a.versiones ? a.versiones.join(', ') : 'No se sabe', b: b.versiones ? b.versiones.join(', ') : 'No se sabe', menor: null },
  ]
}

// La frase de arriba. Sin las dos cifras no se afirma nada.
export function resumenDeComparacion(a, b) {
  if (a.desde == null || b.desde == null) return null
  if (a.desde === b.desde) return 'Cuestan lo mismo.'
  const cara = a.desde > b.desde ? a : b
  const barata = cara === a ? b : a
  const veces = barata.desde > 0 ? cara.desde / barata.desde : null
  const x = veces && veces >= 1.5 ? ` (×${veces.toLocaleString('es-ES', { maximumFractionDigits: 1 })})` : ''
  return `${cara.nombre} cuesta ${euros(cara.desde - barata.desde)} más${x}.`
}

// ── El diálogo ──

async function cargarLado(carta, { supabase, preciosGuardados, historicoDeCartas }) {
  // La de la búsqueda llega sin `variants`: se pide la fila entera.
  let entera = carta
  if (!('variants' in carta)) {
    const { data } = await supabase.from('tcg_cards').select(COLUMNAS).eq('id', carta.id).eq('market', carta.market || 'WEST').maybeSingle()
    if (data) entera = data
  }
  const desde = new Date(Date.now() - 100 * 86_400_000).toISOString().slice(0, 10)
  const [precios, historico] = await Promise.all([
    preciosGuardados([carta.id]).catch(() => new Map()),
    historicoDeCartas([carta.id], desde).catch(() => []),
  ])
  return { carta: entera, fila: precios.get(carta.id) || null, historico }
}

function foto(carta) {
  const cadena = cadenaDeEscaneo(carta)
  return `<img class="comparar-foto" src="${escapeHtml(cadena[0] || '')}" data-cadena="${escapeHtml(JSON.stringify(cadena.slice(1)))}" width="120" height="168" loading="lazy" alt="">`
}

export async function abrirComparar(cartaA, { idioma = 'es', doc = document } = {}) {
  hojaInyectada('css/comparar.css')
  hojaInyectada('css/buscador.css')
  const [{ supabase }, datos, { buscarTodo }, { interiorDe, engancharFotos }] = await Promise.all([
    import('./supabase.js'),
    import('./mi-coleccion/datos.js'),
    import('./buscador.js'),
    import('./buscador-filas.js'),
  ])
  const deps = { supabase, preciosGuardados: datos.preciosGuardados, historicoDeCartas: datos.historicoDeCartas }

  let d = doc.getElementById('cmCompararDialogo')
  if (!d) {
    d = doc.createElement('dialog')
    d.id = 'cmCompararDialogo'
    d.className = 'comparar'
    d.setAttribute('aria-labelledby', 'cmCompararTitulo')
    doc.body.appendChild(d)
    d.addEventListener('click', (e) => { if (e.target === d) d.close() })
    // Una foto que no carga pasa a la siguiente de su cadena (la 441).
    d.addEventListener('error', (e) => {
      const img = e.target
      if (!(img instanceof HTMLImageElement) || !img.classList.contains('comparar-foto')) return
      let resto = []
      try { resto = JSON.parse(img.dataset.cadena || '[]') } catch {}
      if (resto.length) {
        img.dataset.cadena = JSON.stringify(resto.slice(1))
        img.src = resto[0]
      } else img.classList.add('comparar-sin-foto')
    }, true)
    engancharFotos(d)
  }
  const nombreIdioma = idiomaDe(idioma).nombre.toLowerCase()
  d.innerHTML = `
    <header class="comparar-cabeza">
      <h2 id="cmCompararTitulo">Comparar</h2>
      <button type="button" class="comparar-cerrar" data-comparar="cerrar" aria-label="Cerrar">✕</button>
    </header>
    <div class="comparar-lados">
      <figure class="comparar-lado" data-lado="a">${foto(cartaA)}<figcaption><b>${escapeHtml(nombreDeCarta(cartaA))}</b><small>${escapeHtml([nombreDeSet(cartaA.tcg_sets), cartaA.local_id].filter(Boolean).join(' · '))}</small></figcaption></figure>
      <div class="comparar-lado" data-lado="b" id="cmCompararB">
        <label class="comparar-buscar">
          <span>Con qué carta</span>
          <span class="bs-caja"><span class="bs-lupa" aria-hidden="true">${icons.search(18)}</span><input type="search" enterkeyhint="search" class="bs-input" id="cmCompararQ" placeholder="Busca una carta…" autocomplete="off"></span>
        </label>
        <div class="comparar-resultados" id="cmCompararResultados" role="listbox" aria-label="Cartas"></div>
      </div>
    </div>
    <p class="comparar-resumen" id="cmCompararResumen" aria-live="polite"></p>
    <div class="comparar-tabla-caja" id="cmCompararTabla"></div>
    <p class="comparar-nota">Precios de Cardmarket en ${escapeHtml(nombreIdioma)}, en buen estado. * El mínimo general: de esa carta no hay en ${escapeHtml(nombreIdioma)}.</p>`

  const ladoA = await cargarLado(cartaA, deps)
  const a = datosDeLado(ladoA, idioma)
  const q = d.querySelector('#cmCompararQ')
  const lista = d.querySelector('#cmCompararResultados')
  let vez = 0
  let encontradas = []

  const pintarTabla = (b) => {
    const tabla = d.querySelector('#cmCompararTabla')
    if (!b) {
      tabla.innerHTML = ''
      d.querySelector('#cmCompararResumen').textContent = ''
      return
    }
    const filas = filasDeComparacion(a, b)
    tabla.innerHTML = `<table class="comparar-tabla"><thead><tr><th scope="col"><span class="sr-only">Dato</span></th><th scope="col">${escapeHtml(a.nombre)}</th><th scope="col">${escapeHtml(b.nombre)}</th></tr></thead><tbody>${filas
      .map((f) => `<tr><th scope="row">${escapeHtml(f.rotulo)}</th><td${f.menor === 'a' ? ' class="comparar-menor"' : ''}>${escapeHtml(f.a)}</td><td${f.menor === 'b' ? ' class="comparar-menor"' : ''}>${escapeHtml(f.b)}</td></tr>`)
      .join('')}</tbody></table>`
    d.querySelector('#cmCompararResumen').textContent = resumenDeComparacion(a, b) || 'Sin el precio de las dos no se puede decir cuál cuesta más.'
  }

  const elegir = async (carta) => {
    const caja = d.querySelector('#cmCompararB')
    caja.innerHTML = `<figure class="comparar-lado-b">${foto(carta)}<figcaption><b>${escapeHtml(nombreDeCarta(carta))}</b><small>${escapeHtml([nombreDeSet(carta.tcg_sets), carta.local_id].filter(Boolean).join(' · '))}</small></figcaption></figure>
      <button type="button" class="link-btn comparar-cambiar" data-comparar="cambiar">Elegir otra</button>`
    d.querySelector('#cmCompararResumen').textContent = 'Mirando su precio…'
    const lado = await cargarLado(carta, deps).catch(() => ({ carta, fila: null, historico: [] }))
    if (!d.open) return
    pintarTabla(datosDeLado(lado, idioma))
  }

  const buscar = async () => {
    const texto = q.value.trim()
    const mia = ++vez
    if (texto.length < 2) {
      lista.innerHTML = ''
      return
    }
    const r = await buscarTodo(texto, { grupos: ['cartas'], limite: 6 }).catch(() => ({ cartas: { error: true } }))
    if (mia !== vez) return
    const g = r.cartas || {}
    if (g.error) {
      lista.innerHTML = '<p class="comparar-aviso">No se ha podido buscar. Prueba otra vez.</p>'
      return
    }
    encontradas = (g.filas || []).filter((c) => c.id !== cartaA.id)
    lista.innerHTML = encontradas.length
      ? encontradas.map((c, i) => `<button type="button" class="bs-fila bs-cartas" role="option" data-i="${i}">${interiorDe('cartas', c)}</button>`).join('')
      : `<p class="comparar-aviso">Ninguna carta se llama así.</p>`
  }
  let espera = null
  q.addEventListener('input', () => {
    clearTimeout(espera)
    espera = setTimeout(buscar, 250)
  })
  q.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    clearTimeout(espera)
    buscar()
  })

  d.onclick = (e) => {
    const fila = e.target.closest('[data-i]')
    if (fila && encontradas[Number(fila.dataset.i)]) {
      elegir(encontradas[Number(fila.dataset.i)])
      return
    }
    const accion = e.target.closest('[data-comparar]')?.dataset.comparar
    if (accion === 'cerrar') d.close()
    if (accion === 'cambiar') {
      // Vuelve a montar el diálogo entero: es lo más corto y la búsqueda
      // nueva no hereda nada de la anterior.
      abrirComparar(cartaA, { idioma, doc })
    }
  }

  if (!d.open) d.showModal()
  q.focus()
  return d
}
