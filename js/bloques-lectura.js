// Pintar los bloques de una guía ya guardada, en modo LECTURA.
//
// Vive aparte del editor desde la tanda 316. js/guia.js solo necesita
// esto, pero lo traía de js/block-editor.js — que arrastra consigo el
// selector de emoji y, por él, el buscador de cartas. El barrido de la
// tanda 299 sigue los imports, así que /guia «usaba» las clases del
// editor y se le exigía una hoja que no abre nunca.
//
// El nombre de un tipo de bloque se guarda tal cual en la base, así que
// los de guías antiguas (heading, paragraph, image, list, highlight)
// tienen que seguir pintándose: `richtext` es el del editor de ahora.

import { escapeHtml } from './app.js'
import { parseBBCode } from './bbcode.js'
import { sanitizeRichText } from './richtext-format.js'

export function renderReferenceBlock(block, headings = []) {
  switch (block.type) {
    case 'richtext': {
      const clean = sanitizeRichText(block.html || '')
      if (typeof DOMParser === 'undefined') return clean
      const doc = new DOMParser().parseFromString(clean, 'text/html')
      doc.querySelectorAll('h2, h3').forEach((h) => {
        const id = `section-${headings.length}`
        h.id = id
        headings.push({ id, text: h.textContent })
      })
      return doc.body.innerHTML
    }
    case 'heading': {
      const id = `section-${headings.length}`
      headings.push({ id, text: block.text })
      return `<h2 id="${id}">${escapeHtml(block.text || '')}</h2>`
    }
    case 'paragraph':
      return `<p>${parseBBCode(block.text || '')}</p>`
    case 'image':
      return block.url ? `<img loading="lazy" src="${block.url}" alt="${escapeHtml(block.caption || '')}" onerror="this.style.display='none'">` : ''
    case 'list':
      return `<ul>${(block.items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
    case 'highlight':
      return `<div class="block-highlight">${parseBBCode(block.text || '')}</div>`
    default:
      return ''
  }
}

export function renderReferenceBlocksHtml(blocks, headings = []) {
  return (blocks || []).map((b) => renderReferenceBlock(b, headings)).join('')
}

