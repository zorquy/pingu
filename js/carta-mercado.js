// El bloque «Precio y colección» de la ficha de una carta (tanda 365).
//
// Dos mitades que comparten los mismos selectores: eliges idioma y
// estado UNA vez y con eso (1) el botón de Cardmarket abre la carta con
// esos filtros puestos y (2) «Añadir a mi colección» la guarda así.
//
// El precio es el general de Cardmarket (vía TCGdex): se enseña con su
// nombre —«desde», «tendencia»— y el mínimo exacto de tu idioma y tu
// estado está a un clic, en Cardmarket. Ver js/cardmarket.js.
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
  euros,
  enlaceCardmarket,
  textoDelEnlace,
  idiomaDe,
  estadoDe,
  varianteDe,
} from './cardmarket.js'
// El dibujo de la marca va aparte: es lo único de Cardmarket que
// necesita CSS, y ese CSS solo lo carga esta página (ver el fichero).
import { logoCardmarket, marcaCardmarket } from './cardmarket-marca.js'
import { preciosEnVivo, lineasDeCarta, anadir, tieneCifras } from './mi-coleccion/datos.js'
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
  const vivo = await preciosEnVivo(carta.id)
  const variantes = variantesDe(vivo?.variants)
  const estado = { idioma: IDIOMA_POR_DEFECTO, estado: ESTADO_POR_DEFECTO, variante: variantes[0] }
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
          <p class="carta-mercado-titulo">${logoCardmarket(20)}</p>
          <dl class="carta-precios" id="cmPrecios"></dl>
          <p class="carta-mercado-nota" id="cmNota"></p>
          <a class="btn-cardmarket carta-mercado-boton" id="cmEnlace" href="#" target="_blank" rel="noopener"></a>
        </div>
        <div class="carta-mercado-panel">
          <p class="carta-mercado-titulo">Mi colección</p>
          <p class="carta-mercado-nota" id="cmTengo">Guárdala con el idioma, el estado y la versión de arriba.</p>
          <div class="carta-mercado-anadir" id="cmAnadirZona"></div>
          <a class="link-btn carta-mercado-ir" href="/mi-coleccion">Ir a mi colección</a>
          ${enlaceDeEspecie(carta)}
        </div>
      </div>
      <!-- Quién da ESTA carta (tanda 376). Va en la ficha y no solo en
           /mi-coleccion porque es donde se está cuando te hace falta:
           miras una carta que te falta y ves que hay tres personas que
           la dan. Sin cuenta también — es el escaparate, igual que los
           torneos desde la 252. -->
      <div class="carta-cambios hidden" id="cmCambios"></div>
    </div>`
  caja.classList.remove('hidden')

  const pintarPrecio = () => {
    const precio = precioDe(vivo?.pricing, { reverse: estado.variante === 'reverse' })
    // Con cifras o sin ellas: un precio del que solo se sabe el
    // `idProduct` pintaba tres rayas donde tenía que haber euros.
    const hayCifras = tieneCifras(precio)
    $('cmPrecios').innerHTML = hayCifras
      ? `<div><dt>Desde</dt><dd>${euros(precio.desde)}</dd></div>
         <div><dt>Tendencia</dt><dd>${euros(precio.tendencia)}</dd></div>
         <div><dt>Media 30 días</dt><dd>${euros(precio.media30)}</dd></div>`
      : ''
    // Y si el número es prestado de la versión normal, se dice AQUÍ y no
    // en letra pequeña: la diferencia entre un reverso y su normal la
    // paga quien compra.
    $('cmNota').textContent = hayCifras
      ? precio.prestado
        ? `Cardmarket no publica precio del reverso holográfico de esta carta, así que este es el de la versión NORMAL —lo que vale como poco—, actualizado el ${haceCuanto(precio.actualizado)}. El del reverso en ${idiomaDe(estado.idioma).nombre.toLowerCase()} y ${estadoDe(estado.estado).nombre} lo ves en Cardmarket con el botón.`
        : `Precio general de la carta en cualquier idioma y estado${precio.reverse ? ' (reverse holo)' : ''}, actualizado el ${haceCuanto(precio.actualizado)}. El mínimo en ${idiomaDe(estado.idioma).nombre.toLowerCase()} y ${estadoDe(estado.estado).nombre} lo ves en Cardmarket con el botón.`
      : 'No tenemos el precio de esta carta. Búscala en Cardmarket:'
    const idProduct = precio?.idProduct || null
    const a = $('cmEnlace')
    a.href = enlaceCardmarket({ idProduct, idioma: estado.idioma, estado: estado.estado, variante: estado.variante, nombre })
    // `textContent` primero y la marca después: el texto viene de
    // `textoDelEnlace` y así no hay forma de colar HTML por ahí.
    a.textContent = textoDelEnlace({ idProduct, idioma: estado.idioma, estado: estado.estado })
    a.insertAdjacentHTML('afterbegin', marcaCardmarket(22))
  }
  pintarPrecio()

  for (const [id, campo] of [['cmIdioma', 'idioma'], ['cmEstado', 'estado'], ['cmVariante', 'variante']]) {
    $(id)?.addEventListener('change', (e) => {
      estado[campo] = e.target.value
      pintarPrecio()
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
