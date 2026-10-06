#!/usr/bin/env python3
"""Build the static Alberto website. Python 3 standard library only."""
from pathlib import Path
from html import escape
import json
import os
import re
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE_URL = os.environ.get('SITE_URL', '').rstrip('/')
INDEXABLE = os.environ.get('SITE_INDEXABLE') == '1'
if SITE_URL:
    parsed = urlsplit(SITE_URL)
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username
            or parsed.password or parsed.query or parsed.fragment):
        raise SystemExit('SITE_URL must be an HTTPS website URL without credentials, query, or fragment.')
if INDEXABLE and not SITE_URL:
    raise SystemExit('Set the confirmed SITE_URL before enabling search indexing.')
PAGES = {
    'index': ('Italienisches Restaurant & Pizzeria in Weil am Rhein', 'Ein Stück Italien in Weil am Rhein. Entdecken Sie Pizza, Pasta und italienische Gastfreundschaft im Ristorante Pizzeria Alberto.'),
    'speisekarte': ('Speisekarte · Pizza, Pasta & italienische Küche', 'Die Speisekarte von Alberto: Pizza, Pasta, Risotto, Antipasti, Fleisch, Fisch und Desserts. Alle Gerichte und Preise auf einen Blick.'),
    'ueber-uns': ('Über uns · Italienisch im Herzen', 'Lernen Sie Ristorante Pizzeria Alberto in Weil am Rhein kennen. Italienische Küche und persönliche Gastfreundschaft seit 2023.'),
    'galerie': ('Galerie · Ein Blick zu Alberto', 'Einblicke in unsere Küche, unsere Gerichte und den separaten Raum für private Feiern bei Alberto in Weil am Rhein.'),
    'feiern': ('Private Feiern · Ihr Raum bei Alberto', 'Ein separater Raum im Obergeschoss für Geburtstage, Familienfeiern und gemeinsame Abende. Möglichkeiten und Verfügbarkeit telefonisch besprechen.'),
    'bestellen': ('Lieferung & Abholung · Alberto für zu Hause', 'Italienische Küche für zu Hause. Bei Alberto online oder telefonisch bestellen. Lieferung ab 20 € Mindestbestellwert.'),
    'kontakt': ('Kontakt & Anfahrt · Besuchen Sie Alberto', 'Ristorante Pizzeria Alberto, Holzmattenweg 13, 79576 Weil am Rhein. Telefon +49 7621 686 92 05. Mittwoch Ruhetag.'),
    'impressum': ('Impressum', 'Anbieterinformationen und Kontakt für das Ristorante Pizzeria Alberto in Weil am Rhein.'),
    'datenschutz': ('Datenschutz', 'Informationen zur Datenverarbeitung auf der Website des Ristorante Pizzeria Alberto.'),
}
NAV = [('speisekarte','Speisekarte'),('ueber-uns','Über uns'),('galerie','Galerie'),('feiern','Private Feiern'),('bestellen','Lieferung'),('kontakt','Kontakt')]
SIZES = {'hero':(1536,1024),'pizza':(1024,1536),'antipasti':(1024,1536),'steak':(1024,1536),'dessert':(1536,1152),'fish':(1536,1152),'risotto':(1152,1536),'pasta':(1152,1536),'room':(1152,1536),'room2':(1152,1536),'room3':(1152,1536),'event':(1152,1536)}
MAP = 'https://www.google.com/maps/search/?api=1&amp;query=Ristorante+Pizzeria+Alberto+Holzmattenweg+13+Weil+am+Rhein'

def photo(name, alt, cls='', eager=False):
    w,h = SIZES[name]
    return f'<img class="{cls}" src="assets/{name}.webp" srcset="assets/responsive/{name}-480.webp 480w, assets/responsive/{name}-960.webp 960w, assets/{name}.webp {w}w" sizes="(max-width: 700px) 100vw, (max-width: 1100px) 70vw, 55vw" width="{w}" height="{h}" alt="{escape(alt, quote=True)}" loading="{"eager" if eager else "lazy"}" decoding="async" {"fetchpriority=high" if eager else ""}>'

