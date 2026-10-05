'use strict';
document.documentElement.classList.add('js');
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('#navigation');
toggle.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); nav.classList.toggle('open', open); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { toggle.setAttribute('aria-expanded','false'); nav.classList.remove('open'); } });
if ('IntersectionObserver' in window) { const observer = new IntersectionObserver(entries => entries.forEach(entry => {if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.08}); document.querySelectorAll('.reveal').forEach(el=>observer.observe(el)); } else {document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'));}
const box=document.querySelector('#lightbox');
document.querySelectorAll('.gallery-item').forEach(button=>button.addEventListener('click',()=>{const img=button.querySelector('img');box.querySelector('img').src=img.src;box.querySelector('img').alt=img.alt;box.showModal();}));
box.querySelector('button').addEventListener('click',()=>box.close());
box.addEventListener('click',e=>{if(e.target===box)box.close();});
