// La página /compartir (tanda 1317, A7): lee lo que dejó el service worker en
// la dirección y salta a donde toca. Sin pintar nada más que «Abriendo…».
import { destinoCompartido } from './compartir-puro.js'

const p = new URLSearchParams(window.location.search)
window.location.replace(destinoCompartido({ url: p.get('url') || '', text: p.get('text') || '', title: p.get('title') || '' }))
