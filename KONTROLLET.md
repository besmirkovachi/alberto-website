# Kontrolli i dorëzimit — Alberto V1 Premium · Menu 2026

## Vlerësimet Google dhe Lieferando

Shtohen seksionet për vlerësime në Homepage dhe Lieferung, lidhja Google për të shkruar vlerësim dhe shërbimi opsional për marrjen automatike të notave. Pesë teste të shërbimit dhe testi i browser-it për përditësim, ndryshim note dhe dështim burimi kaluan. Testi i browser-it përdor të dhëna prove, jo lidhje aktive me Google.

**Aktivizimi real mbetet i papërfunduar:** hostingu nuk është konfirmuar dhe nuk ka çelës Google Places të konfiguruar. Kërkesa direkte e serverit drejt Lieferando nuk përfundoi me sukses në këtë ambient; faqja publike u lexua përmes mjetit web. Pa lidhje funksionale faqja tregon vetëm lidhjet e burimeve, pa nota të shpikura. Hollësitë te `server/README.md`.

## Përditësimi i Homepage

Fotografia origjinale tani mbush gjerësinë dhe pjesën kryesore të ekranit të parë. Hyrja GSAP e logos luhet në çdo hapje të re dhe rifreskim; preferencat e lëvizjes, lidhjet me ankorë dhe ndërprerja gjatë ndërveprimit respektohen.

Baza e ndryshimit: `codex/alberto-premium-v1` në commit `40421e252c14247efa5ea853f3423b66acd0e382`. 20 grupe kontrollesh kaluan, zero dështime dhe zero gabime JavaScript/HTTP; një kontroll file:// u shënua skipped për shkak të politikës së Chromium. 20 grupe kontrollesh kaluan, zero dështime dhe zero gabime JavaScript/HTTP; një kontroll file:// u shënua skipped për shkak të politikës së Chromium. Rezultati aktual i ekzekutueshëm dhe matjet ruhen në `tests/delivery-results.json`; shënimet më poshtë dokumentojnë dorëzimin e mëparshëm të menusë. Pamjet e Homepage u shqyrtuan në 1440×900, 390×844 dhe 320×568 në Chromium. Telefona fizikë dhe Safari nuk u testuan.

## Dorëzimi i mëparshëm i menusë

Baza: `codex/alberto-premium-v1`, commit `43749a496c5e66064a33e21137de92f53aaf341a`. Menuja e re: **Alberto_Menü_2026.pdf**. Implementimi është në një kopje të re; repository origjinal, kopja premium e mëparshme dhe ZIP-i i vjetër janë të pandryshuar. Nuk u bë Commit, Push, Merge apo Publish.

## Rezultati përfundimtar

**18 grupe kontrollesh kaluan; zero dështime funksionale dhe zero gabime JavaScript/HTTP në testet e përfunduara. 1 kontroll u kufizua nga politika e browser-it, siç shpjegohet më poshtë.**

| Fusha | Çfarë u verifikua |
| --- | --- |
| Menuja e re | 151 rreshta, 153 çmime, 18 kategori në rendin e PDF-së |
| Saktësia | Çdo emër, përshkrim, madhësi dhe çmim kundrejt referencës së pavarur të PDF-së; pa produkte të vjetra të mbetura |
| Kërkimi | Shkrim i shpejtë, shenja diakritike, tekst literal që ngjan me HTML, rezultat bosh, reset dhe kombinim me kategorinë |
| Kategoritë | Zgjedhësi në telefon, Back/Forward, #dolci, lidhjet e vjetra dhe hash i keqformuar |
| Videoja | Nisje kur hyn në pamje, muted/playsinline/loop, pause jashtë pamjes, zgjedhje manuale, Reduced Motion dhe data saving |
| Autoplay i bllokuar | Poster dhe nisje manuale të përdorshme; pa gabime të patrajtuara |
| Galeria | Filtrat, lightbox, tastiera, fokus dhe mbyllje me backdrop |
| Navigimi në telefon | Dialog native, Escape, fokus dhe rikthim scroll-i |
| Animacionet | Hyrja GSAP, përfundimi/ndërprerja, Reduced Motion dinamik, Lenis vetëm desktop |
| Social | Tre URL dhe SVG në Kontakt dhe footer-in e nëntë faqeve; lexueshmëri pas tap-it dhe fokusit |
| Responsive | 9 faqe × 5 gjerësi: 1440, 820, 390, 360, 320 px — 45 kombinime, pa overflow horizontal |
| Pa JavaScript | Përmbajtja dhe lidhjet të përdorshme; kontrollet native të videos të ruajtura |
| Skedarët lokalë | 58 burime dhe 39 lidhje me ankorë të verifikuara mbi server lokal |

