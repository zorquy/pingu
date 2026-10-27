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
import { iconoDeVersion } from './iconos-version.js'
import { rutaDeCarta } from '../carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { atributosDeRango } from '../rangos.js'
import { nombreDeCarta } from '../catalogo-series.js'

const nombreDe = (c) => nombreDeCarta(c) || '—'
// El borrador del mensaje vive aparte (887): lo usa también el cruce del perfil.
import { senasDe, borradorDe, borradorDeCruce } from './borrador-cruce.js'
export { senasDe, borradorDe, borradorDeCruce }

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
    // La misma carta en otra versión es otra cosa que te da (1047).
    if (!lista.some((x) => x.card_id === f.card_id && x.idioma === f.idioma && (x.variante || 'normal') === (f.variante || 'normal'))) lista.push(f)
  }
  for (const f of tiene) una(de(f).teDa, f)
  for (const f of busca) una(de(f).leDas, f)
  return [...gente.values()]
    .map((p) => ({ ...p, perfecto: p.teDa.length > 0 && p.leDas.length > 0 }))
    .sort((a, b) => Number(b.perfecto) - Number(a.perfecto) ||
      (b.teDa.length + b.leDas.length) - (a.teDa.length + a.leDas.length) ||
      String(a.username || '').localeCompare(String(b.username || ''), 'es'))
}


function tiraHtml(filas, cartas, max = 6) {
  return `<ul class="mc-cruce-tira">${filas.slice(0, max).map((f) => {
    const c = cartas.get(f.card_id)
    const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
    const nombre = nombreDe(c)
    // La versión, a la vista si no es la normal (1047): la Holo de alguien no
    // es la Normal que buscas. Con su DIBUJO, la misma insignia que las cartas
    // de una expansión (927/930), no con letras.
    const version = f.variante && f.variante !== 'normal' ? `<i class="mc-insignia mc-cruce-version" data-var="${escapeHtml(f.variante)}" aria-hidden="true">${iconoDeVersion(f.variante, 12)}</i>` : ''
    return `<li><a class="mc-cruce-carta" href="${c ? escapeHtml(rutaDeCarta(c)) : '#'}"${c ? ` data-carta="${escapeHtml(c.id)}"` : ''} title="${escapeHtml(`${nombre} · ${senasDe(f)}`)}" aria-label="${escapeHtml(`${nombre} · ${senasDe(f)}`)}"><span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}${version}</a></li>`
  }).join('')}${filas.length > max ? `<li class="mc-cruce-mas">+${filas.length - max}</li>` : ''}</ul>`
}

// La balanza de un cruce (1042): qué parte del total pone cada lado y la
// frase que lo dice. Sin precio en ninguno de los dos lados no hay balanza
// (null): una barra a medias diría que valen lo mismo, y no se sabe.
export function balanzaDe(recibes, das, euros) {
  const total = (recibes || 0) + (das || 0)
  if (!total) return null
  const diferencia = (das || 0) - (recibes || 0)
  const pct = Math.round(((recibes || 0) / total) * 100)
  const texto = Math.abs(diferencia) < 1
    ? 'Valen lo mismo'
    : diferencia > 0 ? `Le das <b>${escapeHtml(euros(diferencia))}</b> más` : `Te da <b>${escapeHtml(euros(-diferencia))}</b> más`
  return { pct, texto, pista: Math.abs(diferencia) < 1 ? '' : 'Puedes compensarlo con dinero en la propuesta' }
}

const avatarDe = (p, nombre) => `<a class="mini-avatar" href="${escapeHtml(profileUrl(p))}" style="${avatarStyle(p)}" aria-label="${escapeHtml(nombre)}">${p.avatar_url ? '' : escapeHtml(getInitial(nombre))}</a>`
const iconosDe = (p, nombre) => `<button type="button" class="mc-cruce-ico mc-cambio-escribir" data-escribir="${escapeHtml(p.user_id)}" data-direccion="cruce" aria-label="Escribir a ${escapeHtml(nombre)}" title="Escribir">${icons.mail(18)}</button>
      <a class="mc-cruce-ico" href="${escapeHtml(profileUrl(p))}?ver=cambios" aria-label="Su perfil" title="Su perfil">${icons.user(18)}</a>`

// Las dos mitades y la balanza de un cruce: lo de dentro de la tarjeta
// grande, que es también lo que enseña una fila al desplegarla (1044).
// `valor(f)` es lo que vale una copia (o null): la página sabe de precios,
// este módulo no.
function ladosHtml(p, { cartas, valor, euros }) {
  const suma = (filas) => filas.reduce((a, f) => a + (valor(f) || 0), 0)
  const recibes = suma(p.teDa)
  const das = suma(p.leDas)
  const lado = (titulo, filas, total, vacio, modo) => `<div class="mc-cruce-lado" data-cruce-lado="${modo}">
      <p class="mc-cruce-titulo">${titulo}</p>
      ${filas.length ? tiraHtml(filas, cartas) : `<p class="subtext">${vacio}</p>`}
      <p class="mc-cruce-total">${filas.length} ${filas.length === 1 ? 'carta' : 'cartas'}${total ? ` · <b>≈ ${escapeHtml(euros(total))}</b>` : ''}</p>
    </div>`
  const b = balanzaDe(recibes, das, euros)
  return `<div class="mc-cruce-lados">
      ${lado('Te da', p.teDa, recibes, 'Nada de tu lista', 'da')}
      ${b
        ? `<div class="mc-cruce-balanza" role="img" aria-label="${escapeHtml(b.texto.replace(/<[^>]+>/g, ''))}">
            <span class="mc-balanza-barra"><i style="width:${b.pct}%"></i><i style="width:${100 - b.pct}%"></i></span>
            <p>${b.texto}</p>${b.pista ? `<small>${b.pista}</small>` : ''}
          </div>`
        : `<span class="mc-cruce-flecha" aria-hidden="true">${icons.refreshCw(18)}</span>`}
      ${lado('Le das', p.leDas, das, 'Nada de su lista', 'busca')}
    </div>`
}

