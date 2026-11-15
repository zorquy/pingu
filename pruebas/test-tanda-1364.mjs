// Tanda 1364 — Lo nuevo de la API de TCGGO, la C: las últimas ventas de una
// carta gradeada (`/ebay-sold-offers`) y la media de 30 días del histórico.
//
// Se mira: lo puro con la respuesta DE SU DOCUMENTACIÓN pegada tal cual (la
// 501: el fixture es la respuesta); la función y sus tres frenos (menos de
// 20 €, guardado una semana, tope diario) y que guarda también «no hay
// ventas»; el histórico pide y guarda la media con respaldo si la base no la
// tiene; la gráfica la ofrece apagada; la ficha (Mi colección) y /carta las
// piden solo al ABRIR «Gradeadas»; y la migración contra PostgreSQL.
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const S = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const { urlVentasGradeadas, ventaDe, ventasDe, filasDeHistorial } = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)

// La respuesta de ejemplo de su documentación (tcggo-api-documentation-v1.json,
// GET /{game}/ebay-sold-offers), byte por byte.
const EJEMPLO = {"data": [{"ebay_item_id": "178313578193", "title": "2005 Pokemon EX Deoxys 107/107 Gold Star Holo Rayquaza BGS 9", "price": 59786.26, "currency": "GBP", "company": "BGS", "grade": "9", "image_url": "https://i.ebayimg.com/images/g/vy4AAeSw8vVqV84k/s-l500.webp", "url": "https://www.ebay.co.uk/itm/178313578193?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&epid=4043367353&itmmeta=01M2RDJQH2BAMGDTTAKKW84WHM&hash=item29845146d1:g:vy4AAeSw8vVqV84k&itmprp=enc%3AAQALAAABAGfYFPkwiKCW4ZNSs2u11xATBM5s1dew3Z0T0p5BXjYhdNPhv3QpJZF1GGxh3gc37ol08GM0PouC%2Bxt0Mx9KwIo7i2WIWdia%2B6o3S8WF8WfDMTKaGUOOKT00rnWlbMdObZOOA1uz3D1Cq2dnun9dy0hfTH0kq4HGoV7GBjYperycDpGbMsceLKhwVPqnFrkBx4og%2FfVE26YyrP1qpHS%2BPwP5ZQFhQmdLwa5K67f8ZENNJsUKnnqC0Uv9ySMtqSxoPtPB0rLjd9nI5ZWOpAEwRpA0sYA6ZrbZ5UoqlM8bs9mGReiJ9Qmik7QhWn6nbuvImF940hWTaRNB6Bl%2Fkn4X8jk%3D%7Ctkp%3ABk9SR4z7yo2WaA", "ended_at": "2026-09-13T22:00:00+00:00"}, {"ebay_item_id": "307177972781", "title": "2005 POKEMON EX DEOXYS GOLD STAR #107 RAYQUAZA-HOLO PSA 4", "price": 20551.53, "currency": "GBP", "company": "PSA", "grade": "4", "image_url": "https://i.ebayimg.com/images/g/u5sAAeSwaH5qoD4L/s-l500.webp", "url": "https://www.ebay.co.uk/itm/307177972781?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&itmmeta=01M2RDJQH26XBDVQ4Y2ESRNY62&hash=item47853be42d:g:u5sAAeSwaH5qoD4L&itmprp=enc%3AAQALAAAA4GfYFPkwiKCW4ZNSs2u11xCo0SH1hPHSzQ5D7G%2BPIcoryXBzLbexfCYt5kOstndVBk5L9YKRTL1ySg41VxjERc5eAxAMBWvZ5Nyukrow0H%2BDQ%2FFxeYevLUv9hiZiAZMk20Emjznzxtc5phImiyHSzBdRTfN5IMZpJLWWOtsr3fQ2WiiATgVAskeGODD%2BvPs27fUpWD9yoDsnTaDV1p5ihIwyNA3S3p8pfp0LIa%2F76GiJe73VddRi%2FD6wAfZ1hDvErqYhLSazLekajDfdvsiLY5pAWF2mXSAObVjhq4rZm0tM%7Ctkp%3ABk9SR4z7yo2WaA", "ended_at": "2026-09-13T22:00:00+00:00"}, {"ebay_item_id": "298636090566", "title": "2005 POKEMON EX DEOXYS GOLD STAR #107 RAYQUAZA-HOLO PSA 4", "price": 15320.23, "currency": "GBP", "company": "PSA", "grade": "4", "image_url": "https://i.ebayimg.com/images/g/hdQAAeSwhVlqlvKY/s-l500.webp", "url": "https://www.ebay.co.uk/itm/298636090566?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&epid=4043367353&itmmeta=01M2RDJQH3GCDS2V15646X7DEM&hash=item4588191cc6:g:hdQAAeSwhVlqlvKY&itmprp=enc%3AAQALAAAA4GfYFPkwiKCW4ZNSs2u11xChegHH96rdWswDgj6CM%2BE9RetdhflPYBlzc22VWJW0EcH%2Ffz%2BK2AzlPQfZ3hU3U%2BX6Rq0mT1kNSsgSU%2BL1dJOc7bjROz5FTadtSKl88GEZ9GnFgMrDaq5ot%2BCE8wDRVazc1yNSWWxU2ZZTVIjgvSn0OUxku43X5i22JLV06rCKqwXq7ssQnrKqNdb3MEDRE5fBcXmUdIWZR6cW1B6jCZcVYGPAJcpOF2BvIHLf%2FNU0nRzKTqaHO%2BMagy7br7XxgnGSRQQQdaxhUNkhe6F3r8A8%7Ctkp%3ABk9SR477yo2WaA", "ended_at": "2026-09-09T22:00:00+00:00"}, {"ebay_item_id": "800573905454", "title": "Pokemon 2005 EX Deoxys Rayquaza Gold Star Holo R #107  BGS 8.5 *SWIRL*", "price": 30715.19, "currency": "GBP", "company": "BGS", "grade": "8.5", "image_url": "https://i.ebayimg.com/images/g/5LcAAeSwbp5qkMz0/s-l500.webp", "url": "https://www.ebay.co.uk/itm/800573905454?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&itmmeta=01M2RDJQH362D8WTGVVE40T4QH&hash=itemba65ec5a2e:g:5LcAAeSwbp5qkMz0&itmprp=enc%3AAQALAAABAGfYFPkwiKCW4ZNSs2u11xDWxTQYcHN2gYD26TYhys8%2FEf4EnlEYauuhyHJF5FwHqnVeSmDBDg9Wzm4cmq7lKM0AR5GnDJ53CTxVAEmIZo%2FfckokgC0bih0C51eCOI2uvaF2sl%2FxbYIQxixozEdejE9eD%2BwMSxN5YlXvNuOqWyehbjYjt4W8rGa8t3DGWoDNT5V6izgmRHkOwrcUyZ7jK%2FcFM3HgJ2QtFrgAC2c99wlGgj0c2cHG%2BjDo2ZoxJFRNADwu4bsjH9nG3Mm5NorPHg1X9zYtgzknipnl6egPBiUNh41H2MjxOBG6zA2oPh0eupAwWHW5IBwMWuE5jIwJNU0%3D%7Ctkp%3ABk9SR477yo2WaA", "ended_at": "2026-09-04T22:00:00+00:00"}, {"ebay_item_id": "800568101302", "title": "POKEMON GOLD STAR RAYQUAZA HOLO 2005 EX DEOXYS PORTUGUESE #107 PSA 5", "price": 10163.66, "currency": "GBP", "company": "PSA", "grade": "5", "image_url": "https://i.ebayimg.com/images/g/FycAAeSw0yNqjBT0/s-l500.webp", "url": "https://www.ebay.co.uk/itm/800568101302?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&itmmeta=01M2RDJQH3S0DPB8F9Q8RFT3YJ&hash=itemba6593c9b6:g:FycAAeSw0yNqjBT0&itmprp=enc%3AAQALAAABAGfYFPkwiKCW4ZNSs2u11xDdv3XDSh28%2FEFo8Kou1xXiQUUM4Ymg4hl1VlahyeI5tQCpEu1njoRrlDJPxijYMYBfdGIFZANx%2B%2BNF4oF%2FrqXqAfrOmkiJbR5MBbb3Y%2FIggZMsjFTDvSQcg%2FhTbbM7NeZOfmLF%2BoSe0Vd0nTHSrBwEt8OVlDeJmE3z%2Fk%2F69jtL%2BS7%2F5xyA67TXuL2OzEifA3%2BBWOj1nuQE5ZZ6PuMyQjMqQZHD8fuRDypK5EjyK2UibHu7R%2BWBAwNCkGsnBrNaFgwYQ--mr%2F7bwofsuNljt36EhL9R7EChEbheZaLiWkRlL0UrWaSl0mEI%2FdbQbGz5PSY%3D%7Ctkp%3ABk9SR477yo2WaA", "ended_at": "2026-09-03T22:00:00+00:00"}, {"ebay_item_id": "800568179065", "title": "2005 Pokemon EX Deoxys Gold Star Rayquaza #107 Holo R BGS 9 *CHIP/KNICK*", "price": 44914.45, "currency": "GBP", "company": "BGS", "grade": "9", "image_url": "https://i.ebayimg.com/images/g/H8oAAeSwau1qjy8I/s-l500.webp", "url": "https://www.ebay.co.uk/itm/800568179065?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&itmmeta=01M2RDJQH34MCPPKA0BAVB1SX8&hash=itemba6594f979:g:H8oAAeSwau1qjy8I&itmprp=enc%3AAQALAAAA4GfYFPkwiKCW4ZNSs2u11xAsa3oXSTbYgeI6a2KtRwrOu8fDm5JsM1ECkVV%2BWUzynPLuV5ElNCNiOzI99jXR%2FV%2FTjCv1NxxE19iQYPeZTxiviE05E6e08ee3NxRY9%2FRvpS1vXjJ1nwlPK%2BXZPEGQvKhPXJPWrAPZL1v8jiuguZydCvi1mlSMYT%2BD29ho5%2BEpPdU9uXCJ2%2BFJ3W5m11zAeKP%2Fp7VXpj9N7rC3CdZ208g1yeNTcsuRWAJYB8TAlsitRamsQaKvqW1QNdS99oicJZQ1SH%2B%2BZ5NQgLnFW3mxwoRg%7Ctkp%3ABk9SR477yo2WaA", "ended_at": "2026-09-02T22:00:00+00:00"}, {"ebay_item_id": "800545801646", "title": "2005 Pokemon Gold Star EX Deoxys #107 Rayquaza Holo PSA 8 NM-MT", "price": 44914.43, "currency": "GBP", "company": "PSA", "grade": "8", "image_url": "https://i.ebayimg.com/images/g/10cAAeSwMk1qiGtI/s-l500.webp", "url": "https://www.ebay.co.uk/itm/800545801646?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&epid=4043367353&itmmeta=01M2RDJQH33BRFFS7TN5XJE2J1&hash=itemba643f85ae:g:10cAAeSwMk1qiGtI&itmprp=enc%3AAQALAAAA4GfYFPkwiKCW4ZNSs2u11xAs8KHfcdo4l6lc%2F3GrEESFPWv3X2K4X1Z00T5LntiTtfqoIqYGYlMHYWORjHCF9bRADD0CxPavVgDM8E92kKoK0cC9afOQP8HXRxKVrbmI1MaePywO86usAc43CosnlhzwbF4UHMqgusWXQOfkegX7X01sVFmw3mAjOoDWsptUcdKFAhL%2Bs1%2Bt7WVXURUIxBl0WXLYKsgMh1jF5aqiKhnoiA5N8hPmdZCMvd02lnezV3%2Fd7SlGD3qZwSUZitueM7jYn%2FjzpY8PzB%2F85saNbx32%7Ctkp%3ABk9SR477yo2WaA", "ended_at": "2026-08-31T22:00:00+00:00"}, {"ebay_item_id": "800529709472", "title": "2005 Pokemon Gold Star EX Deoxys #107 Rayquaza Holo PSA 1 PR", "price": 7921.68, "currency": "GBP", "company": "PSA", "grade": "1", "image_url": "https://i.ebayimg.com/images/g/WJoAAeSwmOBqhIgQ/s-l500.webp", "url": "https://www.ebay.co.uk/itm/800529709472?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&itmmeta=01M2RDJQH416N0310DEZV9YB8Q&hash=itemba6349f9a0:g:WJoAAeSwmOBqhIgQ&itmprp=enc%3AAQALAAABAGfYFPkwiKCW4ZNSs2u11xD97YPo7x4%2Fgd68S5EaiOKYEQkLU9ulSOopP6i54%2FPcbrQ6Nn5KKaj%2FDAid9iVmfMY4tKSqrk61sKQgC7BOQyr7kLVrFZXk%2F8WWiF8oPDGDpEKWB9azcwyEqSYEMWwfjiDM1fIpNo%2FNdxuKVxT%2BY2e%2Fgln8NvbcvCfSwSCpR6kdXeWXwGvRnCppEff0ZEIHpDI4JJy3y4K3bsoaTUktdseQe9qHB2AV2%2BcIYbULYvcS7pYSqsVMHQAYUya%2FBbNoCC1aiHlRgZhWeC5B9p6nh46CJqqnGghsqVK%2FWo%2FAm7d3msg4hvcBNcwGzqL9uh6ufuQ%3D%7Ctkp%3ABk9SR5D7yo2WaA", "ended_at": "2026-08-25T22:00:00+00:00"}, {"ebay_item_id": "307143847626", "title": "2005 POKEMON EX DEOXYS GOLD STAR #107 RAYQUAZA-HOLO BGS 7", "price": 18683.21, "currency": "GBP", "company": "BGS", "grade": "7", "image_url": "https://i.ebayimg.com/images/g/AhYAAeSwW6dqjF-r/s-l500.webp", "url": "https://www.ebay.co.uk/itm/307143847626?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&itmmeta=01M2RDJQH4PJDH4H2Z31KJQTTP&hash=item4783332eca:g:AhYAAeSwW6dqjF-r&itmprp=enc%3AAQALAAABAGfYFPkwiKCW4ZNSs2u11xAaMYPXQbVxh15I0QHDMfiCA%2FMCIDUOReqdZjSsIV2AghPlVYw7cfL1I1aaMLFPbxwcTaa2KO7tK8WjroxJ%2Bs3faE5sBabS%2F5%2BX--aUdG42t2N5F%2F8a4DuEGk3F7pnyHxo481ypgbUnwfHRHkpRXFKOptn2PanCJ4hVvkDoH0Hdv6G0r%2FngrBaOVg8FXxaSYDMKlVx%2B89%2FUVB3Lwbt2%2B0PmcTFGcF7SPAzXOhokFfWZRDY92zwaJf2gJjKh8iqwboSZCSjtJAgUUGg2%2FkL3X9jNWPlvmUYIhS5JozbBFnm84b1vgsG7ZfdajYvmN3qooE0%3D%7Ctkp%3ABk9SR5D7yo2WaA", "ended_at": "2026-08-24T22:00:00+00:00"}, {"ebay_item_id": "800466616797", "title": "2005 POKEMON RAYQUAZA GOLD STAR HOLO EX DEOXYS #107 PSA 1.5 *NEW CERT POP 16!!", "price": 9690.38, "currency": "GBP", "company": "PSA", "grade": "1.5", "image_url": "https://i.ebayimg.com/images/g/PnEAAeSw~oJqbaB-/s-l500.webp", "url": "https://www.ebay.co.uk/itm/800466616797?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&epid=4043367353&itmmeta=01M2RDJQH47H0VCBNZT9M85YMS&hash=itemba5f8741dd:g:PnEAAeSw~oJqbaB-&itmprp=enc%3AAQALAAAA4GfYFPkwiKCW4ZNSs2u11xAWlbooPOjGTwm0O9v%2BwM1f6zowEHf11tMTfcv0kHV7knxhgrJHN0D0%2FAYOmKgpwu3Zy%2FpdlYoXHvgKYpgl2mQGZ1mDzfwiyxRRK2zaHEN1TggPzHjW2ykZ7J%2BUlQqcXcGlRxPqasaquzi5EK5t4Hb6FIDsAMqUBs3nqwE3XCVxKOqxT9A7Ttxc2mF%2F7uP2rFDDLq2VIthrFFHAvbcMkKAz8KRHlgJesRBn7J23A9fasypzx6DRLxl6I4qXr%2FVh5XbaAbTkyNHUcEXg3xRmEu7M%7Ctkp%3ABk9SR5L7yo2WaA", "ended_at": "2026-08-12T22:00:00+00:00"}, {"ebay_item_id": "117324378277", "title": "2005 POKEMON EX DEOXYS GOLD STAR #107 RAYQUAZA-HOLO PSA 4", "price": 12256.18, "currency": "GBP", "company": "PSA", "grade": "4", "image_url": "https://i.ebayimg.com/images/g/3XMAAeSw2OhqZxMJ/s-l500.webp", "url": "https://www.ebay.co.uk/itm/117324378277?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&epid=4043367353&itmmeta=01M2RDJQH57P001V18Y8TXA41C&hash=item1b5113f0a5:g:3XMAAeSw2OhqZxMJ&itmprp=enc%3AAQALAAAA4GfYFPkwiKCW4ZNSs2u11xDyjCxM6iWuMrJlwmsXPAZepDD6p78Hl9gA09QXTqfkt8EOFTmPpGw74Vyyo1tvXVoLT9A%2ByQIqrL47J%2FE%2BDv2QlBSynu%2FvLW%2B6y%2FJs7x2vO0XX01lYT9xc27ZOWfrBnm5RYJchF8tv3mrvLvThw6XFPeVI3xhTbqmIDuQivhJdrc3Qw00zYLc8GRnG8v9QEL21GPXd%2BgYHFyA9Pn4kR03hg1CcfFXV3BnO%2BkAT%2FPBgJzAxCBOtaJTSTOHkvHbVYDneSB76D%2BpgBQ16RcjdqyiI%7Ctkp%3ABk9SR5L7yo2WaA", "ended_at": "2026-08-09T22:00:00+00:00"}, {"ebay_item_id": "336690196843", "title": "2005 POKEMON EX DEOXYS GOLD STAR #107 RAYQUAZA-HOLO PSA 7 (NEW 16 CERT)", "price": 37358.94, "currency": "GBP", "company": "PSA", "grade": "7", "image_url": "https://i.ebayimg.com/images/g/wqAAAeSwlktqV73h/s-l500.webp", "url": "https://www.ebay.co.uk/itm/336690196843?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&epid=4043367353&itmmeta=01M2RDJQH45BF76WJ5JWZ2P8H4&hash=item4e644cb16b:g:wqAAAeSwlktqV73h&itmprp=enc%3AAQALAAABAGfYFPkwiKCW4ZNSs2u11xCtAV3IvA7APtGCW9v36M0y5aUn83qBGwu%2F%2BEzB5nRGFkTud2VgYWiKY6Lte6F6Slt5uIOfz9EYPRpe5KJuD9iNQ6z2Ty5gTeNAe%2BM%2F4%2FOE%2FXvUuaApueLREubpxS0aM8OwI4dwD6Gft6X6XRQchY8MTyhWnvC7KAMwoTnWZnxKGOovpNRxFwt4dHvge9xMN0hH17Ii3EEvsrVNl7UGKEWQB7GbtLq5o34gcwsJsPPCu0ud%2BPl%2BjMzB07A0nsBqo9Pyg%2F5WipPlgxvj3YAiyCNduzvM%2FD6Dxum2zalfXmzKQ0PQBsqvWY1Dk947PI8iZUg%3D%7Ctkp%3ABk9SR5D7yo2WaA", "ended_at": "2026-08-06T22:00:00+00:00"}, {"ebay_item_id": "318639397291", "title": "Pokemon Graded: Rayquaza Gold Star 107/107 EX Deoxys (2005) PSA 1", "price": 11172.55, "currency": "GBP", "company": "PSA", "grade": "1", "image_url": "https://i.ebayimg.com/images/g/cqgAAeSwYexqYnoB/s-l500.webp", "url": "https://www.ebay.co.uk/itm/318639397291?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&epid=4043367353&itmmeta=01M2RDJQH5JG7FRK1M3ZXNHHNM&hash=item4a306359ab:g:cqgAAeSwYexqYnoB&itmprp=enc%3AAQALAAABAGfYFPkwiKCW4ZNSs2u11xCItxFlajCpo%2Bijxcs%2BUyMGRdSLi4IIhlhsIjaFiD2mztosD1%2F4Gb5rR0uXtPRjH3rFV8WRv%2FlkzcVCLN4kGc%2BX8PnJO7gGP5JBg2wH9nZHmhKfJcz9l0S4qrqcDAwgTt99sAzQ%2B%2BVsKWQsemhwM1857J%2BpHGVJGjThik2WNN7PlnTx7qM05uIo%2Bf2e9SLtNwHYOsUmg0JMiBhLM0fZ1imo1NZFy2N5oGGwOAwiNs9QZo4zQVVxybkmt%2FZqAAb9NDlOTObN7qJjoZ1R0mRnqxyM3Xuc8wHg7ZzhnvRfquksNR5DMofVaQfMOO91YbY6HTU%3D%7Ctkp%3ABk9SR5L7yo2WaA", "ended_at": "2026-08-02T22:00:00+00:00"}, {"ebay_item_id": "307084080290", "title": "2005 POKEMON EX DEOXYS GOLD STAR #107 RAYQUAZA-HOLO PSA 7", "price": 28772.14, "currency": "GBP", "company": "PSA", "grade": "7", "image_url": "https://i.ebayimg.com/images/g/l5UAAeSwNRxqY9pz/s-l500.webp", "url": "https://www.ebay.co.uk/itm/307084080290?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&epid=4043367353&itmmeta=01M2RDJQH5NF9B3R0Y4P1X4VV4&hash=item477fa334a2:g:l5UAAeSwNRxqY9pz&itmprp=enc%3AAQALAAABAGfYFPkwiKCW4ZNSs2u11xBrZR7KHJO7j4C%2FRphkfEZFdKGs%2FThl%2B4tCY6oUUosfXchDHWmds6wzebE6Sn8jytLE0PaHdTmorcYCLC5236vtVpq5lw1Qix263NGcBarcA1%2BAR19IkDsGqEr4LbxsbXnx%2Frq9oMssGVI3HEnrBpJT0BQZiLHs7sSIUZrUdeVaD%2BUHdYHKrxEQNR3NE%2FGdRS%2BcgwhkbUhV84ngPeUjP2ZYVA5D8%2FOx03pGwkuqfUWoqQTVkL8akYFqipgoOuxiV1W%2FwpT6krblOyRiP%2Fb5pc%2F8k95Y102S5jH401KErcr8cLHnpP9DwW2wmzlPuCTCaOs%3D%7Ctkp%3ABk9SR5T7yo2WaA", "ended_at": "2026-07-24T22:00:00+00:00"}, {"ebay_item_id": "800347318779", "title": "Pokemon 2005 EX Deoxys Rayquaza Gold Star Holo R #107 BGS 8.5", "price": 28099.54, "currency": "GBP", "company": "BGS", "grade": "8.5", "image_url": "https://i.ebayimg.com/images/g/~00AAeSwT55qVm4Y/s-l500.webp", "url": "https://www.ebay.co.uk/itm/800347318779?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&itmmeta=01M2RDJQH6QQG5F6PCY9S8Z9AT&hash=itemba586ae9fb:g:~00AAeSwT55qVm4Y&itmprp=enc%3AAQALAAAA4GfYFPkwiKCW4ZNSs2u11xA9FG70PNI9g9xmCVDAg7B63hGWOqd%2Fu%2FuyiNG%2B2qc7Cy26FVPRxkixQ4HlEvACziRKYVOkNcV8%2FUzqtxFzxytNYCaJXJKv5FqRkcDWpXU1jKyoN7KHQevuUWOYcSu%2FVb76SEMKsGVrcOWueeFWrTnHqx0txPOOOFNS3uzYy1tkGGbO9DHu0j%2FZL1L%2Fct8giZsUCPOcB6I2XNyMk%2Ble048iSluM0qu9Lk7owy16QHCgajWQYBqHjGpFmtQ8vK%2FKewQq3Nla9AxmQGOaJx2TqhiR%7Ctkp%3ABk9SR5T7yo2WaA", "ended_at": "2026-07-22T22:00:00+00:00"}, {"ebay_item_id": "307063775447", "title": "2005 POKEMON EX DEOXYS GOLD STAR #107 RAYQUAZA-HOLO PSA 6", "price": 19056.87, "currency": "GBP", "company": "PSA", "grade": "6", "image_url": "https://i.ebayimg.com/images/g/H1kAAeSwRTtqVv9d/s-l500.webp", "url": "https://www.ebay.co.uk/itm/307063775447?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&epid=4043367353&itmmeta=01M2RDJQH5CGJW816VAP552FV6&hash=item477e6d60d7:g:H1kAAeSwRTtqVv9d&itmprp=enc%3AAQALAAABAGfYFPkwiKCW4ZNSs2u11xB%2FkN5ehmdCCTM1CPvnKspld0OIyVyTxxlhsL3oTKvhVkJ%2BA8n0%2FeYn4X2k8qAbXm6eq5WD9YR5eseBxy7nATIX1j8cCzyAExOD8Vd5HBDs%2Buf6697Tc0AJ%2F41HhxoUkngwvx0DZC%2BxlikUdqmdvIy9wFkPjlA3c%2FMzB61ihTDYkCSCUnrfg0FNL6oXeizWa2cc08h9WRcaLtZMzfP0XEkm8BSqtGlh5VptzxzrGO4QTzueiAZvMifMQZzYm6hei0BnouYK84Mwmdt9jp43I4SbzuqTR68qgi9u8e0tKyca8AFaGfO%2B6JhwKup%2F5DQoqME%3D%7Ctkp%3ABk9SR5T7yo2WaA", "ended_at": "2026-07-22T22:00:00+00:00"}, {"ebay_item_id": "117313712277", "title": "2005 POKEMON EX DEOXYS GOLD STAR #107 RAYQUAZA-HOLO PSA 5", "price": 13676.11, "currency": "GBP", "company": "PSA", "grade": "5", "image_url": "https://i.ebayimg.com/images/g/-DYAAeSw371qWWRF/s-l500.webp", "url": "https://www.ebay.co.uk/itm/117313712277?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&itmmeta=01M2RDJQH6BY2J3WMKV2TR78P4&hash=item1b50713095:g:-DYAAeSw371qWWRF&itmprp=enc%3AAQALAAAA4GfYFPkwiKCW4ZNSs2u11xCNQSPWzAjaqkQg1RXC7WGoWxgDGz28OqpMtZ%2B36zf2bNDU4eEJ9Cx9uan1G9cSFpN1fdEFcjyluTkT2U3m2fSYbgvkNYTD2N0GtOFaV42X23slfJmUF2gJpODWOnriHGeU01MYNRTqZ%2FXeIQwTa1pSJzxeNYObiPTQDcjb%2FfMW4GVwwk4Qf2yjSyramSM3lo5oardc4m4mYypE7mALvNg64%2B3giztpi5YSUwmZisJLHoKkf%2FsRNh90wXDbb0%2FMnghBIwmQLTWgdpLopSDTYy%2Bn%7Ctkp%3ABk9SR5T7yo2WaA", "ended_at": "2026-07-20T22:00:00+00:00"}, {"ebay_item_id": "117293589973", "title": "2005 POKEMON EX DEOXYS GOLD STAR #107 RAYQUAZA-HOLO PSA 5", "price": 13152.98, "currency": "GBP", "company": "PSA", "grade": "5", "image_url": "https://i.ebayimg.com/images/g/LXgAAeSwjF1qT7w-/s-l500.webp", "url": "https://www.ebay.co.uk/itm/117293589973?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&epid=4043367353&itmmeta=01M2RDJQH6XAW9G4TK1CR41C3H&hash=item1b4f3e25d5:g:LXgAAeSwjF1qT7w-&itmprp=enc%3AAQALAAAA4GfYFPkwiKCW4ZNSs2u11xBbnnedDE4ut6IYfGvxjFFDEpGXlrsiZFcIIAXibBRbg28pDNPDE6PqASlz%2FohnMEeokyZMusf3T9DPfLoGIJZIn4CzbCZ3E4vVLPS3OCWHPv8y18nbLwUhlAx14gbUBlAoKVE9lFAgC9MT0ZPpiQnmWd2dzooqAEKrtEMftY4j%2FpjJqBG1pk2PcJRv%2FdNwdgxV4lArDswm5ztOTuPkuzyaPwaZ5TU4ywlyY6Sro8qYk2Ke3gWqhf2n8vy0zztZZyqenAlsIiabSiXamekfxfhl%7Ctkp%3ABk9SR5T7yo2WaA", "ended_at": "2026-07-19T22:00:00+00:00"}, {"ebay_item_id": "158061669688", "title": "Pokemon Rayquaza Gold Star Ex Deoxys 107/107 PSA 9", "price": 85939.02, "currency": "GBP", "company": "PSA", "grade": "9", "image_url": "https://i.ebayimg.com/images/g/ckEAAeSwP3hqTEgP/s-l500.webp", "url": "https://www.ebay.co.uk/itm/158061669688?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&epid=4043367353&itmmeta=01M2RDJQH65BMXX8136EYHK0J7&hash=item24cd35ad38:g:ckEAAeSwP3hqTEgP&itmprp=enc%3AAQALAAABAGfYFPkwiKCW4ZNSs2u11xBxpVaPs%2FoJZtTArYoDn4WEt1XuNu0JHS5jnyDoUyGfyC9tspc1BzdgeI6686OCesO3sBhTwkX9CyvqTVs5H%2FqCXl7RUBUseN8xQLQSScNz1CtiT%2B91dGdjuUi4fCCpoR394%2Fg%2Bt9cIxtvlXYwD%2FuANNJzSLljzCo5mWxg72B1CadWOSI6VPs5ao3g6i41dw9eklRosgaevYHX6hVELMbMcMB4Vfg9hs%2FKbJwfYe3aWQ36ByNYoSUXO7h%2BI4gySTL50RpBIXN2SyVR9Wld17OL%2Fi4wZ7OYJfSJZ7edGuBdGQQhLxYLmFfDCzls1UsH7YPQ%3D%7Ctkp%3ABk9SR5T7yo2WaA", "ended_at": "2026-07-18T22:00:00+00:00"}, {"ebay_item_id": "366525965698", "title": "2005 Pokemon Gold Star EX Deoxys #107 Rayquaza Holo PSA 6 EX-MT", "price": 19131.6, "currency": "GBP", "company": "PSA", "grade": "6", "image_url": "https://i.ebayimg.com/images/g/o8gAAeSw4E1qS8Wo/s-l500.webp", "url": "https://www.ebay.co.uk/itm/366525965698?_skw=Rayquaza+%E2%98%85+107+EX+Deoxys+graded&epid=4043367353&itmmeta=01M2RDJQH68NMK5EZGRVANAZPR&hash=item5556a66582:g:o8gAAeSw4E1qS8Wo&itmprp=enc%3AAQALAAAA4GfYFPkwiKCW4ZNSs2u11xA0jT6hi%2FfYYmeJRbQzMEJXNGX0yrhwCCaTCRFjhmz2KpcIbSL4bGg9vKzT7iz0j1y%2BHpAXLxbdVVbvUN7te7FsPjJNNRO1zVZYeDlqdjZ9aFhrzQctjmvQI8heYkWfT0twq9r4%2B%2FGUnr5PnR3uSTT44FOo4lF8TOvRFuuS84wzOMfxluBOpW9YnGS6Tclp3llli6sneNIHE7TBscAGr6GH9pnEjgyRmzfisC%2BePg2%2FGlMQBhRR0RH8in7CBLon6nr5%2FUcBK1HKKqlGadvJFxk7%7Ctkp%3ABk9SR5T7yo2WaA", "ended_at": "2026-07-13T22:00:00+00:00"}], "paging": {"current": 1, "total": 9, "per_page": 20}, "results": 169}

