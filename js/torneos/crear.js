// Crear un torneo, una pregunta cada vez (tanda 1434, PINGU: «¿no es mejor ir
// respondiendo a las cosas que te van saliendo… en vez de hacer un scroll tan
// largo?»). Era el wizard de tres pasos de TrainerArena (Básicos, Formato,
// Tiempos), cada uno una página larga de campos. Ahora es una ventana con UNA
// pregunta: se contesta tocando una tarjeta (y pasa sola a la siguiente) o
// escribiendo y «Siguiente». Al final, «Así queda» con cada respuesta y su
// «Cambiar», que vuelve a esa pregunta y de ella al resumen.
//
// Los campos son los de siempre y con los mismos ids (`torneoNombre`,
// `torneoTipo`, `torneoPlazas`…): las tarjetas solo los rellenan, así que la
// fila que se guarda sale igual que antes. Se baja por `import()` al pulsar
// «Crear un torneo»: quien solo mira la lista no paga ni el módulo ni su hoja
// (ni el editor de la descripción, que entra al abrir su apartado).
import { supabase } from '../supabase.js'
import { escapeHtml, slugify, uploadProfileImage } from '../app.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { hojaInyectada } from '../hoja.js'
import { officialStructure } from './motor.js'
import { fechaBonita, premiosParaGuardar, PREMIOS_MAXIMO, PUESTO_MAXIMO, PREMIO_MAXIMO } from './comun.js'
import { numJornadas, rondasPorJornada } from './rondas-jornada.js'
import { textoDePrecio, precioDelCampo } from './torneo-tienda.js'
import { PREGUNTAS, TEXTO_MODO_LISTAS, TEXTO_INSCRIPCION, aLocal, diasRapidos, jornadasSemanales, frasesDelFormato } from './crear-puro.js'

const hoja = Promise.all([hojaInyectada('css/torneo-crear.css'), hojaInyectada('css/editor-texto.css')])
const $ = (id) => document.getElementById(id)

const PLAZAS_RAPIDAS = [8, 16, 32, 64]
const MINUTOS_RAPIDOS = [
  [25, 'Para ir rápido'],
  [30, 'Al mejor de 1'],
  [50, 'Al mejor de 3'],
]
const HORAS_RAPIDAS = ['11:00', '16:00', '17:00', '18:00']
const HORA_POR_DEFECTO = '17:00'

// ── El dibujo ──

function opcion({ campo, valor, icono, titulo, texto = '', avanza = true, extra = '' }) {
  return `<button type="button" class="tc-opcion" data-campo="${campo}" data-valor="${escapeHtml(String(valor))}"${avanza ? ' data-avanza' : ''}${extra}>
    ${icono ? `<span class="tc-opcion-ico" aria-hidden="true">${icono}</span>` : ''}
    <span class="tc-opcion-texto"><b>${titulo}</b>${texto ? `<small>${texto}</small>` : ''}</span>
  </button>`
}

function pregunta(id, titulo, pista, cuerpo) {
  return `<section class="tc-paso" data-pregunta="${id}" hidden>
    <h2 class="tc-pregunta" data-titulo="${id}">${titulo}</h2>
    ${pista ? `<p class="tc-pista">${pista}</p>` : ''}
    ${cuerpo}
  </section>`
}

function extra(id, icono, titulo, cuerpo) {
  return `<details class="tc-extra" data-extra="${id}">
    <summary><span class="tc-extra-ico" aria-hidden="true">${icono}</span><span class="tc-extra-texto"><b>${titulo}</b><small data-extra-valor="${id}"></small></span><span class="tc-extra-flecha" aria-hidden="true">${icons.chevronRight(16)}</span></summary>
    <div class="tc-extra-cuerpo">${cuerpo}</div>
  </details>`
}