def image_token(match):
    parts=[part.strip() for part in match.group(1).split('|')]
    parts[1]=' '.join(parts[1].split())
    return photo(parts[0],parts[1],parts[2] if len(parts)>2 else '',len(parts)>3 and parts[3]=='eager')

def nav(page, mobile=False):
    links = ([('index','Startseite')]+NAV) if mobile else NAV
    return ''.join(f'<a href="{slug}.html" {"aria-current=page" if slug==page else ""}><span>{label}</span>{"<span aria-hidden=true>↗</span>" if mobile else ""}</a>' for slug,label in links)

def header(page):
    return f'''<a class="skip-link" href="#main">Zum Inhalt springen</a>
<header class="site-header"><div class="header-inner">
<a class="brand" href="index.html" aria-label="Alberto Ristorante · Pizzeria – Startseite"><img src="assets/logo.png" alt="Alberto" width="1600" height="300"><span>RISTORANTE · PIZZERIA</span></a>
<nav class="desktop-nav" aria-label="Hauptnavigation">{nav(page)}</nav>
<a class="header-call" href="tel:+4976216869205">Anrufen <span aria-hidden="true">↗</span></a>
<button class="nav-toggle" aria-haspopup="dialog" aria-controls="mobile-menu" aria-expanded="false"><span>Menü</span><span class="menu-lines" aria-hidden="true"></span></button>
</div></header>
<dialog class="mobile-menu" id="mobile-menu" aria-label="Hauptnavigation"><div class="mobile-menu-top"><span class="eyebrow">Benvenuti da Alberto</span><button class="icon-button menu-close" aria-label="Menü schließen">×</button></div><nav aria-label="Mobile Hauptnavigation">{nav(page,True)}</nav><div class="mobile-menu-bottom"><span class="tricolore" aria-hidden="true"></span><p>Ein Stück Italien.<br>Mitten in Weil am Rhein.</p><a href="tel:+4976216869205">+49 7621 686 92 05 ↗</a></div></dialog>
<noscript><nav class="nojs-nav" aria-label="Seitennavigation">{nav(page,True)}</nav></noscript>'''

def footer():
    return f'''<footer class="site-footer"><div class="container footer-top"><div class="footer-intro"><span class="eyebrow">A presto, bei Alberto.</span><p class="footer-heading">Das gute Leben<br>beginnt am <em>Tisch.</em></p><span class="tricolore" aria-hidden="true"></span></div><div><h2>Hier sind wir</h2><address>Ristorante Pizzeria Alberto<br>Holzmattenweg 13<br>79576 Weil am Rhein</address><a class="subtle-link" href="{MAP}" target="_blank" rel="noopener noreferrer">Route planen ↗</a></div><div><h2>Unsere Öffnungszeiten</h2><p>Mo, Di & Do–So<br>11:30–14:00 · 17:00–22:30</p><p class="footer-muted">Mittwoch Ruhetag</p><a href="tel:+4976216869205">+49 7621 686 92 05</a></div></div><div class="container footer-bottom"><a class="footer-logo" href="index.html" aria-label="Alberto – Startseite"><img src="assets/logo.png" width="1600" height="300" alt="Alberto"></a><div class="social-links"><a href="https://www.instagram.com/ristorantealberto/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="https://www.facebook.com/share/18fm5KVA2n/" target="_blank" rel="noopener noreferrer">Facebook ↗</a></div><div class="legal-links"><a href="impressum.html">Impressum</a><a href="datenschutz.html">Datenschutz</a><span>© Alberto</span></div></div></footer>
<div class="mobile-actions"><a href="tel:+4976216869205"><span aria-hidden="true">↗</span> Anrufen</a><a href="speisekarte.html">Speisekarte <span aria-hidden="true">↗</span></a></div>
<dialog class="lightbox" id="lightbox" aria-label="Bildergalerie"><button class="icon-button lightbox-close" aria-label="Bild schließen">×</button><div class="lightbox-stage"><button class="icon-button lightbox-prev" aria-label="Vorheriges Bild">←</button><figure><img alt=""><figcaption id="lightbox-caption" aria-live="polite"></figcaption></figure><button class="icon-button lightbox-next" aria-label="Nächstes Bild">→</button></div></dialog>'''