console.log('── 1. Lo puro, con su respuesta de ejemplo ──')
{
  const v = ventasDe(EJEMPLO)
  check('las 20 ventas de su ejemplo se entienden', v.length === 20, v.length)
  check('  …la más nueva primero', v[0].fecha >= v[v.length - 1].fecha, `${v[0].fecha} / ${v[v.length - 1].fecha}`)
  const bgs = v.find((x) => x.casa === 'BGS' && x.nota === '8.5')
  check('una nota con medio punto (BGS 8.5) entra', !!bgs, JSON.stringify(v.map((x) => x.casa + x.nota)))
  check('  …con su moneda (su ejemplo es en libras: sin `currency=EUR` no se convierte)', v[0].moneda === 'GBP', v[0].moneda)
  check('el enlace queda en el anuncio, sin su rastreo', v.every((x) => !x.enlace || /^https:\/\/www\.ebay\.[a-z.]+\/itm\/\d+$/.test(x.enlace)), v[0].enlace)
  check('una venta sin casa conocida, sin precio o sin fecha no entra', ventaDe({ company: 'XYZ', grade: '9', price: 10, ended_at: '2026-11-01' }) === null && ventaDe({ company: 'PSA', grade: '9', price: 0, ended_at: '2026-11-01' }) === null && ventaDe({ company: 'PSA', grade: '9', price: 5 }) === null)
  check('un enlace que no es de eBay no se guarda', ventaDe({ company: 'PSA', grade: '10', price: 5, ended_at: '2026-11-01', url: 'https://malo.example/itm/1' }).enlace === null)
  check('la dirección pide 30, en euros, por NUESTRO tcggo_id', urlVentasGradeadas({ tcggoId: 81898 }, 'B') === 'B/ebay-sold-offers?id=81898&per_page=30&currency=EUR')
  check('  …y sin él, por el id de Cardmarket; sin ninguno, nada', urlVentasGradeadas({ idProduct: 918982 }, 'B') === 'B/ebay-sold-offers?cardmarket_id=918982&per_page=30&currency=EUR' && urlVentasGradeadas({}, 'B') === null)
  const h = filasDeHistorial('c1', { data: { '2026-10-25': { cm_low: 0.03, avg30: 0.12, tcg_player_market: 0.15 } } })
  check('el histórico guarda la media de 30 días (`avg30`)', h[0]?.cm_avg30 === 0.12, JSON.stringify(h))
}

