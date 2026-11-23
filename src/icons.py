# Icônes PNG de chaque app, rendues depuis le SVG écrit par build.mjs
import sys, pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).parent / 'dist'
apps = sys.argv[1:] or [p.name for p in root.iterdir() if (p / 'icon.svg').exists()]
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for a in apps:
        svg = (root / a / 'icon.svg').read_text()
        for n in (512, 192, 180):
            pg = b.new_page(viewport={'width': n, 'height': n})
            pg.set_content(f'<body style="margin:0;background:#55584F">{svg.replace("<svg ", f"<svg width={n} height={n} ")}</body>')
            pg.screenshot(path=str(root / a / f'icon-{n}.png'))
            pg.close()
    b.close()
print('icons', apps)