def contact():
    return f'''<section class="visit section-space" aria-labelledby="visit-title"><div class="container visit-grid"><div class="reveal"><p class="eyebrow"><span class="tiny-dot"></span> Ci vediamo</p><h2 id="visit-title">Ein guter Ort.<br>Für eine <em>gute Zeit.</em></h2><p>Mittags eine kleine Auszeit. Abends noch ein bisschen bleiben.<br class="desktop-only"> Wir freuen uns auf Sie.</p><a class="text-link" href="kontakt.html">Kontakt & Anfahrt <span aria-hidden="true">↗</span></a></div><div class="visit-details reveal"><div><span class="eyebrow">Besuchen</span><address>Holzmattenweg 13<br>79576 Weil am Rhein</address><a class="subtle-link" href="{MAP}" target="_blank" rel="noopener noreferrer">Route planen ↗</a></div><div><span class="eyebrow">Genießen</span><p>Mo, Di & Do–So<br>11:30–14:00 · 17:00–22:30</p><span class="muted">Mittwoch Ruhetag</span></div><a class="visit-phone" href="tel:+4976216869205">+49 7621 686 92 05 <span aria-hidden="true">↗</span></a></div></div></section>'''

def menu():
    source=json.loads((ROOT/'menu.json').read_text())
    categories=[('pizza','Pizza', [*source[4]['items'],*source[5]['items']]),('antipasti','Antipasti & Suppen',source[0]['items']),('salate','Salate',source[1]['items']),('pasta','Pasta & Risotto',[*source[2]['items'],*source[3]['items']]),('fleisch','Fleisch & Steak',source[6]['items']),('fisch','Fisch & Beilagen',[i for i in source[7]['items'] if i['group']!='DESSERT']),('dolci','Dolci',[i for i in source[7]['items'] if i['group']=='DESSERT']),('getraenke','Getränke & Bier',[*source[8]['items'],*source[9]['items']]),('wein','Wein & Aperitivo',[*source[10]['items'],*source[11]['items']])]
    sidebar='<aside class="menu-sidebar"><p class="eyebrow">Worauf haben Sie Lust?</p><nav aria-label="Speisekartenkategorien"><a href="#menu-list" data-category="all" aria-current="true">Alles entdecken <span>↗</span></a>'
    for key,label,items in categories:
        sidebar+=f'<a href="#{key}" data-category="{key}">{label}<span>{len(items):02}</span></a>'
    sidebar+='</nav><span class="tricolore" aria-hidden="true"></span><p class="menu-sidebar-note">Gutes Essen.<br>Ganz nach Ihrem Geschmack.</p></aside>'
    result=f'<div class="menu-layout container">{sidebar}<div id="menu-list" class="menu-list"><div class="menu-search js-only"><label for="dish-search">Lieblingsgericht finden</label><div class="search-field"><span aria-hidden="true">⌕</span><input id="dish-search" type="search" placeholder="Zum Beispiel Pizza, Carbonara …" autocomplete="off"><button type="button" id="clear-search" aria-label="Suche zurücksetzen" hidden>×</button></div><p id="menu-count" class="muted" role="status"></p></div><div id="no-results" hidden><h2>Nichts gefunden?</h2><p>Versuchen Sie einen anderen Suchbegriff oder entdecken Sie die ganze Karte.</p><button class="button" id="reset-menu">Alle Gerichte anzeigen ↗</button></div>'
    for key,label,items in categories:
        result+=f'<section class="menu-category" id="{key}" data-menu-category="{key}" aria-labelledby="title-{key}"><div class="menu-category-heading"><h2 id="title-{key}">{label}</h2><span>{"Ø 36 cm · Ausnahmen angegeben" if key=="pizza" else "Buon appetito"}</span></div><div class="menu-items">'
        for item in items:
            group=item.get('group','')
            result+=f'<article class="menu-item" data-search="{escape(" ".join([item["name"],item["description"],group,label]),quote=True)}">'
            if group: result+=f'<span class="dish-group">{escape(group)}</span>'
            result+=f'<div class="dish-title"><h3>{escape(item["name"])}</h3><span class="dish-price">{escape(item["price"])}</span></div>'
            if item['description']: result+=f'<p>{escape(item["description"])}</p>'
            result+='</article>'
        result+='</div></section>'
    result+='''<details class="allergens"><summary>Allergene & Zusatzstoffe <span aria-hidden="true">+</span></summary><p>Die Kennzeichnungen sind aus der bereitgestellten Speisekarte übernommen. Bei Allergien oder Unverträglichkeiten wenden Sie sich bitte vor der Bestellung an unser Team. Unsere separate Allergenkarte gibt Auskunft über die Zutaten.</p><p>Auch bei sorgfältiger Zubereitung können Spuren anderer Stoffe enthalten sein.</p><p><a class="text-link" href="tel:+4976216869205">Fragen zur Speisekarte? Anrufen ↗</a></p></details><p class="menu-footnote">Alle Preise in Euro inklusive Mehrwertsteuer. Für Online-Bestellungen gelten die Preise der jeweiligen Bestellplattform. Verfügbarkeit bitte vor Ort oder bei der Bestellung erfragen.</p></div></div>'''
    return result

