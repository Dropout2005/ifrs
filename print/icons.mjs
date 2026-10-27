import fs from 'fs'
const map = { DROP: 'droplets', SHIELD: 'shield-check', WAVES: 'waves-horizontal', SIREN: 'siren', PIN: 'map-pin', USERS: 'users', GIFT: 'gift', MAP: 'map', COINS: 'hand-coins', CPU: 'cpu' }
let html = fs.readFileSync('handout.html', 'utf8')
for (const [k, name] of Object.entries(map)) {
  const src = fs.readFileSync(`/home/claude/ifrs/node_modules/lucide-react/dist/esm/icons/${name}.mjs`, 'utf8')
  const a = src.indexOf('= {', src.indexOf('__iconData')) + 2
  const node = new Function('return ' + src.slice(a, src.indexOf('\n};', a) + 2))().node
  const inner = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([x]) => x !== 'key').map(([x, v]) => `${x}="${v}"`).join(' ')}/>`).join('')
  html = html.replaceAll(`ICON_${k}`, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`)
}
fs.writeFileSync('handout.built.html', html)
console.log(/ICON_/.test(html) ? 'MISSING icons' : 'icons ok')