function htmlDelDialogo(esAdmin) {
  return `<dialog class="tc-dialogo" id="torneoCrear" aria-labelledby="tcTitulo">
  <form id="torneoForm" class="tc-form" novalidate>
    <header class="tc-cab">
      <button type="button" class="tc-icono" id="btnPasoAtras" aria-label="Pregunta anterior">${icons.chevronLeft(20)}</button>
      <div class="tc-cab-medio">
        <p class="tc-cab-titulo" id="tcTitulo">Nuevo torneo</p>
        <div class="tc-barra" aria-hidden="true"><span id="tcBarra"></span></div>
      </div>
      <span class="tc-cuenta" id="tcCuenta" aria-live="polite"></span>
      <button type="button" class="tc-icono" id="btnCancelarTorneo" aria-label="Cerrar">${icons.x(20)}</button>
    </header>
    <div class="tc-cuerpo" id="tcCuerpo">

    ${pregunta('nombre', '¿Cómo se llama tu torneo?', 'Es lo primero que verán los jugadores.', `
      <input type="text" class="tc-grande" id="torneoNombre" maxlength="120" placeholder="Liga PokeDoc — Agosto" autocomplete="off" aria-labelledby="tcTitulo" />`)}

    ${pregunta('donde', '¿Dónde se juega?', '', `
      <input type="hidden" id="torneoModalidad" value="online" />
      <div class="tc-opciones tc-dos">
        ${opcion({ campo: 'torneoModalidad', valor: 'online', icono: icons.globe(26), titulo: 'Online', texto: 'Cada uno desde su casa, en TCG Live' })}
        ${opcion({ campo: 'torneoModalidad', valor: 'presencial', icono: icons.mapPin(26), titulo: 'En persona', texto: 'En una tienda o un evento, en mesa y con cartas de verdad' })}
      </div>`)}

    ${pregunta('lugar', '¿Dónde exactamente?', 'Sale en la ficha, con «Cómo llegar».', `
      <label class="tc-campo">El sitio
        <input type="text" class="tc-grande" id="torneoLugar" maxlength="80" placeholder="Cartas Bilbao" autocomplete="off" />
      </label>
      <label class="tc-campo">La dirección
        <input type="text" id="torneoDireccion" maxlength="160" placeholder="Calle Ercilla 12, Bilbao" autocomplete="off" />
      </label>
      <p class="tc-aviso-persona">${icons.info(16)}<span>En persona no se pide el usuario de TCG Live, y en vez del check-in se da <b>entrada en la puerta</b>.</span></p>`)}

    ${pregunta('tipo', '¿Qué tipo de torneo es?', '', `
      <input type="hidden" id="torneoTipo" value="standard" />
      <div class="tc-opciones tc-dos">
        ${opcion({ campo: 'torneoTipo', valor: 'standard', icono: icons.trophy(26), titulo: 'De un día', texto: 'Las rondas suizas seguidas, el mismo día' })}
        ${opcion({ campo: 'torneoTipo', valor: 'league', icono: icons.calendar(26), titulo: 'Una liga', texto: 'Una jornada por fecha, durante semanas' })}
      </div>`)}

    ${pregunta('cuando', '¿Cuándo empieza?', 'En tu hora.', `
      <div class="tc-chips" data-chips="dia" role="group" aria-label="Día"></div>
      <div class="tc-chips" data-chips="hora" role="group" aria-label="Hora">
        ${HORAS_RAPIDAS.map((h) => `<button type="button" class="tc-chip" data-hora="${h}">${h}</button>`).join('')}
      </div>
      <label class="tc-campo">O elige día y hora
        <input type="datetime-local" id="torneoFecha" />
      </label>`)}

    ${pregunta('jornadas', '¿Cuándo es cada jornada?', 'Una fila por jornada, en orden. La primera es el día que empieza.', `
      <div class="tc-fila-botones">
        <button type="button" class="btn-secondary" id="btnJornadasSemana">${icons.refreshCw(15)} Una por semana</button>
      </div>
      <fieldset class="torneo-jornadas-campos tc-jornadas" id="torneoJornadasCampos">
        <legend class="sr-only">Fechas de las jornadas</legend>
        <div id="torneoJornadasLista"></div>
        <button type="button" class="btn-secondary torneo-anadir-jornada" id="btnAnadirJornada">+ Añadir jornada</button>
      </fieldset>`)}

    ${pregunta('plazas', '¿Cuánta gente puede jugar?', 'Con las plazas te propongo las rondas y el top cut de la tabla oficial.', `
      <div class="tc-opciones tc-tres">
        ${PLAZAS_RAPIDAS.map((n) => opcion({ campo: 'torneoPlazas', valor: n, titulo: String(n), texto: 'plazas' })).join('')}
        ${opcion({ campo: 'torneoSinLimite', valor: 'si', icono: icons.users(22), titulo: 'Sin límite', texto: 'Nunca se llena' })}
        ${opcion({ campo: 'otra', valor: 'plazas', icono: icons.edit(20), titulo: 'Otra cifra', avanza: false })}
      </div>
      <input type="checkbox" id="torneoSinLimite" hidden />
      <label class="tc-campo" id="tcPlazasOtra" hidden>¿Cuántas? (de 4 a 256)
        <input type="number" inputmode="numeric" class="tc-grande" id="torneoPlazas" min="4" max="256" value="16" />
      </label>`)}

    ${pregunta('formato', 'Así se jugaría', '', `
      <div class="tc-formato" id="tcFormato">
        <p class="tc-formato-linea"><span class="tc-formato-ico" aria-hidden="true">${icons.layers(20)}</span><b id="tcFormatoSuizas"></b></p>
        <p class="tc-formato-linea"><span class="tc-formato-ico" aria-hidden="true">${icons.trophy(20)}</span><b id="tcFormatoCorte"></b></p>
        <p class="tc-formato-nota" id="tcFormatoNota"></p>
      </div>
      <details class="tc-ajustes" id="tcAjustes">
        <summary class="btn-secondary">Cambiar algo</summary>
        <div class="torneos-form-rejilla">
          <label id="torneoRondasEtiqueta">Rondas suizas
            <input type="number" inputmode="numeric" id="torneoRondas" min="1" max="12" value="4" />
          </label>
          <label id="torneoRondasJornadaCampo" hidden>Rondas por jornada
            <select id="torneoRondasJornada">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}"${n === 1 ? ' selected' : ''}>${n}</option>`).join('')}</select>
          </label>
          <label>Top cut
            <select id="torneoCorte">
              <option value="0">Sin corte</option>
              <option value="4" selected>Top 4</option>
              <option value="8">Top 8</option>
              <option value="16">Top 16</option>
            </select>
          </label>
          <label>Suizas al mejor de
            <select id="torneoSwissBo"><option value="1" selected>1</option><option value="3">3</option></select>
          </label>
          <label id="torneoCorteBoCampo">Top cut al mejor de
            <select id="torneoCorteBo"><option value="1">1</option><option value="3" selected>3</option></select>
          </label>
        </div>
      </details>`)}

    ${pregunta('reloj', '¿Cuánto dura cada ronda?', 'El reloj solo corre en las suizas: el top cut se juega hasta acabar.', `
      <div class="tc-opciones tc-dos">
        ${MINUTOS_RAPIDOS.map(([m, t]) => opcion({ campo: 'torneoMinutos', valor: m, icono: icons.clock(22), titulo: `${m} min`, texto: t })).join('')}
        ${opcion({ campo: 'otra', valor: 'minutos', icono: icons.edit(20), titulo: 'Otro tiempo', avanza: false })}
      </div>
      <label class="tc-campo" id="tcMinutosOtro" hidden>Minutos por ronda (de 5 a 120)
        <input type="number" inputmode="numeric" class="tc-grande" id="torneoMinutos" min="5" max="120" value="30" />
      </label>`)}

    ${pregunta('entrada', '¿Quién puede apuntarse?', '', `
      <input type="hidden" id="torneoInscripcion" value="pedir" />
      <div class="tc-opciones tc-persona" hidden>
        ${opcion({ campo: 'torneoInscripcion', valor: 'pedir', icono: icons.users(22), titulo: 'Piden plaza y les das entrada <span class="tc-reco">Recomendada</span>', texto: 'Se apuntan desde casa y en la puerta les das entrada. Juega quien ha entrado.' })}
        ${opcion({ campo: 'torneoInscripcion', valor: 'organizador', icono: icons.edit(22), titulo: 'Solo tú los apuntas', texto: 'Nadie se apunta solo: los metes tú cuando llegan' })}
        ${opcion({ campo: 'torneoInscripcion', valor: 'libre', icono: icons.checkCircle(22), titulo: 'Se apuntan solos', texto: 'Como uno online, sin pasar por la puerta' })}
      </div>
      <div class="tc-opciones tc-dos tc-online">
        ${opcion({ campo: 'torneoPrivado', valor: 'no', icono: icons.globe(24), titulo: 'Cualquiera', texto: 'Quien tenga cuenta en PokeDoc' })}
        ${opcion({ campo: 'torneoPrivado', valor: 'si', icono: icons.lock(24), titulo: 'Solo con código', texto: 'Se ve como los demás, pero hace falta el código', avanza: false })}
      </div>
      <input type="checkbox" id="torneoPrivado" hidden />
      <label class="tc-campo" id="torneoCodigoCampo" hidden>El código
        <input type="text" class="tc-grande" id="torneoCodigoNuevo" autocomplete="off" maxlength="40" placeholder="Por ejemplo, PIKACHU" />
        <span class="torneo-campo-pista">Se lo das tú a quien quieras que juegue. No distingue mayúsculas.</span>
      </label>`)}

    ${pregunta('listas', '¿Cuándo se ven las listas de los demás?', 'Las listas y los mazos, en la clasificación. Tú y los jueces las veis siempre.', `
      <input type="hidden" id="torneoListasModo" value="al_terminar" />
      <div class="tc-opciones">
        ${opcion({ campo: 'torneoListasModo', valor: 'al_terminar', icono: icons.eye(22), titulo: 'Al terminar el torneo', texto: 'Lo normal: se descubren cuando acaba' })}
        ${opcion({ campo: 'torneoListasModo', valor: 'en_juego', icono: icons.cards(22), titulo: 'Desde la ronda 1', texto: 'Lista abierta: todos ven a qué juega cada uno' })}
        ${opcion({ campo: 'torneoListasModo', valor: 'nunca', icono: icons.lock(22), titulo: 'Nunca', texto: 'Nadie ve la de nadie' })}
      </div>`)}

    ${pregunta('extras', 'Dale tu toque', 'Todo esto es opcional: puedes pasar sin tocar nada.', `
      <div class="tc-extras">
        ${extra('premios', icons.gift(20), 'Premios', `
          <div class="torneo-premios-editor" id="nuevoPremiosLista"></div>
          <button type="button" class="btn-secondary" id="btnNuevoAnadirPremio">Añadir un premio</button>
          <span class="torneo-campo-pista">Una línea por puesto: «1º», «Top 8», «Todos»… El primero sale en la lista de torneos.</span>`)}
        ${extra('precio', icons.coins(20), 'Inscripción', `
          <label class="tc-campo">Precio (€)
            <input type="text" inputmode="decimal" id="torneoPrecio" maxlength="7" placeholder="Sin decir" />
            <span class="torneo-campo-pista">Solo informativo: se paga en persona. 0 es gratis.</span>
          </label>`)}
        ${extra('imagen', icons.image(20), 'Imagen y banner', `
          <div class="tc-campo">Imagen (cuadrada)
            <div class="torneo-imagen-campo">
              <img id="torneoImagenPreview" class="torneo-imagen-preview hidden" alt="" />
              <button type="button" class="btn-secondary" id="btnTorneoImagen">Elegir imagen</button>
              <button type="button" class="btn-outline hidden" id="btnTorneoImagenQuitar">Quitar</button>
              <input type="file" id="torneoImagenInput" accept="image/*" class="hidden" />
            </div>
          </div>
          <div class="tc-campo">Banner (apaisado, arriba de la ficha)
            <div class="torneo-imagen-campo">
              <img id="torneoBannerPreview" class="torneo-banner-preview hidden" alt="" />
              <button type="button" class="btn-secondary" id="btnTorneoBanner">Elegir banner</button>
              <button type="button" class="btn-outline hidden" id="btnTorneoBannerQuitar">Quitar</button>
              <input type="file" id="torneoBannerInput" accept="image/*" class="hidden" />
            </div>
          </div>`)}
        ${extra('descripcion', icons.alignLeft(20), 'Descripción', `
          <div class="rte-wrap rte-compacta torneo-desc-editor">
            <div class="rte-toolbar" id="torneoDescBarra"></div>
            <div class="rte-surface" id="torneoDescCuerpo"></div>
          </div>`)}
        ${extra('repite', icons.refreshCw(20), '¿Se repite?', `
          <label class="tc-campo">Cada cuánto
            <select id="torneoRepite">
              <option value="">Solo esta vez</option>
              <option value="semanal">Cada semana</option>
              <option value="quincenal">Cada dos semanas</option>
            </select>
            <span class="torneo-campo-pista">Al acabar, se crea solo el siguiente con lo mismo y las inscripciones abiertas. Lo paras cuando quieras desde «⋯».</span>
          </label>`)}
        ${extra('checkin', icons.checkCircle(20), 'Check-in', `
          <label class="tc-campo">Minutos para confirmar antes de empezar (de 0 a 30)
            <input type="number" inputmode="numeric" id="torneoCheckin" min="0" max="30" value="5" />
          </label>`)}
        ${esAdmin ? `<label class="tc-extra tc-extra-casilla" id="torneoOficialCampo">
          <span class="tc-extra-ico" aria-hidden="true">${icons.star(20)}</span>
          <span class="tc-extra-texto"><b>Torneo oficial de PokeDoc</b><small>Solo si lo organiza el equipo</small></span>
          <input type="checkbox" id="torneoOficial" />
        </label>` : ''}
      </div>`)}

    ${pregunta('resumen', '¿Lo creamos?', 'Se crea como borrador: nadie puede apuntarse hasta que abras las inscripciones.', `
      <div class="tc-cartel" id="tcCartel"></div>
      <dl class="tc-resumen" id="wizardResumen"></dl>`)}

    </div>
    <footer class="tc-pie">
      <button type="button" class="btn-primary tc-siguiente" id="btnPasoSiguiente">Siguiente</button>
      <button type="submit" class="btn-primary tc-siguiente" id="btnCrearTorneo" hidden>Crear torneo</button>
    </footer>
  </form>
</dialog>`
}