console.log('\n── 2. La función: frenos y guardado ──')
{
  const { procesar, CLAVE_ESTADO } = await import(`${RAIZ}/netlify/functions/tcggo-ventas-gradeadas.mjs`)
  const AHORA = new Date('2026-11-15T10:00:00Z')
  const montar = ({ guardada = null, precio = { cm_low: 250, cm_avg30: 280 }, carta = { id: 'dlr-138', market: 'WEST', tcggo_id: 81898, cm_id_product_propio: 918982 }, estado = {}, respuesta = EJEMPLO, status = 200, sinTabla = false } = {}) => {
    const urls = []
    const escritas = []
    let est = JSON.parse(JSON.stringify(estado))
    const b = {
      env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k' },
      ahora: AHORA,
      cardId: 'dlr-138',
      fetchImpl: async (url) => { urls.push(url); return { ok: status === 200, status, text: async () => JSON.stringify(respuesta) } },
      restImpl: async (ruta, o = null) => {
        if (o?.method === 'POST') { escritas.push({ ruta, cuerpo: JSON.parse(o.body) }); return null }
        if (ruta.startsWith('tcg_card_ventas_gradeadas')) { if (sinTabla) throw new Error('Supabase 404: {"code":"PGRST205","message":"Could not find the table public.tcg_card_ventas_gradeadas"}'); return guardada ? [guardada] : [] }
        if (ruta.startsWith('tcg_cards')) return carta ? [carta] : []
        if (ruta.startsWith('tcg_card_prices')) return precio ? [precio] : []
        throw new Error(`ruta inesperada ${ruta}`)
      },
      estadoImpl: async () => est,
      guardarEstadoImpl: async (v) => { est = JSON.parse(JSON.stringify(v)) },
    }
    return { b, urls, escritas, estado: () => est }
  }
  {
    const m = montar()
    const r = await procesar(m.b)
    check('una carta de 250 € sin nada guardado se pide UNA vez', r.estado === 200 && r.cuerpo.pedido === true && m.urls.length === 1 && /ebay-sold-offers\?id=81898&per_page=30&currency=EUR/.test(m.urls[0]), JSON.stringify(m.urls))
    check('  …y se guarda con su día', m.escritas.length === 1 && m.escritas[0].ruta === 'tcg_card_ventas_gradeadas' && m.escritas[0].cuerpo[0].ventas.length === 20 && m.escritas[0].cuerpo[0].pedido_at === AHORA.toISOString(), JSON.stringify(m.escritas).slice(0, 200))
    check('  …contando la petición en el estado', m.estado().peticiones === 1 && m.estado().dia === '2026-11-15', JSON.stringify(m.estado()))
  }
  {
    const m = montar({ guardada: { ventas: [{ casa: 'PSA', nota: '10', precio: 398, moneda: 'EUR', fecha: '2026-11-13T22:00:00.000Z' }], pedido_at: '2026-11-12T10:00:00Z' } })
    const r = await procesar(m.b)
    check('pedida hace 3 días: se sirve lo guardado, sin pagar', m.urls.length === 0 && r.cuerpo.ventas.length === 1 && r.cuerpo.pedido === false, JSON.stringify(r.cuerpo).slice(0, 160))
  }
  {
    const m = montar({ guardada: { ventas: [], pedido_at: '2026-10-01T10:00:00Z' } })
    await procesar(m.b)
    check('pedida hace más de una semana: se vuelve a pedir', m.urls.length === 1)
  }
  {
    const m = montar({ precio: { cm_low: 4, cm_avg30: 6 } })
    const r = await procesar(m.b)
    check('una carta de menos de 20 € no se pide', m.urls.length === 0 && /menos de 20/.test(r.cuerpo.porque), r.cuerpo.porque)
    const m2 = montar({ precio: { cm_low: 12, cm_avg30: 21 } })
    await procesar(m2.b)
    check('  …pero si su media de 30 días pasa de 20 €, sí', m2.urls.length === 1)
  }
  {
    const m = montar({ estado: { dia: '2026-11-15', peticiones: 400 } })
    const r = await procesar(m.b)
    check('con el tope diario gastado no se pide', m.urls.length === 0 && /tope diario/.test(r.cuerpo.porque), r.cuerpo.porque)
  }
  {
    const m = montar({ respuesta: { data: [], paging: { current: 1, total: 1 } } })
    const r = await procesar(m.b)
    check('«no hay ventas» también se guarda (si no, se pagaría en cada visita)', m.escritas.length === 1 && m.escritas[0].cuerpo[0].ventas.length === 0 && r.cuerpo.pedido === true)
  }
  {
    const m = montar({ status: 429, respuesta: { message: 'You have exceeded the DAILY quota' } })
    const r = await procesar(m.b)
    check('un fallo de TCGGO se apunta en el estado (para /admin) y no guarda nada', m.escritas.length === 0 && m.estado().ultimoError?.fecha && r.cuerpo.pedido === true, JSON.stringify(m.estado()))
  }
  {
    const m = montar({ sinTabla: true })
    const r = await procesar(m.b)
    check('sin la migración, contesta vacío y lo dice (no gasta)', m.urls.length === 0 && /1364/.test(r.cuerpo.porque) && r.estado === 200, r.cuerpo.porque)
  }
  {
    const m = montar({ carta: { id: 'dlr-138', market: 'JP', tcggo_id: 5000, cm_id_product_propio: null } })
    await procesar(m.b)
    check('una carta japonesa se pide al catálogo japonés', /\/pokemon-jp\/ebay-sold-offers\?id=5000/.test(m.urls[0] || ''), m.urls[0])
  }
  check('/admin la lee (semáforo)', /\['tcggo_ventas_gradeadas', /.test(readFileSync(`${RAIZ}/admin/js/semaforo.js`, 'utf8')) && CLAVE_ESTADO === 'tcggo_ventas_gradeadas')
}

console.log('\n── 3. El histórico: la media, con respaldo si la base no la tiene ──')
{
  const { procesar } = await import(`${RAIZ}/netlify/functions/tcggo-historial.mjs`)
  const pedidas = []
  const guardados = []
  const r = await procesar({
    env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k' },
    cardId: 'c1',
    ahora: new Date('2026-11-15T10:00:00Z'),
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: { '2026-11-14': { cm_low: 5, avg30: 6, tcg_player_market: 7 }, '2026-11-13': { cm_low: 4, avg30: 6 } } }) }),
    restImpl: async (ruta, o = null) => {
      pedidas.push(ruta)
      if (o?.method === 'PATCH') return null
      if (ruta.startsWith('tcg_card_history')) { if (/cm_avg30/.test(ruta)) throw new Error('Supabase 400: {"code":"42703","message":"column tcg_card_history.cm_avg30 does not exist"}'); return [] }
      if (ruta.startsWith('tcg_cards')) return [{ id: 'c1', cm_id_product_propio: 123 }]
      if (ruta.startsWith('tcg_card_prices')) return [{ historial_at: null }]
      throw new Error(`ruta inesperada ${ruta}`)
    },
    guardarImpl: async (filas) => { guardados.push(filas); if (filas.some((f) => 'cm_avg30' in f)) throw new Error('Supabase 400: {"code":"PGRST204","message":"Could not find the \'cm_avg30\' column of \'tcg_card_history\'"}'); return null },
    estadoImpl: async () => ({}),
    guardarEstadoImpl: async () => {},
  })
  check('sin la columna, la consulta se repite sin ella (no se queda en blanco)', pedidas.filter((p) => p.startsWith('tcg_card_history')).length === 2 && r.estado === 200, JSON.stringify(pedidas))
  check('  …y lo nuevo se guarda sin la media al segundo intento', guardados.length === 2 && !('cm_avg30' in guardados[1][0]) && r.cuerpo.nuevas === 2, JSON.stringify(guardados).slice(0, 200))
  const { seriesDisponibles } = await import(`${RAIZ}/js/carta-historial.js`)
  const filas = [{ dia: '2026-11-13', cm_low: 4, cm_low_es: 5, cm_avg30: 6 }, { dia: '2026-11-14', cm_low: 5, cm_low_es: 6, cm_avg30: 6 }]
  check('la gráfica ofrece «Media de 30 días»', seriesDisponibles(filas, 'es').includes('m30'), JSON.stringify(seriesDisponibles(filas, 'es')))
  const src = readFileSync(`${RAIZ}/js/carta-historial.js`, 'utf8')
  check('  …apagada de serie, como TCGplayer', /hay\.filter\(\(id\) => id !== 'tp' && id !== 'm30'\)/.test(src))
}

