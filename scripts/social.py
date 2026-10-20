"""Shared, local SVG social links for the contact page and every footer."""
from html import escape

SOCIAL = (
    ('Instagram', 'https://www.instagram.com/ristorantealberto/', 'instagram'),
    ('Facebook', 'https://www.facebook.com/share/18fm5KVA2n/', 'facebook'),
    ('TikTok', 'https://www.tiktok.com/@ristorante.alberto', 'tiktok'),
)

ICONS = {
    'instagram': '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>',
    'facebook': '<path fill="currentColor" d="M13.8 22v-9h3l.5-3.5h-3.5V7.3c0-1 .3-1.7 1.8-1.7h1.9V2.4c-.3-.1-1.5-.2-2.8-.2-2.8 0-4.7 1.7-4.7 4.8v2.5H7V13h3v9z"/>',
    'tiktok': '<path fill="currentColor" d="M16.6 2c.2 2.1 1.4 3.7 3.4 4.2v3.3a8.3 8.3 0 0 1-3.4-1.1v6.8a6.3 6.3 0 1 1-5.5-6.3v3.4a3 3 0 1 0 2.2 2.9V2z"/>',
}


def social_links():
    links = []
    for label, url, icon in SOCIAL:
        svg = f'<svg class="social-icon" viewBox="0 0 24 24" width="23" height="23" aria-hidden="true" focusable="false">{ICONS[icon]}</svg>'
        links.append(f'<a class="social-link" href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{svg}<span>{label}</span></a>')
    return '<nav class="social-links" aria-label="Alberto auf Social Media">' + ''.join(links) + '</nav>'