// ── El estado del formulario ──

let actual = 'nombre'
let volverAlResumen = false
let descripcionHtml = ''
let editorMontado = false
let imagenElegida = null
let bannerElegido = null
let pintarImagenElegida = () => {}
let pintarBannerElegido = () => {}
let contexto = { session: null, perfil: null, alCrear: () => {} }

const esLiga = () => $('torneoTipo').value === 'league'
const sinLimite = () => $('torneoSinLimite').checked
const rondasPorJornadaElegidas = () => Math.max(1, Number($('torneoRondasJornada')?.value) || 1)
const enPersona = () => $('torneoModalidad')?.value === 'presencial'
const aplica = (id) => (id !== 'jornadas' || esLiga()) && (id !== 'lugar' || enPersona())
const preguntasQueTocan = () => PREGUNTAS.filter(aplica)

function nombreCorto() {
  const n = $('torneoNombre').value.trim()
  return n.length > 34 ? `${n.slice(0, 32)}…` : n
}

// Las preguntas que nombran el torneo: así se nota que es TU torneo.
function titulos() {
  const n = nombreCorto()
  const t = {
    cuando: n ? `¿Cuándo empieza «${n}»?` : '¿Cuándo empieza?',
    plazas: n ? `¿Cuánta gente cabe en «${n}»?` : '¿Cuánta gente puede jugar?',
    donde: n ? `¿Dónde se juega «${n}»?` : '¿Dónde se juega?',
    entrada: enPersona() ? '¿Cómo se apunta la gente?' : '¿Quién puede apuntarse?',
  }
  for (const [id, texto] of Object.entries(t)) {
    const h = document.querySelector(`[data-titulo="${id}"]`)
    if (h) h.textContent = texto
  }
  $('tcTitulo').textContent = n || 'Nuevo torneo'
}

// Lo marcado en cada grupo de tarjetas sale de los campos, no al revés: así
// duplicar un torneo (que rellena los campos) deja marcado lo que toca.
function marcarOpciones() {
  const valorDe = (campo) => {
    if (campo === 'torneoSinLimite') return sinLimite() ? 'si' : ''
    if (campo === 'torneoPrivado') return $('torneoPrivado').checked ? 'si' : 'no'
    if (campo === 'torneoPlazas') return sinLimite() ? '' : $('torneoPlazas').value
    return $(campo)?.value
  }
  const plazasRapida = !sinLimite() && PLAZAS_RAPIDAS.includes(Number($('torneoPlazas').value))
  const minutosRapido = MINUTOS_RAPIDOS.some(([m]) => m === Number($('torneoMinutos').value))
  document.querySelectorAll('#torneoCrear .tc-opcion').forEach((b) => {
    const { campo, valor } = b.dataset
    let puesta = campo !== 'otra' && String(valorDe(campo)) === valor
    if (campo === 'otra' && valor === 'plazas') puesta = !sinLimite() && !plazasRapida
    if (campo === 'otra' && valor === 'minutos') puesta = !minutosRapido
    b.classList.toggle('puesta', puesta)
    b.setAttribute('aria-pressed', String(puesta))
  })
  $('tcPlazasOtra').hidden = sinLimite() || plazasRapida
  $('tcMinutosOtro').hidden = minutosRapido
  $('torneoCodigoCampo').hidden = enPersona() || !$('torneoPrivado').checked
  // En persona (1452): las tres maneras de apuntarse y sin check-in (lo hace
  // la puerta); online, lo de siempre.
  document.querySelector('#torneoCrear .tc-persona').hidden = !enPersona()
  document.querySelector('#torneoCrear .tc-online').hidden = enPersona()
  const checkin = document.querySelector('#torneoCrear [data-extra="checkin"]')
  if (checkin) checkin.hidden = enPersona()
  pintarChipsDeFecha()
}

