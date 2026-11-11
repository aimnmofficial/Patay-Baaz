# Builds the single-file page from index.src.html + engine.js + app.js
h = open('index.src.html').read().replace('/*ENGINE*/', open('engine.js').read()).replace('/*SFX*/', open('sfx.js').read()).replace('/*APP*/', open('app.js').read())
open('public/index.html', 'w').write(h)
print('built public/index.html', len(h))
