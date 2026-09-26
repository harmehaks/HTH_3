const slides = [...document.querySelectorAll('.slide')];
const titles = [
  'A clearer path',
  'The right to know',
  'Three connected components',
  'The mosaic effect',
  'Institutional memory',
  'Human judgment',
  'Connected services',
  'The next chapter',
];
let current = 0;
function go(index) {
  current = Math.max(0, Math.min(slides.length - 1, index));
  slides.forEach((s, i) => {
    s.classList.toggle('active', i === current);
    s.setAttribute('aria-hidden', i === current ? 'false' : 'true');
  });
  document.getElementById('counter').textContent =
    `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  document.getElementById('slide-name').textContent = titles[current];
  document.getElementById('progress').style.width = `${((current + 1) / slides.length) * 100}%`;
  document.getElementById('previous').disabled = current === 0;
  document.getElementById('next').disabled = current === slides.length - 1;
  window.scrollTo(0, 0);
}
document.getElementById('previous').onclick = () => go(current - 1);
document.getElementById('next').onclick = () => go(current + 1);
document.getElementById('print').onclick = () => window.print();
document.addEventListener('keydown', (e) => {
  if (['ArrowRight', ' ', 'PageDown'].includes(e.key)) {
    e.preventDefault();
    go(current + 1);
  }
  if (['ArrowLeft', 'PageUp'].includes(e.key)) {
    e.preventDefault();
    go(current - 1);
  }
  if (e.key === 'Home') go(0);
  if (e.key === 'End') go(slides.length - 1);
});
go(0);