// La tarjeta grande, con las dos mitades y la balanza en medio: el cruce
// PERFECTO (los dos tenéis algo del otro) y, desde la 1044, el primero de la
// lista sea cual sea.
export function cruceHtml(p, op) {
  const nombre = p.display_name || p.username || 'Alguien'
  return `<article class="mc-cruce${p.perfecto ? ' perfecto' : ''}" data-cruce="${escapeHtml(p.user_id)}">
    <header class="mc-cruce-cabeza">
      ${avatarDe(p, nombre)}
      <div class="mc-cruce-quien">
        <a href="${escapeHtml(profileUrl(p))}"${atributosDeRango(p)}>${escapeHtml(nombre)}</a>
        <p class="subtext">${p.perfecto ? 'Las dos listas encajan' : p.teDa.length ? 'Tiene lo que buscas' : 'Busca lo que das'}</p>
        <p class="mc-confianza" data-confianza="${escapeHtml(p.user_id)}"></p>
      </div>
      ${p.perfecto ? `<span class="mc-chapa-reciproco">${icons.refreshCw(14)}Cruce perfecto</span>` : ''}
    </header>
    ${ladosHtml(p, op)}
    <div class="mc-cruce-acciones">
      <button type="button" class="btn-primary mc-cambio-proponer" data-proponer="${escapeHtml(p.user_id)}">${icons.refreshCw(15)}Proponer cambio</button>
      ${iconosDe(p, nombre)}
    </div>
  </article>`
}

// Los demás (1042), en una fila: quién, qué mueve y cuánto vale, «Proponer»
// y escribir. Plegada (1044, PINGU: «si no, no lo ves hasta que le propones
// el cambio»): tocarla en cualquier sitio que no sea un botón o un enlace
// despliega debajo lo mismo que la tarjeta grande (`ladosHtml`). El que
// pliega y despliega es el botón de la flecha (`data-desplegar`), para el
// teclado y el lector; el resto de la fila le pasa el toque.
export function cruceFilaHtml(p, op) {
  const { cartas, valor, euros } = op
  const nombre = p.display_name || p.username || 'Alguien'
  const filas = p.perfecto ? [...p.teDa, ...p.leDas] : p.teDa.length ? p.teDa : p.leDas
  const total = (p.perfecto ? p.teDa : filas).reduce((a, f) => a + (valor(f) || 0), 0)
  const que = p.perfecto
    ? `Te da ${p.teDa.length} · le das ${p.leDas.length}`
    : p.teDa.length ? `Te da ${p.teDa.length} de tu lista` : `Busca ${p.leDas.length} de las tuyas`
  const id = `mcCruceDetalle-${String(p.user_id).replace(/[^\w-]/g, '')}`
  return `<article class="mc-cruce mc-cruce-fila${p.perfecto ? ' perfecto' : ''}" data-cruce="${escapeHtml(p.user_id)}">
    ${avatarDe(p, nombre)}
    <div class="mc-cruce-quien">
      <a href="${escapeHtml(profileUrl(p))}"${atributosDeRango(p)}>${escapeHtml(nombre)}</a>
      <p class="subtext">${que}${total ? ` · <b>≈ ${escapeHtml(euros(total))}</b>` : ''}</p>
      <p class="mc-confianza" data-confianza="${escapeHtml(p.user_id)}"></p>
    </div>
    <div class="mc-cruce-lado" data-cruce-lado="${p.teDa.length ? 'da' : 'busca'}">${tiraHtml(filas, cartas, 3)}</div>
    <div class="mc-cruce-acciones">
      <button type="button" class="btn-secondary mc-cambio-proponer" data-proponer="${escapeHtml(p.user_id)}">Proponer</button>
      ${iconosDe(p, nombre)}
      <button type="button" class="mc-cruce-ico mc-cruce-desplegar" data-desplegar aria-expanded="false" aria-controls="${id}" aria-label="Ver el cruce con ${escapeHtml(nombre)}" title="Ver el cruce">${icons.chevronRight(18)}</button>
    </div>
    <div class="mc-cruce-detalle" id="${id}" hidden>${ladosHtml(p, op)}</div>
  </article>`
}

// Pliega o despliega una fila (1044). Devuelve si ha quedado abierta.
export function desplegarCruce(fila, abrir) {
  const boton = fila?.querySelector('[data-desplegar]')
  const detalle = fila?.querySelector('.mc-cruce-detalle')
  if (!boton || !detalle) return false
  const abierta = abrir ?? boton.getAttribute('aria-expanded') !== 'true'
  boton.setAttribute('aria-expanded', String(abierta))
  boton.setAttribute('title', abierta ? 'Plegar' : 'Ver el cruce')
  detalle.hidden = !abierta
  fila.classList.toggle('abierta', abierta)
  return abierta
}
