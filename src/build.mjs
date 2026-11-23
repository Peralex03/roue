/* Assemble chaque app en un seul index.html autonome (styles, polices, code et bibliothèques en ligne),
   avec son manifeste, son service worker et ses icônes. Usage : node build.mjs [app…] */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const APPS = {
  roue: { name: 'Roue', desc: 'Tableau de service équitable : tours de garde, repos, relèves. Tout reste sur l’appareil.', libs: ['node_modules/qrcode-generator/dist/qrcode.js'], js: ['roue/engine.js', 'roue/app.js'] },
  convoi: { name: 'Convoi', desc: 'Tableau de marche d’un convoi : heures de passage, haltes, groupes. Tout reste sur l’appareil.', libs: ['node_modules/qrcode-generator/dist/qrcode.js', 'node_modules/leaflet/dist/leaflet.js'], css: ['node_modules/leaflet/dist/leaflet.css'], js: ['convoi/engine.js', 'convoi/app.js'], img: ' https://wmts.geo.admin.ch', connect: '' },
  ordre: { name: 'Ordre', desc: 'De l’appréhension du problème à la donnée d’ordre, selon la méthode de l’Armée suisse. Tout reste sur l’appareil.', libs: ['node_modules/qrcode-generator/dist/qrcode.js'], js: ['ordre/method.js', 'ordre/app.js'] },
  drill: { name: 'Drill', desc: 'Instruction de base : grades, alphabet, sanitaire, conduite. Tout reste sur l’appareil.', libs: ['node_modules/qrcode-generator/dist/qrcode.js'], js: ['drill/decks.js', 'drill/engine.js', 'drill/app.js'] }
};
const GLYPH = {
  roue: '<circle cx="256" cy="256" r="120" fill="none" stroke="#fff" stroke-width="34"/><path d="M256 136v240M152 196l208 120M152 316l208-120" stroke="#fff" stroke-width="22"/><circle cx="256" cy="256" r="34" fill="#fff"/>',
  convoi: '<rect x="96" y="216" width="84" height="80" fill="#fff"/><rect x="214" y="216" width="84" height="80" fill="#fff"/><rect x="332" y="216" width="84" height="80" fill="#fff"/><path d="M96 352h296M352 316l44 36-44 36" fill="none" stroke="#fff" stroke-width="22"/><circle cx="210" cy="166" r="15" fill="#fff"/><circle cx="256" cy="166" r="15" fill="#fff"/><circle cx="302" cy="166" r="15" fill="#fff"/>',
  ordre: '<rect x="136" y="128" width="240" height="30" fill="#fff"/><rect x="136" y="184" width="240" height="30" fill="#fff"/><rect x="136" y="240" width="240" height="30" fill="#fff"/><rect x="136" y="296" width="240" height="30" fill="#fff"/><rect x="136" y="352" width="150" height="30" fill="#fff"/>',
  drill: '<rect x="132" y="150" width="212" height="212" fill="none" stroke="#fff" stroke-width="30"/><path d="M186 258l44 44 86-92" fill="none" stroke="#fff" stroke-width="30"/><path d="M380 186v212H168" fill="none" stroke="#fff" stroke-width="22" opacity=".55"/>'
};
export const iconSvg = k => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#55584F"/><path d="M0 0h512L0 512z" fill="#62655D"/>${GLYPH[k]}</svg>`;

function build(k) {
  const A = APPS[k], out = path.join(ROOT, 'dist', k);
  fs.mkdirSync(out, { recursive: true });
  const css = [rd('shared/inter.css'), ...(A.css || []).map(rd), rd('shared/base.css'), rd(`${k}/app.css`)].join('\n').replace(/url\(images\/[^)]+\)/g, 'none');
  const js = [...A.libs.map(rd), rd('shared/ui.js'), ...A.js.map(rd)].join('\n;\n').replace(/<\/script/gi, '<\\/script');
  const boot = `if (window.top !== window.self) { document.documentElement.hidden = true; throw new Error('cadre'); }`;
  const sha = s => crypto.createHash('sha256').update(s, 'utf8').digest('base64');
  const csp = `default-src 'none'; script-src 'sha256-${sha(boot)}' 'sha256-${sha(js)}'; style-src 'unsafe-inline'; img-src 'self' data: blob:${A.img || ''}; font-src data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'`;
  const build = crypto.createHash('sha256').update(css + js).digest('hex').slice(0, 12);
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#000000">
<meta name="color-scheme" content="dark">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${A.name}">
<meta name="description" content="${A.desc}">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<title>${A.name}</title>
<style>${css}</style>
</head>
<body>
<div class="app" id="app"></div>
<script>${boot}</script>
<script>window.__BUILD=${JSON.stringify(build)};
${js}</script>
</body>
</html>
`;
  /* le second script contient la ligne __BUILD : son empreinte se calcule sur le texte exact */
  const body = `window.__BUILD=${JSON.stringify(build)};\n${js}`;
  const final = html.replace(`'sha256-${sha(js)}'`, `'sha256-${sha(body)}'`);
  fs.writeFileSync(path.join(out, 'index.html'), final);
  fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({ name: A.name, short_name: A.name, description: A.desc, lang: 'fr-CH', start_url: './', scope: './', display: 'standalone', orientation: 'any', background_color: '#1E201C', theme_color: '#000000', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] }, null, 2));
  fs.writeFileSync(path.join(out, 'sw.js'), rd('shared/sw.js').replace('__BUILD__', build).replace('__APP__', k));
  fs.writeFileSync(path.join(out, 'icon.svg'), iconSvg(k));
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  console.log(k, build, (final.length / 1024).toFixed(0) + ' ko');
}
const want = process.argv.slice(2);
for (const k of (want.length ? want : Object.keys(APPS))) build(k);