function pintarChipsDeFecha() {
  const caja = document.querySelector('[data-chips="dia"]')
  const valor = $('torneoFecha').value
  caja.innerHTML = diasRapidos()
    .map((d) => `<button type="button" class="tc-chip${valor.startsWith(d.valor) ? ' puesta' : ''}" data-dia="${d.valor}">${d.texto}</button>`)
    .join('')
  document.querySelectorAll('[data-hora]').forEach((b) => b.classList.toggle('puesta', valor.endsWith(`T${b.dataset.hora}`)))
}

// ── Las jornadas de una liga (tanda 219; en la ventana desde la 1434) ──
function fechasDeJornadas() {
  return [...document.querySelectorAll('#torneoJornadasLista input')].map((i) => i.value)
}

function pintarCamposJornadas(fechas = null) {
  const liga = esLiga()
  $('torneoRondasEtiqueta').hidden = liga
  $('torneoRondasJornadaCampo').hidden = !liga
  if (!liga) return
  const cuantas = Math.min(12, Math.max(1, Number($('torneoRondas').value) || 1))
  const lista = $('torneoJornadasLista')
  const previas = fechas ?? fechasDeJornadas()
  lista.innerHTML = Array.from({ length: cuantas }, (_, i) => `
    <div class="torneo-jornada-campo">
      <label>Jornada ${i + 1}
        <input type="datetime-local" data-jornada="${i}" value="${escapeHtml(previas[i] || '')}" />
      </label>
      ${cuantas > 1 ? `<button type="button" class="btn-secondary torneo-quitar-jornada" data-quitar-jornada="${i}" title="Quitar esta jornada" aria-label="Quitar la jornada ${i + 1}">✕</button>` : ''}
    </div>`).join('')
}

// ── El formato que se propone ──
function pintarFormato() {
  const liga = esLiga()
  const rondas = Number($('torneoRondas').value) || 1
  const { suizas, corte } = frasesDelFormato({
    liga,
    rondas,
    porJornada: rondasPorJornadaElegidas(),
    bo: Number($('torneoSwissBo').value),
    corte: Number($('torneoCorte').value),
    boCorte: Number($('torneoCorteBo').value),
  })
  $('tcFormatoSuizas').textContent = suizas
  $('tcFormatoCorte').textContent = corte
  $('torneoCorteBoCampo').hidden = !Number($('torneoCorte').value)
  const plazas = Number($('torneoPlazas').value)
  $('tcFormatoNota').textContent = liga
    ? 'Las jornadas son las que has puesto. Cada una se empareja de cero.'
    : sinLimite()
      ? 'Sin límite de plazas: al cerrar las inscripciones te propongo las rondas con la gente que haya de verdad.'
      : `Es lo de la tabla oficial para ${plazas} jugadores.`
}

// Con las plazas, la tabla oficial propone rondas y corte. En una liga las
// rondas son las JORNADAS (ya elegidas antes): solo se toca el corte.
function aplicarTablaOficial() {
  const n = Number($('torneoPlazas').value)
  if (!n || n < 4) return
  const { swissRounds, topCutSize } = officialStructure(n)
  if (!esLiga()) $('torneoRondas').value = swissRounds
  const corte = $('torneoCorte')
  if ([...corte.options].some((o) => Number(o.value) === topCutSize)) corte.value = String(topCutSize)
}

// ── Premios (tanda 352) ──
function premiosDelFormulario() {
  return [...document.querySelectorAll('#nuevoPremiosLista .torneo-premio-fila')].map((fila) => ({
    puesto: fila.querySelector('[data-premio-puesto]')?.value || '',
    premio: fila.querySelector('[data-premio-que]')?.value || '',
  }))
}

function pintarPremiosNuevo(filas) {
  const caja = $('nuevoPremiosLista')
  caja.innerHTML = (filas.length ? filas : [{ puesto: '', premio: '' }])
    .map(
      (p, i) => `<div class="torneo-premio-fila">
        <input type="text" data-premio-puesto="${i}" maxlength="${PUESTO_MAXIMO}" placeholder="1º" value="${escapeHtml(p.puesto || '')}" aria-label="Puesto del premio ${i + 1}" />
        <input type="text" data-premio-que="${i}" maxlength="${PREMIO_MAXIMO}" placeholder="50 € en cartas" value="${escapeHtml(p.premio || '')}" aria-label="Qué se lleva" />
        <button type="button" class="btn-secondary torneo-quitar-jornada" data-premio-quitar="${i}" title="Quitar este premio" aria-label="Quitar este premio">✕</button>
      </div>`
    )
    .join('')
}

// ── La descripción (tanda 220): el editor del foro, al abrir su apartado ──
async function montarEditorDescripcion(htmlInicial = '') {
  descripcionHtml = htmlInicial
  editorMontado = true
  const [{ richTextToolbarHtml, initRichTextEditor }, { uploadGuideImage }] = await Promise.all([import('../richtext-editor.js'), import('../app.js')])
  const barra = $('torneoDescBarra')
  barra.innerHTML = richTextToolbarHtml()
  initRichTextEditor({
    toolbarEl: barra,
    surfaceEl: $('torneoDescCuerpo'),
    initialHtml: htmlInicial,
    placeholder: 'Reglas de la casa, cómo se juega…',
    onChange: (html) => {
      descripcionHtml = html
      pintarExtras()
    },
    uploadImage: (file) => uploadGuideImage(contexto.session.user.id, file),
  })
}

const TEXTO_REPITE = { semanal: 'Cada semana', quincenal: 'Cada dos semanas' }

