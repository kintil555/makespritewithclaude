// Mount demo + tombol salin. Progressive enhancement: artikel tetap terbaca tanpa JS.
document.querySelectorAll('[data-demo]').forEach((el) => {
  const fn = window.PX && PX.demos[el.dataset.demo];
  if (!fn) return;
  el.textContent = ''; el.classList.add('live');
  try { fn(el); } catch (e) { el.textContent = 'Demo gagal: ' + e.message; console.error(e); }
});
document.querySelectorAll('details.code').forEach((d) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'copy'; b.textContent = 'Salin';
  b.onclick = () => navigator.clipboard.writeText(d.querySelector('code').textContent).then(() => { b.textContent = 'Tersalin'; setTimeout(() => (b.textContent = 'Salin'), 1200); });
  d.querySelector('summary').after(b);
});
