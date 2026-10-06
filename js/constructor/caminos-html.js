// Cómo se enseñan los caminos para encontrar una carta (tanda 554): lo
// mismo en el panel del laboratorio que en la ventana de una repetición.
// Su hoja es css/laboratorio.css, que cargan las dos páginas.
import { escapeHtml } from '../html.js'

// Un porcentaje que no afirma más de lo que se sabe: lo que es casi seguro
// pero puede fallar (todas en los premios) no se redondea a «100 %».
export function pctDeCamino(x, puedeFallar = true) {
  if (x >= 1 && !puedeFallar) return '100 %'
  if (x >= 0.995) return '>99 %'
  if (x > 0 && x < 0.005) return '<1 %'
  return `${Math.round(x * 100)} %`
}

export function pasoHtml(paso) {
  const n = escapeHtml(paso.nombre)
  const h = paso.habilidad ? escapeHtml(paso.habilidad) : ''
  // `usa` (tanda 630): un básico que se baja para usar su habilidad con su
  // botón (Fezandipiti ex) es un paso, no dos.
  const texto =
    paso.tipo === 'banca' ? (paso.usa ? `Bajar ${n} y usar ${h}` : `Bajar ${n} (${h})`) : paso.tipo === 'evolucion' ? `Evolucionar a ${n} (${h})` : paso.tipo === 'habilidad' ? `${n}: ${h}` : n
  const si = paso.siempre ? '' : ` <span class="lab-paso-si">${paso.tipo === 'habilidad' ? 'si se puede' : 'si la tienes'}: ${pctDeCamino(paso.cuando)}</span>`
  // La cifra cuenta con que se coge todo lo que la carta deje (tanda 630):
  // quien coja solo lo que busca saca menos cartas del mazo y no llega.
  const adelgaza = paso.adelgaza ? ' <span class="lab-paso-si">cogiendo todas las que deje: el mazo adelgaza</span>' : ''
  return `<span class="lab-paso${paso.partidario ? ' lab-paso-partidario' : ''}">${texto}${si}${adelgaza}</span>`
}

function caminoHtml(c, puedeFallar, { mejor = false } = {}) {
  const partidario = c.pasos.some((x) => x.partidario) ? '<span class="sr-only">. </span><span class="lab-camino-nota">Usa tu partidario del turno</span>' : ''
  // El primero es LA respuesta a «¿cómo la encuentro?» (tanda 595): se dice
  // con palabras, y que el orden de los pasos es parte de ella.
  // Y si el orden no cambia nada (tanda 623), se dice eso: «en este orden»
  // afirmaría algo que el cálculo no ha visto.
  const etiqueta = mejor ? `<span class="lab-camino-mejor">${c.pasos.length < 2 ? 'Lo mejor' : c.ordenDaIgual ? 'Lo mejor, en cualquier orden' : 'Lo mejor, en este orden'}</span><span class="sr-only">: </span>` : ''
  return `<li class="lab-camino${mejor ? ' lab-camino-es-mejor' : ''}">
      ${etiqueta}<span class="lab-camino-p">${pctDeCamino(c.p, puedeFallar)}</span>
      <span class="lab-camino-pasos">${c.pasos.map(pasoHtml).join('<span class="lab-camino-flecha" aria-hidden="true">→</span><span class="sr-only">, después </span>')}${partidario}</span>
    </li>`
}

// `r`: lo que devuelve buscarCaminos. `nombre`: la carta que se busca.
export function resultadoDeCaminosHtml(r, nombre) {
  const n = escapeHtml(nombre)
  if (r.yaLaTienes) return `<p class="lab-caminos-vacio">Ya tienes ${n} en la mano.</p>`
  if (r.noQueda) return `<p class="lab-caminos-vacio">No queda ninguna ${n} ni en el mazo ni en los premios: no hay camino que la traiga.</p>`
  const puedeFallar = (r.todasPremiadas ?? 1) > 0
  const datos = `<p class="lab-caminos-datos">${r.quedan === 1 ? 'Queda 1' : `Quedan ${r.quedan}`} entre el mazo y los premios boca abajo · Robarla en tu próximo robo: ${pctDeCamino(r.siguienteRobo)}${r.todasPremiadas > 0 ? ` · Que estén todas en los premios: ${pctDeCamino(r.todasPremiadas)}` : ''}</p>`
  const buenos = r.caminos.filter((c) => !c.dominado)
  const otros = r.caminos.filter((c) => c.dominado)
  if (!buenos.length) {
    return `${datos}<p class="lab-caminos-vacio">Con lo que tienes ahora (mano, habilidades y lo que te dejan jugar las reglas) no hay ningún camino que traiga ${n} este turno.</p>`
  }
  return `${datos}
    <ol class="lab-caminos">${buenos.map((c, i) => caminoHtml(c, puedeFallar, { mejor: i === 0 })).join('')}</ol>
    ${
      otros.length
        ? `<details class="lab-caminos-otros"><summary>${otros.length === 1 ? 'Otro camino' : `Otros ${otros.length} caminos`} (uno más corto llega igual o mejor)</summary><ol class="lab-caminos">${otros.map((c) => caminoHtml(c, puedeFallar)).join('')}</ol></details>`
        : ''
    }
    <p class="subtext lab-caminos-nota">Cada camino se ha jugado en ${r.muestras} repartos de lo que no sabes (el orden del mazo y los premios boca abajo), eligiendo siempre a favor de ${n}. Dónde está ${n} se reparte a partes iguales entre los repartos, también después de barajar (un Poffin, Dudunsparce que vuelve al mazo), así que con una sola copia la cifra sale casi exacta; con varias copias, o con monedas de por medio, puede bailar unos ${Math.round(200 * Math.sqrt(0.25 / r.muestras))} puntos. Al buscar se cogen también cartas que no hacen falta (cada una que sale del mazo hace más fácil robar ${n} después), salvo si viene una que roba hasta tener N en la mano; donde eso cambia la cifra, el paso lo dice. Un paso que no puedes dar en un reparto (no tienes la carta) se salta, y en cuanto aparece ${n} se para.</p>`
}