// Lo que dice cada apartado de «Dale tu toque» cerrado.
function pintarExtras() {
  const premios = premiosDelFormulario().filter((p) => p.premio.trim())
  const precio = precioDelCampo($('torneoPrecio').value)
  const textos = {
    premios: premios.length ? `${premios.length} premio${premios.length === 1 ? '' : 's'}: ${premios[0].premio.trim()}` : 'Sin premios',
    precio: precio === undefined ? 'Revisa el precio' : textoDePrecio(precio) || 'Sin decir',
    imagen: [imagenElegida && 'Con imagen', bannerElegido && 'con banner'].filter(Boolean).join(' y ') || 'Sin imagen',
    descripcion: descripcionHtml.replace(/<[^>]+>/g, '').trim() ? 'Escrita' : 'Sin descripción',
    checkin: Number($('torneoCheckin').value) ? `${$('torneoCheckin').value} min antes de empezar` : 'Sin check-in',
    repite: TEXTO_REPITE[$('torneoRepite').value] || 'Solo esta vez',
  }
  // Una liga ya tiene sus jornadas: no se repite (la base tampoco lo deja).
  const repite = document.querySelector('[data-extra="repite"]')
  if (repite) repite.hidden = esLiga()
  for (const [id, texto] of Object.entries(textos)) {
    const el = document.querySelector(`[data-extra-valor="${id}"]`)
    if (el) el.textContent = texto
  }
}

// ── Validar cada pregunta ──
// Devuelve el aviso, o '' si vale. Lo usan «Siguiente» y, al crear, todas.
function fallo(id) {
  if (id === 'nombre') return $('torneoNombre').value.trim() ? '' : 'Ponle un nombre al torneo.'
  if (id === 'lugar') return $('torneoLugar').value.trim() ? '' : 'Dinos en qué sitio se juega.'
  if (id === 'cuando') {
    const v = $('torneoFecha').value
    if (!v) return 'Elige el día y la hora.'
    if (new Date(v).getTime() < Date.now() - 60 * 60e3) return 'Esa hora ya ha pasado.'
    return ''
  }
  if (id === 'jornadas' && esLiga()) {
    const fechas = fechasDeJornadas()
    if (!fechas.length) return 'Una liga necesita al menos una jornada.'
    if (fechas.some((f) => !f)) return 'Ponle fecha a todas las jornadas.'
    for (let i = 1; i < fechas.length; i++) {
      if (new Date(fechas[i]) <= new Date(fechas[i - 1])) return `La jornada ${i + 1} no puede ir antes que la ${i}.`
    }
    return ''
  }
  if (id === 'plazas') {
    const n = Number($('torneoPlazas').value)
    return sinLimite() || (n >= 4 && n <= 256) ? '' : 'Las plazas van de 4 a 256 (o «Sin límite»).'
  }
  if (id === 'formato') {
    const r = Number($('torneoRondas').value)
    return r >= 1 && r <= 12 ? '' : esLiga() ? 'Una liga va de 1 a 12 jornadas.' : 'Las rondas suizas van de 1 a 12.'
  }
  if (id === 'reloj') {
    const m = Number($('torneoMinutos').value)
    return m >= 5 && m <= 120 ? '' : 'Cada ronda dura de 5 a 120 minutos.'
  }
  if (id === 'entrada') return $('torneoPrivado').checked && !$('torneoCodigoNuevo').value.trim() ? 'Escribe el código: sin él nadie podría apuntarse.' : ''
  if (id === 'extras') {
    if (precioDelCampo($('torneoPrecio').value) === undefined) return 'El precio es un número de 0 a 1.000 (por ejemplo, 5 o 7,50).'
    const c = Number($('torneoCheckin').value)
    if (!(c >= 0 && c <= 30)) return 'El check-in va de 0 a 30 minutos.'
  }
  return ''
}

// ── Moverse entre preguntas ──
function ir(id, { hacia = 'adelante' } = {}) {
  actual = id
  const lista = preguntasQueTocan()
  const indice = lista.indexOf(id)
  const total = lista.length - 1 // el resumen no es una pregunta
  document.querySelectorAll('#torneoCrear [data-pregunta]').forEach((s) => {
    const es = s.dataset.pregunta === id
    s.hidden = !es
    s.classList.remove('tc-entra-adelante', 'tc-entra-atras')
    if (es) {
      void s.offsetWidth
      s.classList.add(hacia === 'atras' ? 'tc-entra-atras' : 'tc-entra-adelante')
    }
  })
  $('tcBarra').style.width = `${Math.round((Math.min(indice, total) / total) * 100)}%`
  $('tcCuenta').textContent = id === 'resumen' ? 'Listo' : `${indice + 1} de ${total}`
  $('btnPasoAtras').toggleAttribute('hidden', indice === 0)
  $('btnPasoSiguiente').hidden = id === 'resumen'
  $('btnCrearTorneo').hidden = id !== 'resumen'
  $('btnPasoSiguiente').textContent = id === 'extras' ? 'Ver cómo queda' : volverAlResumen ? 'Volver al resumen' : 'Siguiente'
  titulos()
  if (id === 'formato') pintarFormato()
  if (id === 'jornadas') {
    // La primera vez, las jornadas salen ya puestas una por semana desde el
    // día que empieza: lo normal es retocar una, no escribir doce.
    if (fechasDeJornadas().every((f) => !f)) pintarCamposJornadas(jornadasSemanales($('torneoFecha').value, Number($('torneoRondas').value) || 4))
  }
  if (id === 'extras') pintarExtras()
  if (id === 'resumen') pintarResumen()
  marcarOpciones()
  $('tcCuerpo').scrollTop = 0
  // El foco, a lo primero que se contesta (con teclado se sigue sin ratón).
  const seccion = document.querySelector(`#torneoCrear [data-pregunta="${id}"]`)
  const primero = seccion?.querySelector('input:not([type=hidden]):not([hidden]), .tc-opcion.puesta, .tc-opcion, button')
  if (id === 'nombre') $('torneoNombre').focus()
  else primero?.focus({ preventScroll: true })
}

function siguiente() {
  const aviso = fallo(actual)
  if (aviso) {
    showToast(aviso)
    return
  }
  const lista = preguntasQueTocan()
  if (volverAlResumen) {
    // Desde «Cambiar»: de vuelta al resumen, salvo que el cambio deje otra
    // pregunta a medias (pasar a liga pide las jornadas).
    const pendiente = lista.find((id) => id !== 'resumen' && fallo(id))
    if (pendiente) ir(pendiente)
    else {
      volverAlResumen = false
      ir('resumen')
    }
    return
  }
  ir(lista[Math.min(lista.indexOf(actual) + 1, lista.length - 1)])
}

function anterior() {
  const lista = preguntasQueTocan()
  const i = lista.indexOf(actual)
  if (i > 0) ir(lista[i - 1], { hacia: 'atras' })
}

