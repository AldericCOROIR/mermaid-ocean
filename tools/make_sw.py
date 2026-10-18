# Writes sw.js: the offline cache for the game. Run after adding or changing files
# (the GitHub check fails if sw.js is out of date).
# Usage: python3 tools/make_sw.py
import hashlib, json, os
ROOTS = ['index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'src', 'vendor', 'assets']
files = []
for r in ROOTS:
    if os.path.isdir(r):
        for d, _, fs in os.walk(r):
            files += [os.path.join(d, f).replace(os.sep, '/') for f in fs]
    elif os.path.exists(r):
        files.append(r)
files.sort()
h = hashlib.sha1()
for f in files:
    # Git checks text files out as CRLF on Windows and LF in CI. The version
    # identifies the same published bytes on both systems after Git normalizes
    # them, so normalize line endings in the digest as well.
    h.update(f.encode()); h.update(open(f, 'rb').read().replace(b'\r\n', b'\n'))
version = h.hexdigest()[:12]
tpl = open('tools/sw.template.js').read()
open('sw.js', 'w').write(tpl.replace('__VERSION__', version).replace('__FILES__', json.dumps(['./'] + files, indent=1)))
print('sw.js', version, len(files), 'files')
