// El bloque «Precio y colección» de la ficha de una carta (tanda 365).
//
// Dos mitades que comparten los mismos selectores: eliges idioma y
// estado UNA vez y con eso (1) el botón de Cardmarket abre la carta con
// esos filtros puestos y (2) «Añadir a mi colección» la guarda así.
//
// El precio es el mínimo de Cardmarket en el idioma elegido (TCGGO, 589),
// y el bloque lo pinta js/precio-vista.js, el mismo que la ficha de
// /mi-coleccion. Ver js/cardmarket.js.
import { escapeHtml, getSession, getInitial, avatarStyle, profileUrl } from './app.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { nombreDeCarta } from './catalogo-series.js'
import {
  IDIOMAS,
  ESTADOS,
  VARIANTES,
  IDIOMA_POR_DEFECTO,
  ESTADO_POR_DEFECTO,
  precioDe,
  idiomaDe,
  estadoDe,
  varianteDe,
} from './cardmarket.js'
// El dibujo de la marca va aparte: es lo único de Cardmarket que
// necesita CSS, y ese CSS solo lo carga esta página (ver el fichero).
import { bloqueDePrecio } from './precio-vista.js'
import { preciosEnVivo, preciosGuardados, lineasDeCarta, anadir, tieneCifras } from './mi-coleccion/datos.js'
import { precioDeFila, precioParaIdioma } from './cardmarket.js'
// «Avísame» (665): el botón va en el bloque de precio, con sesión.
import { botonDeAvisoHtml, engancharAvisos } from './avisos-precio.js'
// Para las marcas de lanzamiento de la gráfica (661): el módulo de la
// gráfica no toca la base, se le pasa el cliente.
import { supabase } from './supabase.js'
import { variantesDeCarta, TODAS } from './mi-coleccion/variantes.js'
import { especiesDeCarta, especiePorDex } from './pokedex-especies.js'
import { atributosDeRango } from './rangos.js'

const $ = (id) => document.getElementById(id)

// Las versiones que existen de ESTA carta. La cuenta la hace
// `js/mi-coleccion/variantes.js`, que es el mismo módulo que usa el
// bolsillo del álbum: aquí había una copia y las dos YA DISCREPABAN —
// esta suponía normal + reverse cuando no se sabía, y aquella solo
// normal (tanda 384).
//
// Y esta pantalla pide TODAS cuando no se sabe, a propósito: aquí la
// carta la tienes tú en la mano y sabes mejor que nosotros en qué
// versión es. En el álbum es al revés, porque allí marcar es AFIRMAR.
function variantesDe(v) {
  return variantesDeCarta({ variants: v }, TODAS).map((x) => x.nuestro)
}

function opciones(lista, activo) {
  return lista.map((o) => `<option value="${escapeHtml(o.id)}"${o.id === activo ? ' selected' : ''}>${escapeHtml(o.nombre)}</option>`).join('')
}