console.log('\n── 4. La migración, contra PostgreSQL ──')
{
  const PG = { ...process.env, PGUSER: 'postgres', PGHOST: '/var/tmp', PGPORT: '5433' }
  const DB = 'p1364'
  const psql = (sql, rol = null) => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-d', DB, '-c', rol ? `set role ${rol}; ${sql}` : sql], { env: PG, encoding: 'utf8' }).trim()
  execFileSync('psql', ['-X', '-q', '-d', 'postgres', '-c', `drop database if exists ${DB}`, '-c', `create database ${DB}`], { env: PG, encoding: 'utf8' })
  const esquema = readFileSync(`${RAIZ}/supabase-esquema-actual.sql`, 'utf8')
  const i = esquema.indexOf('CREATE TABLE public.tcg_card_history (')
  psql("do $$ begin if not exists (select from pg_roles where rolname='anon') then create role anon; end if; if not exists (select from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$; grant usage on schema public to anon, authenticated;")
  psql(esquema.slice(i, esquema.indexOf('\n);', i) + 3))
  const f = `${S}/m1364.sql`
  writeFileSync(f, readFileSync(`${RAIZ}/supabase-migration-1364-ventas-gradeadas.sql`, 'utf8'))
  const correr = () => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', DB, '-f', f], { env: PG, encoding: 'utf8' })
  let bien = true
  try { correr() } catch (e) { bien = false; console.log(String(e.stderr || e.message).slice(0, 300)) }
  check('la migración entra', bien)
  psql(`insert into public.tcg_card_history (card_id, dia, cm_low, cm_avg30) values ('c1', '2026-11-14', 5, 6.5)`)
  check('el histórico guarda la media', psql("select cm_avg30 from public.tcg_card_history where card_id='c1'") === '6.50')
  psql(`insert into public.tcg_card_ventas_gradeadas (card_id, ventas) values ('dlr-138', '[{"casa":"PSA"}]'::jsonb)`)
  check('una fila de ventas: occidental de serie y con su día', psql("select market||'|'||(pedido_at is not null) from public.tcg_card_ventas_gradeadas") === 'WEST|true')
  let noLista = false
  try { psql(`insert into public.tcg_card_ventas_gradeadas (card_id, ventas) values ('x', '{}'::jsonb)`) } catch { noLista = true }
  check('  …y `ventas` tiene que ser una lista', noLista)
  for (const rol of ['anon', 'authenticated']) {
    let cerrado = false
    try { psql('select count(*) from public.tcg_card_ventas_gradeadas', rol) } catch { cerrado = true }
    check(`${rol} no la puede leer (solo la función, con la clave de servicio)`, cerrado)
  }
  let dos = true
  try { correr() } catch { dos = false }
  check('se puede ejecutar dos veces', dos)
  execFileSync('psql', ['-X', '-q', '-d', 'postgres', '-c', `drop database if exists ${DB}`], { env: PG })
}