// ── «Así queda» ──
function pintarResumen() {
  const liga = esLiga()
  const precio = precioDelCampo($('torneoPrecio').value)
  const premios = premiosDelFormulario().filter((p) => p.premio.trim())
  const { suizas, corte } = frasesDelFormato({
    liga,
    rondas: Number($('torneoRondas').value) || 1,
    porJornada: rondasPorJornadaElegidas(),
    bo: Number($('torneoSwissBo').value),
    corte: Number($('torneoCorte').value),
    boCorte: Number($('torneoCorteBo').value),
  })
  const filas = [
    ['nombre', 'Nombre', $('torneoNombre').value.trim()],
    ['donde', 'Dónde', enPersona() ? `En persona · ${[$('torneoLugar').value.trim(), $('torneoDireccion').value.trim()].filter(Boolean).join(', ')}` : 'Online'],
    ['tipo', 'Tipo', liga ? 'Liga por jornadas' : 'De un día'],
    ['cuando', 'Empieza', $('torneoFecha').value ? fechaBonita($('torneoFecha').value) : '—'],
    ...(liga ? [['jornadas', 'Jornadas', fechasDeJornadas().map((f, i) => `J${i + 1} ${f ? fechaBonita(f) : '—'}`).join(' · ')]] : []),
    ['plazas', 'Plazas', sinLimite() ? 'Sin límite' : $('torneoPlazas').value],
    ['formato', 'Se juega', `${suizas} · ${corte}`],
    ['reloj', 'Cada ronda', `${$('torneoMinutos').value} min`],
    ['entrada', 'Se apunta', enPersona() ? TEXTO_INSCRIPCION[$('torneoInscripcion').value] : $('torneoPrivado').checked ? `Con el código «${$('torneoCodigoNuevo').value.trim()}»` : 'Cualquiera'],
    ['listas', 'Listas', TEXTO_MODO_LISTAS[$('torneoListasModo').value] || '—'],
    ['extras', 'Extras', [premios.length ? `${premios.length} premio${premios.length === 1 ? '' : 's'}` : '', textoDePrecio(precio) || '', !liga && TEXTO_REPITE[$('torneoRepite').value] ? TEXTO_REPITE[$('torneoRepite').value].toLowerCase() : '', imagenElegida || bannerElegido ? 'imagen' : '', $('torneoOficial')?.checked ? 'oficial' : ''].filter(Boolean).join(' · ') || 'Nada más'],
  ]
  $('wizardResumen').innerHTML = filas
    .map(
      ([id, dt, dd]) => `<div class="tc-resumen-fila">
        <dt>${dt}</dt><dd>${escapeHtml(String(dd))}</dd>
        <button type="button" class="tc-cambiar" data-ir="${id}" aria-label="Cambiar ${dt.toLowerCase()}">Cambiar</button>
      </div>`
    )
    .join('')
  const banner = bannerElegido ? URL.createObjectURL(bannerElegido) : null
  const chapas = [enPersona() ? 'En persona' : 'Online', liga ? 'Liga' : 'De un día', sinLimite() ? 'Sin límite' : `${$('torneoPlazas').value} plazas`, corte === 'Sin top cut' ? null : corte.split(' al ')[0], $('torneoPrivado').checked ? 'Con código' : null].filter(Boolean)
  $('tcCartel').innerHTML = `
    <div class="tc-cartel-arte${banner ? ' con-banner' : ''}"${banner ? ` style="background-image:url('${banner}')"` : ''}>
      ${imagenElegida ? `<img class="tc-cartel-icono" src="${URL.createObjectURL(imagenElegida)}" alt="" width="56" height="56" />` : `<span class="tc-cartel-icono tc-cartel-trofeo" aria-hidden="true">${icons.trophy(28)}</span>`}
    </div>
    <div class="tc-cartel-texto">
      <p class="tc-cartel-fecha">${escapeHtml($('torneoFecha').value ? fechaBonita($('torneoFecha').value) : '')}</p>
      <p class="tc-cartel-nombre">${escapeHtml($('torneoNombre').value.trim())}</p>
      <p class="tc-cartel-chapas">${chapas.map((c) => `<span>${escapeHtml(c)}</span>`).join('')}</p>
    </div>`
}

