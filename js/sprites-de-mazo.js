// Los dos Pokémon de un mazo guardado (1221, la maqueta de «La web como la
// portada»): las direcciones de sus sprites, sacadas de su lista igual que el
// arquetipo de Mis partidas (`listaDeMazoGuardado` + `deducirIconos`). Lo
// usan /mazos (el dibujo de cada tarjeta) y /laboratorio (cada mazo de
// «Con uno de tus mazos»). `filaDe(id)` da la fila del catálogo de una carta.
import { listaDeMazoGuardado } from './partidas-mazos.js'
import { deducirIconos, dexesDeNombre } from './torneos/arquetipos.js'
import { spriteDeCarta, spriteDeObjeto, urlDeSprite, atributosDeRespaldo } from './torneos/sprites-pokemon.js'
import { escapeHtml } from './html.js'

export function spritesDeMazoGuardado(cards, filaDe) {
  const lista = listaDeMazoGuardado(cards, filaDe)
  return lista.pokemon.length ? deducirIconos(lista).map((i) => spriteDeCarta(i.nombre)).filter(Boolean) : []
}

// Las <img> con su cadena de respaldos (si un origen no contesta, el
// siguiente; agotada, se esconde).
export function spritesHtml(urls, clase, tam = 96) {
  return urls.map((u) => `<img class="${clase}" src="${escapeHtml(u)}" alt="" width="${tam}" height="${tam}" loading="lazy"${atributosDeRespaldo(u)} />`).join('')
}

// Los de un mazo del que solo se sabe el NOMBRE (lo que guarda una repetición
// en `mazo_a`/`mazo_b`): las especies del nombre, o el objeto si es un mazo
// de objeto. Lo mismo que hace Mis partidas sin catálogo.
export function spritesDeNombreDeMazo(nombre) {
  const urls = dexesDeNombre(nombre || '').slice(0, 2).map(urlDeSprite).filter(Boolean)
  if (urls.length) return urls
  const objeto = spriteDeObjeto(nombre || '')
  return objeto ? [objeto] : []
}
