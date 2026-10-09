// El tablón de cambios: quién encaja contigo (tanda 376).
//
// Pinta, y por eso su CSS va en `css/mi-coleccion.css` —la hoja de la
// página que lo carga— y no en `components.css`. Entra por un
// `import()` dinámico desde `js/mi-coleccion.js`: la pestaña de cambios
// no la abre casi nadie en su primera visita, y el barrido de la 299
// sigue los dinámicos desde la 307, así que esto está contado.
//
// Desde la 773 son los CRUCES: una tarjeta por persona con las dos mitades
// del trato (`cruzarPorPersona`, `cruceHtml`). Lo que das y lo que buscas
// tienen su vista propia en Deseos y cambios.
import { escapeHtml, getInitial, avatarStyle, profileUrl } from '../app.js'
import { icons } from '../icons.js'
import { idiomaDe, estadoDe, varianteDe } from '../cardmarket.js'
import { rutaDeCarta } from '../carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
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

// ── LOS CRUCES, POR PERSONA (tanda 773) ──
//
// Una tarjeta por persona con las DOS mitades del trato lado a lado: lo que
// te da (de tu lista) y lo que le das (de la suya). Antes eran dos tablones
// —«dan lo que buscas» y «buscan lo que das»— y la misma persona salía en
// los dos sin que se viera que era un cambio cerrado. Primero los cruces
// perfectos (los dos tenéis algo del otro), luego quien más cartas mueve.
export function cruzarPorPersona(tiene = [], busca = []) {
  const gente = new Map()
  const de = (f) => {
    if (!gente.has(f.user_id)) {
      gente.set(f.user_id, {
        user_id: f.user_id,
        username: f.username,
        display_name: f.display_name,
        avatar_url: f.avatar_url,
        is_admin: f.is_admin,
        is_moderator: f.is_moderator,
        teDa: [],
        leDas: [],
      })
    }
    return gente.get(f.user_id)
  }
  const una = (lista, f) => {
    if (!lista.some((x) => x.card_id === f.card_id && x.idioma === f.idioma)) lista.push(f)
  }
  for (const f of tiene) una(de(f).teDa, f)
  for (const f of busca) una(de(f).leDas, f)
  return [...gente.values()]
    .map((p) => ({ ...p, perfecto: p.teDa.length > 0 && p.leDas.length > 0 }))
    .sort((a, b) => Number(b.perfecto) - Number(a.perfecto) ||
      (b.teDa.length + b.leDas.length) - (a.teDa.length + a.leDas.length) ||
      String(a.username || '').localeCompare(String(b.username || ''), 'es'))
}

// El mensaje de un cruce: las dos listas en el mismo texto. Se deja
// escrito, no se manda (lo de siempre).
export function borradorDeCruce(teDa, leDas) {
  const linea = (f) => `· ${nombreDe(f.carta)} (${senasDe(f)})`
  const partes = ['¡Hola!']
  if (teDa.length) partes.push(`Das estas cartas que estoy buscando:\n${teDa.slice(0, 6).map(linea).join('\n')}${teDa.length > 6 ? `\n…y ${teDa.length - 6} más.` : ''}`)
  if (leDas.length) partes.push(`Y buscas estas, que tengo para cambio:\n${leDas.slice(0, 6).map(linea).join('\n')}${leDas.length > 6 ? `\n…y ${leDas.length - 6} más.` : ''}`)
  partes.push(teDa.length && leDas.length ? '¿Hacemos un cambio?' : '¿Te interesa algo de lo mío? Te paso mi lista si quieres.')
  return partes.join('\n\n')
}

function tiraHtml(filas, cartas) {
  return `<ul class="mc-cruce-tira">${filas.slice(0, 6).map((f) => {
    const c = cartas.get(f.card_id)
    const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
    const nombre = nombreDe(c)
    return `<li><a class="mc-cruce-carta" href="${c ? escapeHtml(rutaDeCarta(c)) : '#'}"${c ? ` data-carta="${escapeHtml(c.id)}"` : ''} title="${escapeHtml(`${nombre} · ${senasDe(f)}`)}" aria-label="${escapeHtml(`${nombre} · ${senasDe(f)}`)}"><span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}</a></li>`
  }).join('')}${filas.length > 6 ? `<li class="mc-cruce-mas">+${filas.length - 6}</li>` : ''}</ul>`
}

// `valor(f)` es lo que vale una copia (o null): la página sabe de precios,
// este módulo no.
export function cruceHtml(p, { cartas, valor, euros }) {
  const nombre = p.display_name || p.username || 'Alguien'
  const suma = (filas) => filas.reduce((a, f) => a + (valor(f) || 0), 0)
  const recibes = suma(p.teDa)
  const das = suma(p.leDas)
  const lado = (titulo, filas, total, vacio) => `<div class="mc-cruce-lado">
      <p class="mc-cruce-titulo">${titulo}</p>
      ${filas.length ? tiraHtml(filas, cartas) : `<p class="subtext">${vacio}</p>`}
      <p class="mc-cruce-total">${filas.length} ${filas.length === 1 ? 'carta' : 'cartas'}${total ? ` · <b>≈ ${escapeHtml(euros(total))}</b>` : ''}</p>
    </div>`
  return `<article class="mc-cruce${p.perfecto ? ' perfecto' : ''}" data-cruce="${escapeHtml(p.user_id)}">
    <header class="mc-cruce-cabeza">
      <a class="mini-avatar" href="${escapeHtml(profileUrl(p))}" style="${avatarStyle(p)}">${p.avatar_url ? '' : escapeHtml(getInitial(nombre))}</a>
      <div class="mc-cruce-quien">
        <a href="${escapeHtml(profileUrl(p))}"${atributosDeRango(p)}>${escapeHtml(nombre)}</a>
        <p class="subtext">${p.perfecto ? 'Las dos listas encajan' : p.teDa.length ? 'Tiene lo que buscas' : 'Busca lo que das'}</p>
        <p class="mc-confianza" data-confianza="${escapeHtml(p.user_id)}"></p>
      </div>
      ${p.perfecto ? `<span class="mc-chapa-reciproco">${icons.refreshCw(14)}Cruce perfecto</span>` : ''}
    </header>
    <div class="mc-cruce-lados">
      ${lado('Te da', p.teDa, recibes, 'Nada de tu lista')}
      <span class="mc-cruce-flecha" aria-hidden="true">${icons.refreshCw(18)}</span>
      ${lado('Le das', p.leDas, das, 'Nada de su lista')}
    </div>
    <div class="mc-cruce-acciones">
      <button type="button" class="btn-primary mc-cambio-escribir" data-escribir="${escapeHtml(p.user_id)}" data-direccion="cruce">${icons.mail(15)}Escribir a ${escapeHtml(nombre)}</button>
      <a class="btn-secondary" href="${escapeHtml(profileUrl(p))}">Su perfil</a>
      ${p.perfecto && recibes && das ? `<span class="mc-cruce-balanza">${Math.abs(recibes - das) < 1 ? 'Valen lo mismo' : `Diferencia: unos ${escapeHtml(euros(Math.abs(recibes - das)))}`}</span>` : ''}
    </div>
  </article>`
}
