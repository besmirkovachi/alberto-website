'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'assets/vendor');
fs.mkdirSync(dest, { recursive: true });
for (const [source, target] of [
  ['gsap/dist/gsap.min.js', 'gsap.min.js'],
  ['gsap/dist/ScrollTrigger.min.js', 'ScrollTrigger.min.js'],
  ['lenis/dist/lenis.min.js', 'lenis.min.js'],
  ['lenis/dist/lenis.css', 'lenis.css'],
  ['lenis/LICENSE', 'LENIS-LICENSE.txt'],
]) fs.copyFileSync(path.join(root, 'node_modules', source), path.join(dest, target));