console.log('\n── 5. La ficha: solo al abrir «Gradeadas» ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was skipped/.test(String(e))) errores.push(String(e).slice(0, 180)) })
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', card_count_official: 160, card_count_total: 164, logo_path: null, tcg_online_code: 'PRC' }]
    window.__FAKE_CARTAS__ = [{ id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true }, cm_id_product_propio: 273681 }]
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-01T10:00:00Z' }]
    window.__FAKE_PRECIOS__ = [{ card_id: 'xy5-150', cm_id_product: 273681, cm_low: 139, cm_low_es: 140, cm_gradeadas: { psa: { psa10: 2621, psa9: 184 } }, ebay_gradeadas: { bgs: { 10: { median_price: 3500, sample_size: 3 } } }, tcggo_updated: '2026-11-14T12:00:00Z', origen: 'tcggo' }]
  })
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.route('**api.tcgdex.net/**', (r) => r.abort())
  await page.route('**images.tcggo.com/**', (r) => r.abort())
  const pedidas = []
  const ventas = [
    { casa: 'PSA', nota: '10', precio: 2480, moneda: 'EUR', fecha: '2026-11-13T22:00:00.000Z', titulo: 'Groudon EX 150/160 Primal Clash PSA 10 GEM MINT', enlace: 'https://www.ebay.es/itm/1' },
    { casa: 'BGS', nota: '9.5', precio: 1310, moneda: 'EUR', fecha: '2026-11-10T22:00:00.000Z', titulo: 'Pokemon Groudon EX Full Art BGS 9.5', enlace: 'https://www.ebay.de/itm/2' },
    ...Array.from({ length: 6 }, (_, k) => ({ casa: 'PSA', nota: '9', precio: 180 + k, moneda: 'EUR', fecha: `2026-10-${String(20 - k).padStart(2, '0')}T22:00:00.000Z`, titulo: `Groudon EX PSA 9 <b>${k}</b>`, enlace: null })),
  ]
  await page.route('**/.netlify/functions/tcggo-ventas-gradeadas**', (r) => { pedidas.push(r.request().url()); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ventas, pedido: true, pedidoAt: '2026-11-15T10:00:00Z' }) }) })
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.locator('.mc-carta-foto').filter({ hasText: 'Groudon' }).first().click()
  await page.waitForTimeout(900)
  const bloque = page.locator('#mcEdPrecioBloque')
  check('al abrir la ficha NO se piden las ventas', pedidas.length === 0, JSON.stringify(pedidas))
  await bloque.locator('.pv-gradeadas-cab').click()
  await page.waitForTimeout(700)
  check('al abrir «Gradeadas», sí, de ESA carta', pedidas.length === 1 && /card=xy5-150/.test(pedidas[0]), JSON.stringify(pedidas))
  const filas = await bloque.locator('.pv-ventas .pv-venta').allInnerTexts()
  check('se ven las seis primeras, la más nueva arriba', filas.length === 6 && /PSA 10/.test(filas[0]) && /2\.480/.test(filas[0]), filas.map(limpio).join(' | ').slice(0, 300))
  check('  …con su enlace al anuncio, en otra pestaña', (await bloque.locator('.pv-ventas a.pv-venta').first().getAttribute('href')) === 'https://www.ebay.es/itm/1' && (await bloque.locator('.pv-ventas a.pv-venta').first().getAttribute('target')) === '_blank')
  check('  …y el título va como texto (nada de HTML ajeno)', (await bloque.locator('.pv-ventas .pv-venta-titulo b').count()) === 0 && /<b>/.test(await bloque.locator('.pv-ventas').innerText()))
  await bloque.locator('[data-casa-filtro="BGS"]').click()
  check('el chip BGS deja solo las de BGS', limpio(await bloque.locator('.pv-ventas .pv-venta').allInnerTexts().then((x) => x.join('|'))).includes('BGS 9.5') && (await bloque.locator('.pv-ventas .pv-venta').count()) === 1)
  await bloque.locator('[data-casa-filtro=""]').click()
  await bloque.locator('[data-ventas-todas]').click()
  check('«Ver las 8 ventas» las enseña todas', (await bloque.locator('.pv-ventas .pv-venta').count()) === 8)
  await bloque.locator('.pv-gradeadas-cab').click()
  await bloque.locator('.pv-gradeadas-cab').click()
  await page.waitForTimeout(300)
  check('cerrar y volver a abrir no las pide otra vez', pedidas.length === 1, pedidas.length)
  await page.screenshot({ path: `${S}/cap1364/ficha-pc.png`, clip: { x: 0, y: 0, width: 1200, height: 1000 } }).catch(() => {})
  check('sin errores en la página', errores.length === 0, errores.join(' | '))
  await browser.close()
}

console.log(fails ? `\n${fails} FALLAN` : '\nTodo bien')
process.exit(fails ? 1 : 0)
