# Alberto Website V1 — Premium · Menu 2026

Website me nëntë faqe, bazuar në branch-in e konfirmuar `codex/alberto-premium-v1`, commit `43749a496c5e66064a33e21137de92f53aaf341a`, dhe në variantin premium të dorëzuar më parë. Menuja është përditësuar nga **Alberto_Menü_2026.pdf**. Përditësimet zhvillohen në branch-e të veçanta dhe shqyrtohen me pull request drejt V1; ky variant mbetet i papublikuar.

## Hapja e website-it

1. Nxirre **të gjithë ZIP-in**, jo vetëm `index.html`.
2. Hape `index.html` nga dosja e nxjerrë në Chrome ose Edge.
3. Mbaji `assets/`, skedarët CSS/JS dhe nëntë faqet HTML në të njëjtën strukturë.

Nuk nevojitet instalim, npm apo build për ta hapur. Fotot, fontet, videoja dhe bibliotekat janë lokale. Porositja e jashtme, harta dhe rrjetet sociale kërkojnë internet.

Nëse shfletuesi kufizon skedarët lokalë, nga kjo dosje mund të përdorësh:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Pastaj hap `http://127.0.0.1:8000`.

## Homepage — fotografia dhe hyrja

Fotografia origjinale mbush gjerësinë e ekranit dhe pothuajse gjithë lartësinë e parë, me titullin dhe butonat mbi të. Kompozimi përshtatet për desktop dhe telefon. Hyrja “Firma Alberto” zbulon logon me ngjyrat italiane dhe e vendos në header; shenja e vjetër e sesionit nuk e fsheh më animacionin.

Baza e këtij ndryshimi në GitHub: `codex/alberto-premium-v1`, commit `40421e252c14247efa5ea853f3423b66acd0e382`.

## Çfarë ndryshoi

- Menuja 2026: 151 rreshta të krahasueshëm, 153 çmime individuale, 18 kategori në rendin e PDF-së; emra, përshkrime, porcione dhe madhësi sipas burimit.
- 69 rreshta të ruajtur kanë çmim të ndryshuar; 70 mbajnë çmimin. Hiqen 12 rreshta dhe shtohen 12, përfshirë ndërrimet e markave dhe madhësive të pijeve.
- Menu për fëmijë deri në 12 vjeç; Desserts në navigim dhe titull; ujërat me dy madhësi shfaqen brenda një produkti.
- Kërkim i menjëhershëm, navigim sipas kategorive dhe zgjedhës kompakt në telefon.
- Tekste të rishkruara gjermanisht në Über uns dhe Feiern; tipografi më e lexueshme.
- Instagram, Facebook dhe TikTok me ikona në Kontakt dhe në footer-in e të nëntë faqeve.
- Shënimi i kërkuar për Sonderwünsche në Bestellen dhe Speisekarte.
- Caption-i i fotografisë së parë: **A tavola con Alberto.** Fotografia origjinale ruhet.
- Video e kuzhinës që nis pa zë kur hyn në pamje, me loop, poster, pauzë jashtë pamjes dhe kontroll të përdoruesit.

Cream `#F5F1E8`, jeshile `#173B2E`, e kuqe `#A93D32`; Cormorant Garamond dhe Manrope. Fotot, logoja, videoja origjinale, oraret dhe lidhjet e porositjes ruhen nga V1.

## Google dhe Lieferando

Homepage ka seksionin Google dhe lidhjen direkte për të shkruar vlerësim. Lieferung ka seksionin Lieferando me tekstin e miratuar. Notat merren nga shërbimi opsional `server/`; nuk ruhen si numra statikë në HTML. Pa konfigurim ose kur burimi nuk përgjigjet, shfaqen lidhjet për vlerësimet aktuale.

**Përditësimi automatik ende nuk është aktiv në hosting.** Duhet host që ekzekuton Node ose përcjell `/api/ratings`, si dhe `GOOGLE_PLACES_API_KEY` në cilësimet private të hostit. GitHub Pages dhe hapja offline nuk ekzekutojnë këtë shërbim. Shih `server/README.md` për konfigurimin dhe kufijtë e verifikimit.

## Lëvizja dhe përdorshmëria