// ── Montar una vez ──
function montar() {
  if ($('torneoCrear')) return
  document.body.insertAdjacentHTML('beforeend', htmlDelDialogo(Boolean(contexto.perfil?.is_admin)))
  const dialogo = $('torneoCrear')
  const form = $('torneoForm')

  // Una tarjeta pone su valor en su campo y, si es de las que contestan del
  // todo, pasa a la siguiente (con un respiro para que se vea marcada).
  form.addEventListener('click', (e) => {
    const b = e.target.closest('.tc-opcion')
    if (b) {
      const { campo, valor } = b.dataset
      if (campo === 'otra') {
        if (valor === 'plazas') {
          $('torneoSinLimite').checked = false
          if (PLAZAS_RAPIDAS.includes(Number($('torneoPlazas').value))) $('torneoPlazas').value = ''
        }
        if (valor === 'minutos' && MINUTOS_RAPIDOS.some(([m]) => m === Number($('torneoMinutos').value))) $('torneoMinutos').value = ''
        marcarOpciones()
        b.classList.add('puesta')
        const campoOtro = valor === 'plazas' ? $('torneoPlazas') : $('torneoMinutos')
        campoOtro.focus()
        return
      }
      if (campo === 'torneoSinLimite') $('torneoSinLimite').checked = true
      else if (campo === 'torneoPrivado') $('torneoPrivado').checked = valor === 'si'
      else {
        if (campo === 'torneoPlazas') $('torneoSinLimite').checked = false
        $(campo).value = valor
      }
      if (campo === 'torneoPlazas') aplicarTablaOficial()
      if (campo === 'torneoTipo') pintarCamposJornadas()
      marcarOpciones()
      if (campo === 'torneoPrivado' && valor === 'si') {
        $('torneoCodigoNuevo').focus()
        return
      }
      if (b.hasAttribute('data-avanza')) setTimeout(siguiente, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180)
      return
    }
    const dia = e.target.closest('[data-dia]')
    if (dia) {
      const hora = $('torneoFecha').value.slice(11, 16) || HORA_POR_DEFECTO
      $('torneoFecha').value = `${dia.dataset.dia}T${hora}`
      pintarChipsDeFecha()
      return
    }
    const hora = e.target.closest('[data-hora]')
    if (hora) {
      const diaPuesto = $('torneoFecha').value.slice(0, 10) || diasRapidos()[0].valor
      $('torneoFecha').value = `${diaPuesto}T${hora.dataset.hora}`
      pintarChipsDeFecha()
      return
    }
    const cambiar = e.target.closest('[data-ir]')
    if (cambiar) {
      volverAlResumen = true
      ir(cambiar.dataset.ir, { hacia: 'atras' })
      return
    }
    const quitarJornada = e.target.closest('[data-quitar-jornada]')
    if (quitarJornada) {
      const sinEsa = fechasDeJornadas().filter((_, i) => i !== Number(quitarJornada.dataset.quitarJornada))
      $('torneoRondas').value = String(sinEsa.length)
      pintarCamposJornadas(sinEsa)
      return
    }
    const quitarPremio = e.target.closest('[data-premio-quitar]')
    if (quitarPremio) {
      pintarPremiosNuevo(premiosDelFormulario().filter((_, i) => i !== Number(quitarPremio.dataset.premioQuitar)))
      pintarExtras()
    }
  })

  $('torneoFecha').addEventListener('input', pintarChipsDeFecha)
  $('torneoPlazas').addEventListener('input', () => {
    $('torneoSinLimite').checked = false
    aplicarTablaOficial()
  })
  for (const id of ['torneoRondas', 'torneoRondasJornada', 'torneoCorte', 'torneoSwissBo', 'torneoCorteBo']) $(id).addEventListener('change', pintarFormato)
  $('torneoRondas').addEventListener('input', pintarFormato)
  $('btnAnadirJornada').addEventListener('click', () => {
    const fechas = fechasDeJornadas()
    if (fechas.length >= 12) {
      showToast('Una liga puede tener 12 jornadas como máximo.')
      return
    }
    const ultima = fechas[fechas.length - 1]
    $('torneoRondas').value = String(fechas.length + 1)
    pintarCamposJornadas([...fechas, ultima ? jornadasSemanales(ultima, 2)[1] : ''])
  })
  $('btnJornadasSemana').addEventListener('click', () => {
    const primera = fechasDeJornadas()[0] || $('torneoFecha').value
    pintarCamposJornadas(jornadasSemanales(primera, Number($('torneoRondas').value) || 1))
  })
  $('btnNuevoAnadirPremio').addEventListener('click', () => {
    const actuales = premiosDelFormulario()
    if (actuales.length >= PREMIOS_MAXIMO) {
      showToast(`Como mucho ${PREMIOS_MAXIMO} premios.`)
      return
    }
    pintarPremiosNuevo([...actuales, { puesto: '', premio: '' }])
  })
  form.addEventListener('input', (e) => {
    if (e.target.closest('.tc-extras')) pintarExtras()
  })
  document.querySelector('[data-extra="descripcion"]').addEventListener('toggle', (e) => {
    if (e.target.open && !editorMontado) void montarEditorDescripcion(descripcionHtml)
  })
  pintarPremiosNuevo([])

  // Intro en un campo es «Siguiente», nunca «crear»: con el formulario de
  // antes, Intro en el nombre lo mandaba entero.
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return
    const t = e.target
    if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.tagName === 'SUMMARY') return
    if (t.closest('.tc-extras')) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    if (actual === 'resumen') form.requestSubmit()
    else siguiente()
  })
  $('btnPasoSiguiente').addEventListener('click', siguiente)
  $('btnPasoAtras').addEventListener('click', anterior)
  $('btnCancelarTorneo').addEventListener('click', () => dialogo.close())
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo) dialogo.close()
  })

  // La imagen y el banner (tandas 239 y 242): se suben SOLO al crear.
  function montarCampoImagen(prefijo, alCambiar) {
    const preview = $(`${prefijo}Preview`)
    const input = $(`${prefijo}Input`)
    const boton = $(`btn${prefijo[0].toUpperCase()}${prefijo.slice(1)}`)
    const quitar = $(`btn${prefijo[0].toUpperCase()}${prefijo.slice(1)}Quitar`)
    const esBanner = /Banner/.test(prefijo)
    const pintar = (fichero) => {
      if (fichero) preview.src = URL.createObjectURL(fichero)
      preview.classList.toggle('hidden', !fichero)
      quitar.classList.toggle('hidden', !fichero)
      boton.textContent = fichero ? (esBanner ? 'Cambiar banner' : 'Cambiar imagen') : esBanner ? 'Elegir banner' : 'Elegir imagen'
      pintarExtras()
    }
    boton.addEventListener('click', () => input.click())
    input.addEventListener('change', () => {
      const f = input.files?.[0] || null
      alCambiar(f)
      pintar(f)
    })
    quitar.addEventListener('click', () => {
      input.value = ''
      alCambiar(null)
      pintar(null)
    })
    return pintar
  }
  pintarImagenElegida = montarCampoImagen('torneoImagen', (f) => (imagenElegida = f))
  pintarBannerElegido = montarCampoImagen('torneoBanner', (f) => (bannerElegido = f))

  let enviando = false
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (enviando) return
    const pendiente = preguntasQueTocan().find((id) => id !== 'resumen' && fallo(id))
    if (pendiente) {
      showToast(fallo(pendiente))
      volverAlResumen = true
      ir(pendiente)
      return
    }
    enviando = true
    $('btnCrearTorneo').disabled = true
    const { error, nombre } = await crearTorneo()
    enviando = false
    $('btnCrearTorneo').disabled = false
    if (error) {
      showToast(error, 'error')
      return
    }
    dialogo.close()
    reiniciar()
    showToast(`«${nombre}» creado como borrador. Abre las inscripciones cuando esté listo.`, 'success')
    contexto.alCrear()
  })
}

// La fila que se guarda: la misma de antes del cambio a preguntas.
async function crearTorneo() {
  const { session } = contexto
  const nombre = $('torneoNombre').value.trim()
  const liga = esLiga()
  const codigoNuevo = !enPersona() && $('torneoPrivado').checked ? $('torneoCodigoNuevo').value.trim() : ''
  // Primero las imágenes: si una subida falla, el torneo NO se crea a medias.
  let imageUrl = null
  let bannerUrl = null
  try {
    if (imagenElegida) imageUrl = await uploadProfileImage(session.user.id, imagenElegida, 'torneo')
    if (bannerElegido) bannerUrl = await uploadProfileImage(session.user.id, bannerElegido, 'torneo-banner')
  } catch (err) {
    return { error: 'No se ha podido subir la imagen: ' + (err?.message || err) }
  }
  // El modo de listas va por partida doble: la columna nueva (la que manda) y
  // el booleano viejo, que la política RLS sigue leyendo.
  const modoListas = $('torneoListasModo').value
  const precio = precioDelCampo($('torneoPrecio').value)
  const fila = {
    decklist_visibility: modoListas,
    image_url: imageUrl,
    banner_url: bannerUrl,
    slug: `${slugify(nombre)}-${Date.now().toString(36)}`,
    admin_id: session.user.id,
    name: nombre,
    description: descripcionHtml || null,
    prizes: premiosParaGuardar(premiosDelFormulario()),
    start_at: new Date($('torneoFecha').value).toISOString(),
    status: 'draft',
    format: liga ? 'league' : 'standard',
    matchday_dates: liga ? fechasDeJornadas().map((f) => new Date(f).toISOString()) : null,
    show_opponent_decklists: modoListas === 'en_juego',
    max_players: sinLimite() ? null : Number($('torneoPlazas').value),
    // En una liga, el total de rondas es jornadas × rondas por jornada (849).
    swiss_rounds: Number($('torneoRondas').value) * (liga ? rondasPorJornadaElegidas() : 1),
    round_time_minutes: Number($('torneoMinutos').value),
    ...(precio != null ? { precio_entrada: precio } : {}),
    checkin_minutes: Number($('torneoCheckin').value),
    swiss_bo: Number($('torneoSwissBo').value),
    top_cut_bo: Number($('torneoCorteBo').value),
    top_cut_size: Number($('torneoCorte').value),
    pairing_seed: semillaDePareo(),
    // Se manda siempre: si quien crea no es admin, el disparador de la base lo
    // pone a false pase lo que pase aquí.
    is_official: Boolean($('torneoOficial')?.checked),
    is_private: !enPersona() && $('torneoPrivado').checked,
  }
  if (enPersona()) {
    Object.assign(fila, {
      modalidad: 'presencial',
      lugar: $('torneoLugar').value.trim(),
      direccion: $('torneoDireccion').value.trim() || null,
      inscripcion: $('torneoInscripcion').value || 'pedir',
      // La puerta hace de check-in: el reloj de cada ronda empieza sin él.
      checkin_minutes: 0,
    })
  }
  if (liga && rondasPorJornadaElegidas() > 1) fila.rounds_per_matchday = rondasPorJornadaElegidas()
  // Se repite (1457): solo los de un día.
  if (!liga && TEXTO_REPITE[$('torneoRepite').value]) fila.repite = $('torneoRepite').value
  let { error } = await supabase.from('tournaments').insert(fila)
  // Sin la migración 1457 se crea igual, de una vez, y se dice.
  if (error && fila.repite && /repite/.test(error.message || '')) {
    delete fila.repite
    ;({ error } = await supabase.from('tournaments').insert(fila))
    if (!error) showToast('Creado, pero sin repetirse: falta ejecutar la migración 1457 en Supabase.', 'error')
  }
  // En persona sin la migración 1446 no se crea «online sin decirlo».
  if (error && fila.modalidad && /modalidad|lugar|direccion|inscripcion/.test(error.message || '')) {
    return { error: 'Los torneos en persona aún no están listos: falta ejecutar la migración 1446 en Supabase.' }
  }
  // Sin una columna nueva en la base, se reintenta sin ella (del modo de
  // listas queda el booleano viejo, que dice lo mismo salvo el «nunca»).
  for (const columna of ['decklist_visibility', 'image_url', 'banner_url', 'is_private', 'prizes', 'precio_entrada']) {
    if (error && (error.message || '').includes(columna)) {
      delete fila[columna]
      ;({ error } = await supabase.from('tournaments').insert(fila))
    }
  }
  if (error) {
    return {
      error: /tournaments/.test(error.message || '') ? 'Falta ejecutar supabase-migration-torneos.sql en el SQL Editor de Supabase.' : 'No se ha podido crear: ' + error.message,
    }
  }
  // El código, aparte (tanda 367): vive en su tabla porque la fila del torneo
  // la lee todo el mundo. Si falla, el torneo ya está y se pone desde Editar.
  if (fila.is_private && codigoNuevo) {
    const { data: creado } = await supabase.from('tournaments').select('id').eq('slug', fila.slug).maybeSingle()
    let falloCodigo = creado?.id ? null : { message: 'no se encuentra el torneo recién creado' }
    if (creado?.id) ({ error: falloCodigo } = await supabase.from('tournament_join_codes').insert({ tournament_id: creado.id, code: codigoNuevo }))
    if (falloCodigo) showToast('El torneo está creado, pero el código no se ha guardado: ponlo desde Editar.', 'error')
  }
  return { nombre }
}