GALLERY=[('pizza','Pizza mit Rucola und gehobeltem Parmesan','kueche','Pizza, amore e basta.'),('room','Festlich gedeckte Tische im separaten Raum im Obergeschoss','raeume','Platz für Ihre Menschen.'),('risotto','Risotto vor dem leuchtenden Alberto-Schriftzug','kueche','Ein Teller. Ganz viel Italien.'),('hero','Pizza und Fleischgericht auf einem gedeckten Tisch bei Alberto','kueche','Gemeinsam schmeckt’s besser.'),('antipasti','Antipasti mit Käse, Tomaten und italienischem Aufschnitt','kueche','Ein guter Anfang.'),('room2','Heller Feierraum mit einer langen gedeckten Tafel','raeume','Ein besonderer Rahmen.'),('dessert','Auf einem Teller angerichtete Desserts','kueche','La dolce vita.'),('fish','Fischfilets mit Pasta und Gemüse','kueche','Noch mehr zu entdecken.'),('room3','Blick in den separaten Raum mit gedeckten Tischen','raeume','Zeit, zusammenzukommen.'),('steak','Fleischgericht und Pizza am Tisch','kueche','Für den großen Appetit.')]

def gallery():
    out='<div class="gallery-filters js-only" role="group" aria-label="Galerie filtern"><button data-gallery-filter="all" aria-pressed="true">Alle Einblicke</button><button data-gallery-filter="kueche" aria-pressed="false">Unsere Küche</button><button data-gallery-filter="raeume" aria-pressed="false">Unsere Räume</button></div><p class="sr-only" id="gallery-count" role="status"></p><div class="gallery-grid">'
    for i,(name,alt,category,caption) in enumerate(GALLERY):
        out+=f'<figure class="gallery-tile reveal" data-gallery-category="{category}"><a href="assets/{name}.webp" data-lightbox data-caption="{caption}" aria-label="{escape(alt)} – vergrößern">{photo(name,alt)}<span class="gallery-expand" aria-hidden="true">↗</span></a><figcaption><span>{caption}</span><span>{i+1:02}</span></figcaption></figure>'
    return out+'</div>'

