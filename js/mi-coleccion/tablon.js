// El tablón de cambios: quién encaja contigo (tanda 376).
//
// Pinta, y por eso su CSS va en `css/mi-coleccion.css` —la hoja de la
// página que lo carga— y no en `components.css`. Entra por un
// `import()` dinámico desde `js/mi-coleccion.js`: la pestaña de cambios
// no la abre casi nadie en su primera visita, y el barrido de la 299
// sigue los dinámicos desde la 307, así que esto está contado.
//
// ── EL ORDEN DE LA PANTALLA ──
//
// Arriba lo que SALE (las coincidencias), abajo lo que hay que meter
// (lo que doy, lo que busco). Al revés, la pestaña empieza por deberes:
// dos listas vacías y ninguna razón para rellenarlas.
import { escapeHtml, getInitial, avatarStyle, profileUrl } from '../app.js'
import { icons } from '../icons.js'
import { idiomaDe, estadoDe, varianteDe } from '../cardmarket.js'
import { rutaDeCarta } from '../carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { porPersona } from './cambios.js'
import { atributosDeRango } from '../rangos.js'
import { nombreDeCarta } from '../catalogo-series.js'

const nombreDe = (c) => nombreDeCarta(c) || '—'

// Lo que distingue una copia de otra, en una línea: «español · Near
// Mint · Reverse holo». La versión solo se dice si NO es la normal —
// decir «normal» en el 90 % de las filas es ruido.
export function senasDe(f) {
  const partes = [idiomaDe(f.idioma).nombre, estadoDe(f.estado).nombre]
  if (f.variante && f.variante !== 'normal') partes.push(varianteDe(f.variante).nombre)
  if (f.gradeo) partes.push(f.gradeo)
  return partes.join(' · ')
}

// El mensaje que se escribe solo. NO se envía: se deja escrito en la
// caja para que quien lo manda lo lea antes. Un botón que manda un
// mensaje a un desconocido sin enseñárselo es una forma rápida de
// quedar mal.
export function borradorDe(persona, cartas, direccion) {
  const lista = cartas.slice(0, 6).map((f) => `· ${nombreDe(f.carta)} (${senasDe(f)})`).join('\n')
  const mas = cartas.length > 6 ? `\n…y ${cartas.length - 6} más.` : ''
  const cabecera = direccion === 'tiene'
    ? 'He visto que das estas cartas y las estoy buscando:'
    : 'He visto que buscas estas cartas y las doy:'
  const cierre = persona.reciproco
    ? '\n\nY creo que nos encajan las dos listas, así que igual sale un cambio directo. ¿Te va bien?'
    : '\n\n¿Te interesa algo de lo mío? Te paso mi lista si quieres.'
  return `¡Hola! ${cabecera}\n\n${lista}${mas}${cierre}`
}

function cartaHtml(f) {
  const c = f.carta
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  return `
    <li class="mc-cambio-carta">
      <a href="${c ? escapeHtml(rutaDeCarta(c)) : '#'}" class="mc-cambio-foto" tabindex="-1" aria-hidden="true">
        ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
      </a>
      <div>
        <a class="mc-cambio-nombre" href="${c ? escapeHtml(rutaDeCarta(c)) : '#'}">${escapeHtml(nombreDe(c))}</a>
        <p class="subtext">${escapeHtml(senasDe(f))}${f.cambio > 1 ? ` · da ${f.cambio}` : ''}</p>
      </div>
    </li>`
}

function personaHtml(p, direccion) {
  const nombre = p.display_name || p.username || 'Alguien'
  const n = p.cartas.length
  return `
    <article class="mc-cambio-persona${p.reciproco ? ' reciproco' : ''}">
      <header>
        <a class="mini-avatar" href="${escapeHtml(profileUrl(p))}" style="${avatarStyle(p)}">${p.avatar_url ? '' : escapeHtml(getInitial(nombre))}</a>
        <div>
          <a class="mc-cambio-quien" href="${escapeHtml(profileUrl(p))}"${atributosDeRango(p)}>${escapeHtml(nombre)}</a>
          <p class="subtext">${n} ${n === 1 ? 'carta' : 'cartas'}${direccion === 'tiene' ? ' que buscas' : ' que das'}</p>
        </div>
        ${p.reciproco ? `<span class="mc-chapa-reciproco" title="Tú tienes algo que busca y te da algo que buscas: el cambio se cierra entre vosotros dos.">${icons.refreshCw(14)}Cambio directo</span>` : ''}
      </header>
      <ul class="mc-cambio-cartas">${p.cartas.slice(0, 8).map(cartaHtml).join('')}</ul>
      ${p.cartas.length > 8 ? `<p class="subtext">…y ${p.cartas.length - 8} más.</p>` : ''}
      <button type="button" class="btn-primary mc-cambio-escribir" data-escribir="${escapeHtml(p.user_id)}" data-direccion="${escapeHtml(direccion)}">${icons.mail(15)}Escribir a ${escapeHtml(nombre)}</button>
    </article>`
}

// Una lista del tablón, con su vacío propio: «no hay nadie» y «no has
// apuntado nada» son dos estados distintos y la pantalla tiene que
// decir cuál de los dos es (la lección de la 319).
function listaHtml(gente, direccion, tienesLista) {
  if (!tienesLista) {
    return `<p class="empty-state">${direccion === 'tiene'
      ? 'Apunta abajo las cartas que buscas y aquí saldrá quién las tiene.'
      : 'Marca abajo cuántas copias das de tus repetidas y aquí saldrá quién las busca.'}</p>`
  }
  if (!gente.length) {
    return `<p class="empty-state">${direccion === 'tiene'
      ? 'Todavía no hay nadie que dé lo que buscas. Cuanta más gente apunte sus repetidas, antes saldrá.'
      : 'Todavía no hay nadie buscando lo que das.'}</p>`
  }
  return `<div class="mc-cambio-gente">${gente.map((p) => personaHtml(p, direccion)).join('')}</div>`
}

// El tablón entero. `cartas` es el mapa id → fila de `tcg_cards`, que ya
// tiene la página: las RPC devuelven `card_id` y nada más, porque una
// función de la base no tiene por qué saber pintar una carta.
export function tablonHtml({ tiene, busca, cartas, deseos, doy }) {
  const conCarta = (filas) => filas.map((f) => ({ ...f, carta: cartas.get(f.card_id) }))
  const losQueTienen = porPersona(conCarta(tiene))
  const losQueBuscan = porPersona(conCarta(busca))
  const dobles = losQueTienen.filter((p) => p.reciproco).length
  return `
    <div class="mc-cambio-cab">
      <h2>Quién encaja contigo</h2>
      <p class="mc-nota">${dobles
        ? `Tienes <strong>${dobles} ${dobles === 1 ? 'cambio directo' : 'cambios directos'}</strong> a la vista: alguien que da lo que buscas y busca lo que das. Escríbele y lo cerráis.`
        : 'Un cambio se cierra cuando los dos tenéis algo del otro. Aquí salen primero los que encajan por los dos lados.'}</p>
    </div>
    <section class="mc-cambio-bloque">
      <h3>Dan lo que buscas</h3>
      ${listaHtml(losQueTienen, 'tiene', deseos.length > 0)}
    </section>
    <section class="mc-cambio-bloque">
      <h3>Buscan lo que das</h3>
      ${listaHtml(losQueBuscan, 'busca', doy.length > 0)}
    </section>`
}
