# Automatic Google and Lieferando ratings

This optional Node 22+ server serves the existing static website and a same-origin `/api/ratings?provider=google|lieferando` endpoint. It has no npm dependencies. Run `npm start` (default: `http://127.0.0.1:8080`). Configure `HOST` and `PORT` for the hosting provider. Existing static hosting can instead reverse-proxy `/api/ratings` to this server and set the `alberto-ratings-endpoint` meta value to `/api/ratings` on index.html and bestellen.html (and preserve that setting in its build process).

## Google setup — not activated yet

Set **GOOGLE_PLACES_API_KEY** in the host's private environment/secret settings, never in HTML, JavaScript, Git or chat. Enable Places API (New) for that key and restrict it to that API and the server's permitted origin/IP mechanism. Set an appropriate quota/budget in the Google project before activation. The request uses the confirmed Alberto place ID `ChIJvxMbe4y5kUcRX1GLsx9MlT0`, and requests only `id,rating,userRatingCount,attributions`. No key or raw provider errors are returned to visitors. No API account, billing or key was created by this change.

Google results are fetched on demand, displayed with Google Maps attribution and additional provider attribution when returned. They are not persisted, cached server-side, or put in browser storage. During a visible visit the browser refreshes after five minutes, removes expired values on error, and keeps the external links available. Review text/authors/photos are not imported.

If Google content is enabled, the published privacy/terms pages must accurately describe that integration and link the applicable Google terms/privacy policy; no unpublished integration is represented as live in the current legal pages.

Docs: https://developers.google.com/maps/documentation/places/web-service/place-details
Attribution: https://developers.google.com/maps/documentation/places/web-service/policies

## Lieferando source

The existing restaurant order domain has a public aggregate page:
https://www.ristorantepizzeriaalberto-weilamrhein.de/review

This is a page operated by Lieferando, not a documented ratings API. The adapter checks the Alberto/Holzmattenweg identity and reads only the labelled `… Sterne aus … Bewertungen` aggregate. It never derives an average from individual reviews. It fails closed if the page changes, blocks the hosting server, redirects, or fails to provide a valid count/score. Provider markup changes may require an adapter update. No bypass, proxy service, scraper account or customer login is used.

The publicly browsed source showed 5 stars / 178 reviews during research on 21 October 2026. These numbers are **not hardcoded into the site**. The main Lieferando marketplace search result showed a different cached aggregate (4.9 / 220+), so the section explicitly links the existing order-domain source rather than conflating the two.

The approved headline `Mit Liebe gekocht. Mit 5 Sternen bewertet.` appears only when the live returned score is exactly 5. Otherwise the second sentence becomes `Von unseren Gästen geschätzt.` The accepted delivery sentence stays unchanged.

## Static hosting and offline opening

A static ZIP or GitHub Pages cannot run this API by itself. Generated HTML leaves the endpoint unset, so it shows working provider/review links without invented or frozen scores. This server injects the same-origin endpoint only on the two relevant pages. No external provider scripts, cookies or tracking iframes are injected.

The Google review button uses the identified Place ID in Google's direct write-review URL. Google may require sign-in. No review was submitted during testing.

## Validation and remaining setup

- `node --test tests/ratings.cjs`: aggregate parsing, wrong identity, bad values, provider failures, updated data, private-file isolation and key handling.
- `node tests/ratings-browser.cjs`: controlled fixture responses, responsive layout, score refresh, changed five-star headline and unavailable/stale fallback. Fixture ratings never enter production HTML or server code.
- `node tests/browser.cjs`: existing nine-page regression suite.

Live end-to-end verification is still pending: no Google API key is configured; a direct server request to Lieferando did not succeed in this managed execution environment. The hosting destination was not provided. Confirm deployment, outbound access and Google configuration before calling the automatic display active. The browser tests validate the integration contract, not a successful live Google API call.