GSAP 3.15.0 + ScrollTrigger koordinojnë hyrjen “Firma Alberto” dhe animacionet diskrete. Lenis 1.3.26 përdoret vetëm në desktop me pointer të saktë; telefoni ruan scroll-in natyral. Reduced Motion çaktivizon hyrjen lëvizëse dhe scroll-in e zbutur. Hyrja me logon origjinale shfaqet në çdo hapje të re të Homepage (rreth 2.2 sekonda), përfshirë rifreskimin. Ndërpritet menjëherë gjatë ndërveprimit dhe nuk bllokon navigimin. Lidhjet drejt seksioneve, rikthimi te pozicioni i ruajtur, Reduced Motion dhe kursimi i të dhënave e ruajnë hapjen statike.

Videoja niset automatikisht vetëm kur është e dukshme dhe shfletuesi e lejon. Reduced Motion ose kursimi i të dhënave e kalojnë në nisje manuale. Pauza e përdoruesit respektohet. Pa JavaScript ruhen kontrollet native; nëse autoplay bllokohet mbetet butoni për nisje manuale.

Menuja mobile dhe lightbox-i përdorin dialogun native, Escape dhe kthim të fokusit. Kërkimi trajton tekstin si tekst, pa futur HTML të shkruar nga vizitori. Pa JavaScript, përmbajtja dhe lidhjet mbeten të lexueshme. Porositë dhe rezervimet vazhdojnë të përdorin lidhjet ekzistuese; nuk është shtuar backend.

## Të dhënat e menusë

Burimi është PDF-ja e re, jo menuja e vjetër. Katër shënime të burimit ruhen fjalë për fjalë për të mos shpikur korrigjime: E te O Sole Mio, A1, 9 pas Parmesan te Piccata dhe shkrimi BOKKOLI. Ato nuk janë konfirmuar nga restoranti si korrigjime alergjenësh. Website-i ruan këshillën për t'iu drejtuar personelit dhe kartës së veçantë të alergjenëve. Shih `KONTROLLET.md` për kufijtë e verifikimit.

## Ndryshimi i kodit

| Skedari | Roli |
| --- | --- |
| `templates/*.html` | Përmbajtja dhe struktura e faqeve |
| `scripts/build.py` | Gjenerimi i HTML, kategorive, navigimit dhe metadata |
| `scripts/social.py` | SVG-të lokale dhe URL-të e përbashkëta të rrjeteve sociale |
| `menu.json` | Menuja 2026, variantet dhe faqet burimore të PDF-së |
| `style.css` | Baza V1 |
| `premium.css` | Identiteti i përbashkët, homepage, header/footer dhe kontrollet e videos |
| `menu-premium.css` | Speisekarte dhe kategoritë desktop/mobile |
| `story-pages.css` | Über uns, Galerie dhe Feiern |
| `service-pages.css` | Bestellen, Kontakt dhe faqet ligjore |
| `script.js` | Navigimi, kërkimi, filtrat, lightbox-i dhe videoja |
| `motion.js` | GSAP, ScrollTrigger, Lenis dhe preferencat e lëvizjes |
| `tests/menu-2026.json` | Referenca e pavarur e PDF-së për kontrollin e menusë |
| `tests/v1-menu.json` | Menuja historike e V1, e ruajtur për krahasim |

Pas ndryshimit të templates, menusë ose gjeneratorit:

```sh
python3 scripts/build.py
```

Për rifreskim të bibliotekave të fiksuara në `package-lock.json`: `npm ci` dhe `npm run vendor`. Kjo nuk nevojitet për hapjen normale.

## Kontrolli dhe paketimi

```sh
node --check script.js
node --check motion.js
node tests/browser.cjs
python3 scripts/package.py
```

Testet kërkojnë Playwright dhe Chromium vetëm gjatë zhvillimit; udhëzimet janë te `tests/README.md`. Paketimi kontrollon raportin e testimit dhe integritetin SHA-256. ZIP-i i ri quhet `ALBERTO-WEBSITE-V1-MENU-2026.zip`.

Ky variant mbetet draft me `noindex` dhe `robots.txt: Disallow: /`. Për domain-in përfundimtar gjeneratori mbështet `SITE_URL=https://domain-i` dhe `SITE_INDEXABLE=1`; këto nuk janë aktivizuar. Faqet ligjore ruajnë të dhënat ekzistuese të V1.