function haceCuanto(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function resumenDeTengo(lineas) {
  if (!lineas.length) return ''
  const copias = lineas.reduce((s, l) => s + l.cantidad, 0)
  const detalle = lineas.map((l) => `${l.cantidad}× ${idiomaDe(l.idioma).nombre.toLowerCase()} ${estadoDe(l.estado).id}${l.variante === 'reverse' ? ' reverse' : ''}`).join(', ')
  return `La tienes: ${copias} ${copias === 1 ? 'copia' : 'copias'} (${detalle}).`
}

// «Ver los 312 Pikachus» → la Pokédex, abierta en esa especie (tanda
// 384). Sin consultar nada: la especie sale del NOMBRE, que ya está
// aquí, con el mismo mecanismo que usa la Pokédex.
//
// Solo si la carta tiene UNA especie: en una TAG TEAM habría que elegir
// entre dos y un enlace que elige por ti manda a medio sitio.
function enlaceDeEspecie(carta) {
  const dexes = especiesDeCarta(carta?.name || carta?.name_es)
  if (dexes.length !== 1) return ''
  const nombre = especiePorDex(dexes[0])
  if (!nombre) return ''
  return `<a class="link-btn carta-mercado-ir" href="/mi-coleccion?ver=pokedex&amp;dex=${dexes[0]}">Todas las cartas de ${escapeHtml(nombre)}</a>`
}

export async function pintarMercado(carta) {
  const caja = $('cartaMercado')
  if (!caja || !carta?.id) return
  // Solo las del mercado occidental tienen precio en Cardmarket vía
  // TCGdex (las japonesas son otro producto allí).
  // Y el GUARDADO a la vez (tanda 585): cuando TCGdex no tiene precio de
  // una carta, la función programada lo trae de pokemontcg.io con la URL
  // exacta de Cardmarket, y eso solo está en `tcg_card_prices`.
  const [vivo, guardadas] = await Promise.all([preciosEnVivo(carta.id), preciosGuardados([carta.id]).catch(() => new Map())])
  const guardada = guardadas.get(carta.id) || null
  // Las impresiones: lo que diga TCGdex en vivo y, si no contesta, lo que
  // guardamos de él en la carta (645). Antes, sin respuesta, eran las
  // cuatro — y «las cuatro» como botones afirma impresiones que no hay.
  const variantes = variantesDe(vivo?.variants ?? carta.variants)
  const estado = { idioma: IDIOMA_POR_DEFECTO, estado: ESTADO_POR_DEFECTO, variante: variantes[0] }
  // El botón de «Avísame» (665) solo con sesión: se pone cuando se sabe.
  let botonAviso = ''
  let ultimoPrecio = null
  const nombre = nombreDeCarta(carta)

  caja.innerHTML = `
    <h2 class="section-title">Precio y colección</h2>
    <div class="carta-mercado">
      <div class="carta-mercado-filtros">
        <label>Idioma <select id="cmIdioma">${opciones(IDIOMAS.filter((i) => i.id !== 'ja'), estado.idioma)}</select></label>
        <label>Estado <select id="cmEstado">${opciones(ESTADOS, estado.estado)}</select></label>
        ${variantes.length > 1 ? `<label>Versión <select id="cmVariante">${opciones(VARIANTES.filter((v) => variantes.includes(v.id)), estado.variante)}</select></label>` : ''}
      </div>
      <div class="carta-mercado-paneles">
        <div class="carta-mercado-panel">
          <p class="carta-mercado-titulo">Precio</p>
          <div id="cmPrecios"></div>
        </div>
        <div class="carta-mercado-panel">
          <p class="carta-mercado-titulo">Mi colección</p>
          <p class="carta-mercado-nota" id="cmTengo">Guárdala con el idioma, el estado y la versión de arriba.</p>
          <div class="carta-mercado-anadir" id="cmAnadirZona"></div>
          <a class="link-btn carta-mercado-ir" href="/mi-coleccion">Ir a mi colección</a>
          ${enlaceDeEspecie(carta)}
        </div>
      </div>
      <!-- El histórico de precios (tanda 643): lo pinta js/carta-historial.js,
           que entra por import() al tener el precio; sin filas no se ve. -->
      <div class="carta-historial hidden" id="cmHistorial"></div>
      <!-- Quién da ESTA carta (tanda 376). Va en la ficha y no solo en
           /mi-coleccion porque es donde se está cuando te hace falta:
           miras una carta que te falta y ves que hay tres personas que
           la dan. Sin cuenta también — es el escaparate, igual que los
           torneos desde la 252. -->
      <div class="carta-cambios hidden" id="cmCambios"></div>
    </div>`
  caja.classList.remove('hidden')

  const pintarPrecio = () => {
    const reverse = estado.variante === 'reverse'
    const enVivo = precioDe(vivo?.pricing, { reverse, variante: estado.variante })
    const guardado = precioDeFila(guardada, { reverse, variante: estado.variante })
    // El guardado manda (es el de TCGGO, por idioma); el vivo de TCGdex
    // solo si el guardado no dice nada; y sin cifras, el que traiga el
    // enlace (la regla de la 375).
    const precio = tieneCifras(guardado) ? guardado : tieneCifras(enVivo) ? enVivo : guardado || enVivo
    ultimoPrecio = precio
    $('cmPrecios').innerHTML = bloqueDePrecio(precio, {
      idioma: estado.idioma, estado: estado.estado, variante: estado.variante, nombre, tcgplayerId: carta.tp_id_product_propio || null, extraBotones: botonAviso,
      // Las impresiones de ESTA carta, pulsables (645): tocar una cambia
      // la versión, igual que el desplegable de arriba.
      variantes: VARIANTES.filter((v) => variantes.includes(v.id)), impresionesPulsables: true, rotuloActivo: 'elegido',
    })
  }
  pintarPrecio()
  $('cmPrecios').addEventListener('click', (e) => {
    const b = e.target.closest('.pv-impresion[data-variante]')
    if (!b || !variantes.includes(b.dataset.variante)) return
    estado.variante = b.dataset.variante
    const sel = $('cmVariante')
    if (sel) sel.value = estado.variante
    pintarPrecio()
  })

  // La gráfica (643), sin bloquear nada: si la función no contesta, la
  // ficha se queda como estaba.
  let repintarHistorial = null
  import('./carta-historial.js')
    .then(({ montarHistorial, cargadorDeMarcas }) => montarHistorial($('cmHistorial'), carta.id, () => estado.idioma, { marcas: cargadorDeMarcas(supabase, carta.market || 'WEST') }))
    .then((r) => { repintarHistorial = r })
    .catch(() => {})

  for (const [id, campo] of [['cmIdioma', 'idioma'], ['cmEstado', 'estado'], ['cmVariante', 'variante']]) {
    $(id)?.addEventListener('change', (e) => {
      estado[campo] = e.target.value
      pintarPrecio()
      if (campo === 'idioma') repintarHistorial?.()
    })
  }

  // ── Quién la da (tanda 376) ──
  //
  // Va por `import()` y sin `await` que bloquee: si la migración no está
  // puesta o la consulta falla, la ficha se queda exactamente como
  // estaba. Un bloque de intercambios roto no puede tumbar el precio.
  pintarQuienLaDa(carta)

  // ── La mitad de la colección ──
  const sesion = await getSession().catch(() => null)
  if (sesion) {
    botonAviso = botonDeAvisoHtml(carta.id)
    pintarPrecio()
    engancharAvisos($('cmPrecios'), () => ({ market: carta.market || 'WEST', idioma: estado.idioma, precio: precioParaIdioma(ultimoPrecio, estado.idioma)?.valor ?? null }))
  }
  const zona = $('cmAnadirZona')
  if (!sesion) {
    zona.innerHTML = `<a class="btn-secondary" href="/auth.html?volver=${encodeURIComponent(location.pathname)}">Entra para guardarla</a>`
    return
  }
  zona.innerHTML = `
    <label class="carta-mercado-cantidad">Copias <input type="number" id="cmCantidad" min="1" max="999" value="1" inputmode="numeric" /></label>
    <button type="button" class="btn-secondary" id="cmAnadir">Añadir a mi colección</button>`
  const refrescarTengo = async () => {
    try {
      const lineas = await lineasDeCarta(sesion.user.id, carta.id)
      $('cmTengo').textContent = resumenDeTengo(lineas) || 'Guárdala con el idioma, el estado y la versión de arriba.'
    } catch {
      // Sin la migración no hay colección: el botón lo dirá al pulsarlo.
    }
  }
  refrescarTengo()
  $('cmAnadir').addEventListener('click', async () => {
    const boton = $('cmAnadir')
    const cantidad = Math.max(1, Math.min(999, Math.round(Number($('cmCantidad').value) || 1)))
    boton.disabled = true
    try {
      await anadir(sesion.user.id, { card_id: carta.id, idioma: estado.idioma, estado: estado.estado, variante: estado.variante, cantidad })
      showToast('Añadida a tu colección.', 'success')
      await refrescarTengo()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      boton.disabled = false
    }
  })
}

// Quién da esta carta, en la ficha (tanda 376).
//
// SE CALLA cuando no hay nadie: un «nadie la da» en cada una de las
// 23.000 fichas es ruido en 22.900 de ellas. Y se calla igual si la
// migración no está o la consulta falla — por eso el `catch` vacío, que
// aquí no esconde un fallo sino que decide no enseñar un bloque.
async function pintarQuienLaDa(carta) {
  const caja = $('cmCambios')
  if (!caja) return
  try {
    const { quienDaEsta } = await import('./mi-coleccion/cambios.js')
    const gente = await quienDaEsta(carta.id, 12)
    if (!gente.length) return
    const senas = (f) => {
      const p = [idiomaDe(f.idioma).nombre, estadoDe(f.estado).nombre]
      if (f.variante && f.variante !== 'normal') p.push(varianteDe(f.variante).nombre)
      return p.join(' · ')
    }
    caja.innerHTML = `
      <h3 class="carta-cambios-titulo">${icons.refreshCw(16)} ${gente.length} ${gente.length === 1 ? 'persona la da' : 'personas la dan'} para cambiar</h3>
      <ul class="carta-cambios-lista">
        ${gente
          .map((f) => {
            const nombre = f.display_name || f.username || 'Alguien'
            return `<li>
              <a class="mini-avatar" href="${escapeHtml(profileUrl(f))}" style="${avatarStyle(f)}">${f.avatar_url ? '' : escapeHtml(getInitial(nombre))}</a>
              <div>
                <a href="${escapeHtml(profileUrl(f))}"${atributosDeRango(f)}>${escapeHtml(nombre)}</a>
                <p class="subtext">${escapeHtml(senas(f))}${f.cambio > 1 ? ` · da ${f.cambio}` : ''}</p>
              </div>
              <a class="link-btn" href="/mensajes.html?with=${encodeURIComponent(f.user_id)}">${icons.mail(15)}Escribir</a>
            </li>`
          })
          .join('')}
      </ul>
      <p class="subtext">Apunta esta carta en tu <a href="/mi-coleccion?ver=resumen">lista de búsqueda</a> y te avisamos cuando alguien más la dé.</p>`
    caja.classList.remove('hidden')
  } catch {
    // Sin migración o sin red: la ficha se queda como estaba.
  }
}