Kontrolli vizual shqyrtoi tekstet e reja, footer-in, shënimin për porositjet, kategoritë dhe madhësitë e ujërave. Në telefon tekstet kryesore të Über uns/Feiern janë 17 px dhe input/select 16 px. Kartat sociale kanë zona prekëse mbi 44 × 44 px edhe në 320 px.

## Gabimet e korrigjuara

1. Tastet e navigimit shkaktonin pastrim të përsëritur të stileve të animacioneve pasi ato kishin përfunduar. Pastrimi tani kryhet vetëm kur nevojitet; hiqet puna e panevojshme me GSAP/DOM.
2. Kërkimi për Familienpizza kthente të gjitha pizzat për shkak të nënshkrimit të përbashkët të kategorisë. Shënimet e përgjithshme nuk indeksohen më si emër i çdo produkti.
3. Lidhjet e vjetra të birrës dhe aperitivëve çonin te grupet e bashkuara të vjetra. Tani çojnë te kategoritë e reja përkatëse.
4. Pas prekjes në telefon, ikonat dhe emrat social në Kontakt mund të bëheshin të bardhë mbi cream. Ngjyra tani mbetet e lexueshme; hover-i i desktop-it ruan trajtimin e veçantë.
5. Rifreskimet e matjeve të scroll-it gjatë kërkimit tani bashkohen pasi shtypja ndalet; rezultatet filtrohen menjëherë. Teksti i kërkimit përgatitet një herë për produkt dhe shmangen shkrimet e pandryshuara në DOM.
6. Videoja trajton dështimin dhe përfundimin me vonesë të kërkesës play(), respekton pauzën manuale dhe nuk nis automatikisht jashtë pamjes.

## Matja e reagimit

Chromium headless, pamje 390 × 844 me touch dhe CPU të ngadalësuar 4×; 50 mostra. Nga input-i te kuadri i dytë i vizatimit: **P95 46.9 ms**, maksimumi 93.3 ms. Kjo është matje sintetike laboratorike, jo INP nga vizitorët realë dhe jo provë në telefon fizik. Raporti ruan edhe long tasks për interpretim të ndershëm.

## Kufijtë e verifikimit

- Chromium i këtij ambienti bllokon `file://` me `ERR_BLOCKED_BY_ADMINISTRATOR`. Politika nuk u ndryshua; kontrolli i hapjes direkte është shënuar **skipped**, jo passed. Të gjitha faqet, CSS, fontet dhe fotografitë u kontrolluan përmes serverit lokal. ZIP-i përmban strukturën e plotë relative dhe HTML të gatshëm.
- Nuk u testua fizikisht iPhone/Android ose Safari; përdorimi i touch dhe përmasave u emulua në Chromium.
- Nuk u dërguan porosi, rezervime ose mesazhe reale. Lidhja Facebook është marrë nga V1; destinacioni i saj aktual nuk është verifikuar online.
- Kodet e paqarta të PDF-së E te O Sole Mio, A1, 9 te Piccata dhe shkrimi BOKKOLI ruhen sipas burimit. Nuk janë korrigjuar ose interpretuar me hamendje.

## Integriteti dhe dorëzimi

51 skedarët e mediave, fonteve dhe bibliotekave të kopjes premium të mëparshme janë identikë. Fotografia kryesore dhe videoja nuk u zëvendësuan. `tests/menu-2026.json` ruan hash-in SHA-256 të PDF-së dhe referencën e pavarur; `tests/v1-menu.json` ruan menunë historike.

`tests/delivery-results.json` regjistron kontrollet dhe hash-et e burimeve të testuara. Paketimi ndalon nëse ato ndryshojnë pas kontrollit. `MANIFEST.json` dhe testi CRC verifikojnë skedarët brenda ZIP-it. Paketa e re është **ALBERTO-WEBSITE-V1-MENU-2026.zip**. Për hapje ndiq `LEXO-FILLIMISHT.txt`.

Në këtë përditësim u përdorën udhëzimet emil-design-eng, mobile-native, animation-performance dhe review-animations nga koleksioni i disponueshëm me 10 Skills. Cloud Environment u përdor për ambientin e ekzekutimit. Nuk u shtua framework, bibliotekë ikonash apo shërbim i ri publikimi.