// 32 caracteres de azar: la semilla del sorteo de la ronda 1 y la moneda de
// los desempates.
function semillaDePareo() {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return [...crypto.getRandomValues(new Uint8Array(32))].map((v) => abc[v % abc.length]).join('')
}

function reiniciar() {
  $('torneoForm').reset()
  $('torneoTipo').value = 'standard'
  $('torneoListasModo').value = 'al_terminar'
  $('torneoFecha').value = ''
  descripcionHtml = ''
  $('torneoDescCuerpo').innerHTML = ''
  imagenElegida = null
  bannerElegido = null
  pintarImagenElegida(null)
  pintarBannerElegido(null)
  pintarPremiosNuevo([])
  pintarCamposJornadas([])
  document.querySelectorAll('#torneoCrear details[open]').forEach((d) => (d.open = false))
  volverAlResumen = false
}

// Rellenar con un torneo viejo («Duplicar»). La fecha NO se copia (un torneo
// nuevo nunca empieza en el pasado): la semana que viene a la misma hora.
function cargarPlantilla(viejo) {
  reiniciar()
  $('torneoNombre').value = viejo.name || ''
  $('torneoTipo').value = viejo.format === 'league' ? 'league' : 'standard'
  $('torneoListasModo').value = viejo.decklist_visibility || (viejo.show_opponent_decklists ? 'en_juego' : 'al_terminar')
  const semana = new Date(Date.now() + 7 * 86400e3)
  const viejaHora = viejo.start_at ? new Date(viejo.start_at) : null
  if (viejaHora) semana.setHours(viejaHora.getHours(), viejaHora.getMinutes(), 0, 0)
  $('torneoFecha').value = aLocal(semana)
  $('torneoSinLimite').checked = viejo.max_players == null
  $('torneoPlazas').value = viejo.max_players ?? 16
  // En una liga el campo cuenta jornadas, no rondas (849).
  $('torneoRondas').value = viejo.format === 'league' ? numJornadas(viejo) : viejo.swiss_rounds
  $('torneoRondasJornada').value = String(viejo.format === 'league' ? rondasPorJornada(viejo) : 1)
  $('torneoCorte').value = String(viejo.top_cut_size ?? 0)
  $('torneoSwissBo').value = String(viejo.swiss_bo ?? 1)
  $('torneoCorteBo').value = String(viejo.top_cut_bo ?? 3)
  if (viejo.round_time_minutes) $('torneoMinutos').value = viejo.round_time_minutes
  if (viejo.checkin_minutes != null) $('torneoCheckin').value = viejo.checkin_minutes
  // En persona (1452): el sitio y la manera de apuntarse se copian; la puerta
  // es la misma tienda la mayoría de las veces.
  if (viejo.modalidad === 'presencial') {
    $('torneoModalidad').value = 'presencial'
    $('torneoLugar').value = viejo.lugar || ''
    $('torneoDireccion').value = viejo.direccion || ''
    $('torneoInscripcion').value = viejo.inscripcion || 'pedir'
  }
  if (viejo.precio_entrada != null) $('torneoPrecio').value = String(viejo.precio_entrada).replace('.', ',')
  // Duplicar NO copia «se repite»: la serie ya crea sus torneos sola, y una
  // copia repitiéndose sería una segunda serie el mismo día.
  $('torneoRepite').value = ''
  if (Array.isArray(viejo.prizes) && viejo.prizes.length) pintarPremiosNuevo(viejo.prizes)
  descripcionHtml = viejo.description || ''
  if (descripcionHtml) $('torneoDescCuerpo').innerHTML = descripcionHtml
  editorMontado = false
  pintarCamposJornadas(jornadasSemanales($('torneoFecha').value, Number($('torneoRondas').value) || 1))
}

// Abre la ventana. Con `plantilla` (Duplicar) entra directa a «¿Lo
// creamos?», con todo relleno y «Cambiar» en cada fila.
export async function abrirCrear({ session, perfil, plantilla = null, alCrear = () => {} }) {
  contexto = { session, perfil, alCrear }
  await hoja
  montar()
  const dialogo = $('torneoCrear')
  if (plantilla) cargarPlantilla(plantilla)
  if (!dialogo.open) dialogo.showModal()
  if (plantilla) {
    ir('resumen')
    showToast('Plantilla cargada: cambia lo que quieras y créalo.', 'success')
  } else {
    // Se sigue donde se dejó (cerrar sin crear no borra nada); con el nombre
    // vacío, desde el principio.
    volverAlResumen = false
    ir($('torneoNombre').value.trim() && actual !== 'nombre' ? actual : 'nombre')
  }
}