schema={'@context':'https://schema.org','@type':'Restaurant','name':'Ristorante Pizzeria Alberto','telephone':'+4976216869205','email':'info@restaurant-alberto.de','servesCuisine':'Italian','address':{'@type':'PostalAddress','streetAddress':'Holzmattenweg 13','postalCode':'79576','addressLocality':'Weil am Rhein','addressCountry':'DE'},'openingHoursSpecification':[{'@type':'OpeningHoursSpecification','dayOfWeek':['Monday','Tuesday','Thursday','Friday','Saturday','Sunday'],'opens':start,'closes':end} for start,end in [('11:30','14:00'),('17:00','22:30')]]}
if SITE_URL: schema.update(url=SITE_URL,image=SITE_URL+'/assets/hero.webp',hasMenu=SITE_URL+'/speisekarte.html')

for page,(title,desc) in PAGES.items():
    body=(ROOT/'templates'/f'{page}.html').read_text()
    body=body.replace('{{MENU}}',menu() if page=='speisekarte' else '').replace('{{GALLERY}}',gallery() if page=='galerie' else '').replace('{{CONTACT}}',contact())
    body=re.sub(r'\{\{image:([^}]+)\}\}',image_token,body)
    canonical=SITE_URL+('/' if page=='index' else '/'+page+'.html') if SITE_URL else ''
    metadata=f'<link rel="canonical" href="{escape(canonical)}"><meta property="og:url" content="{escape(canonical)}">' if canonical else ''
    html=f'''<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#18392e">
<title>{escape(title)} | Ristorante Pizzeria Alberto</title><meta name="description" content="{escape(desc,quote=True)}"><meta name="robots" content="{"index,follow" if INDEXABLE else "noindex,follow"}">
<meta property="og:type" content="website"><meta property="og:locale" content="de_DE"><meta property="og:site_name" content="Ristorante Pizzeria Alberto"><meta property="og:title" content="{escape(title,quote=True)}"><meta property="og:description" content="{escape(desc,quote=True)}"><meta property="og:image" content="{SITE_URL+'/assets/hero.webp' if SITE_URL else 'assets/hero.webp'}"><meta property="og:image:alt" content="Pizza und italienische Küche bei Alberto"><meta name="twitter:card" content="summary_large_image">{metadata}
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><link rel="preload" href="assets/fonts/cormorant-garamond-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="assets/fonts/manrope-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="style.css"><script src="script.js" defer></script><script type="application/ld+json">{json.dumps(schema,ensure_ascii=False)}</script></head>
<body class="page-{page}">{header(page)}<main id="main">{body}</main>{footer()}</body></html>'''
    arrow='<svg class="arrow-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>'
    flower='<svg class="flower-icon" viewBox="0 0 100 100" width="50" height="50" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2"><path d="M50 6v88M6 50h88M19 19l62 62M19 81l62-62"/><circle cx="50" cy="50" r="16"/></g></svg>'
    html=html.replace('↗',arrow).replace('✳',flower)
    (ROOT/f'{page}.html').write_text(html)
if SITE_URL:
    urls=''.join(f'<url><loc>{escape(SITE_URL+("/" if p=="index" else "/"+p+".html"))}</loc></url>' for p in PAGES)
    (ROOT/'sitemap.xml').write_text(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>')
elif (ROOT/'sitemap.xml').exists():
    (ROOT/'sitemap.xml').unlink()
(ROOT/'robots.txt').write_text('User-agent: *\n'+('Allow: /\n' if INDEXABLE else 'Disallow: /\n')+(f'Sitemap: {SITE_URL}/sitemap.xml\n' if SITE_URL else ''))
print(f'Built {len(PAGES)} static pages. Search indexing: {"enabled" if INDEXABLE else "disabled for draft"}.')
