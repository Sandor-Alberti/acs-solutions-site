'use strict';
const periods = {
  week: { revenue: '$24,800', sales: '32', goal: '83%', fraction: '$24,800 / $30,000', title: 'Weekly goal', range: 'Monday – Sunday', labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], values: [2400,3100,2800,4000,5200,3600,3700] },
  month: { revenue: '$98,400', sales: '128', goal: '82%', fraction: '$98,400 / $120,000', title: 'Monthly goal', range: 'Weeks 1 – 4', labels: ['Week 1','Week 2','Week 3','Week 4'], values: [21800,24700,27100,24800] }
};
const chart = document.querySelector('.bar-chart');
function setPeriod(key) {
  const period = periods[key];
  document.querySelectorAll('[data-period]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.period === key)));
  ['revenue','sales','goal'].forEach(id => { document.getElementById(id).textContent = period[id]; });
  document.getElementById('goal-fraction').textContent = period.fraction;
  document.getElementById('chart-period').textContent = period.range;
  document.querySelector('.dashboard-bottom > span').textContent = period.title;
  document.querySelector('.goal-track > span').style.width = period.goal;
  chart.replaceChildren();
  period.values.forEach((value, index) => {
    const column = document.createElement('div');
    const bar = document.createElement('i');
    bar.style.setProperty('--height', `${value / Math.max(...period.values) * 100}%`);
    const label = document.createElement('span');
    label.textContent = period.labels[index];
    column.append(bar, label);
    chart.append(column);
  });
  chart.setAttribute('aria-label', `Sample revenue: ${period.labels.map((label, i) => `${label} $${period.values[i].toLocaleString('en-US')}`).join(', ')}.`);
}
document.querySelectorAll('[data-period]').forEach(button => button.addEventListener('click', () => setPeriod(button.dataset.period)));
setPeriod('week');
const projects = {
  crux: {title:'Crux AI', image:'assets/crux-website.png', description:'A custom website and team knowledge platform that answers questions from approved guides, notes, and meeting transcripts with source references.'},
  ben: {title:'Ben Lammers Studio', image:'assets/ben-lammers-full.png', description:'Photography and film portfolio with a cinematic visual direction. The related client portal is a demo.'},
  tfin: {title:'T.FIN Building Solutions', image:'assets/tfin-full.png', description:'Website for a glass and glazing manufacturers’ representative, including product lines, projects, quote requests, and content editing.'}
};
const dialog = document.getElementById('project-dialog');
const showcase = document.querySelector('.projects');
const slides = [...showcase.querySelectorAll('.project')];
const previewURLs = {ben:'https://benlammersmarketing.com/', tfin:null, crux:'previews/crux/index.html'};
let selected = 0;
let previewPaused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let showcaseVisible = false;
function syncShowcase() {
  slides.forEach((slide, index) => {
    const position = (index - selected + slides.length) % slides.length;
    slide.dataset.position = position === 0 ? 'center' : position === 1 ? 'right' : 'left';
    const button = slide.querySelector('[data-preview]');
    const key = button.dataset.preview;
    button.setAttribute('aria-label', index === selected ? `Enlarge ${projects[key].title} preview` : `Show ${projects[key].title}`);
    slide.querySelectorAll('.project-tags a').forEach(link => link.tabIndex = index === selected ? 0 : -1);
    const viewport = slide.querySelector('.browser-viewport');
    const existing = viewport.querySelector('iframe');
    const shouldPlay = Boolean(previewURLs[key]) && index === selected && showcaseVisible && !previewPaused && !document.hidden && !dialog.open;
    if (!shouldPlay) existing?.remove();
    if (shouldPlay && !existing) {
      const frame = document.createElement('iframe');
      frame.src = previewURLs[key];
      frame.title = `${projects[key].title} animated website preview`;
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('inert', '');
      frame.allow = 'autoplay';
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      viewport.append(frame);
    }
  });
  const key = slides[selected].querySelector('[data-preview]').dataset.preview;
  document.getElementById('showcase-status').textContent = `${projects[key].title} · ${selected + 1} / ${slides.length}`;
  sizeShowcase();
}
function sizeShowcase() {
  const active = slides[selected];
  showcase.style.height = `${active.offsetHeight + 40}px`;
  showcase.parentElement.style.setProperty('--preview-mid', `${active.querySelector('.project-image').offsetHeight / 2 + 20}px`);
}
const showcaseSizer = new ResizeObserver(sizeShowcase);
slides.forEach(slide => showcaseSizer.observe(slide));
function selectSlide(index) { selected = (index + slides.length) % slides.length; syncShowcase(); }
slides.forEach((slide, index) => slide.querySelector('[data-preview]').addEventListener('click', () => {
  if (index !== selected) { selectSlide(index); return; }
  const project = projects[slide.querySelector('[data-preview]').dataset.preview];
  document.getElementById('preview-title').textContent = project.title;
  document.getElementById('preview-image').src = project.image;
  document.getElementById('preview-image').alt = `${project.title} website preview`;
  document.getElementById('preview-description').textContent = project.description;
  dialog.showModal();
  syncShowcase();
}));
document.querySelector('[data-carousel="previous"]').addEventListener('click', () => selectSlide(selected - 1));
document.querySelector('[data-carousel="next"]').addEventListener('click', () => selectSlide(selected + 1));
showcase.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); selectSlide(selected + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
let touchStart = null;
showcase.addEventListener('touchstart', event => { touchStart = event.changedTouches[0].clientX; }, {passive:true});
showcase.addEventListener('touchend', event => {
  const distance = event.changedTouches[0].clientX - touchStart;
  if (touchStart !== null && Math.abs(distance) > 45) selectSlide(selected + (distance < 0 ? 1 : -1));
  touchStart = null;
}, {passive:true});
dialog.addEventListener('close', syncShowcase);
document.addEventListener('visibilitychange', syncShowcase);
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { previewPaused = event.matches; syncShowcase(); });
new IntersectionObserver(entries => { showcaseVisible = entries[0].isIntersecting; syncShowcase(); }, {threshold:.15}).observe(showcase);
syncShowcase();
document.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
document.getElementById('year').textContent = new Date().getFullYear();

// Respect reduced motion and suspend decorative motion off-screen or in hidden tabs.
const heroScene = document.querySelector('.hero-scene');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let heroVisible = true;
document.documentElement.classList.add('js-motion');
function syncHeroMotion() {
  heroScene.classList.toggle('motion-paused', reducedMotion.matches);
  heroScene.classList.toggle('motion-idle', !heroVisible || document.hidden);
}
reducedMotion.addEventListener('change', syncHeroMotion);
document.addEventListener('visibilitychange', syncHeroMotion);
new IntersectionObserver(entries => {
  heroVisible = entries[0].isIntersecting;
  syncHeroMotion();
}, {threshold:0.1}).observe(heroScene);
syncHeroMotion();

const previewSizer = new ResizeObserver(entries => entries.forEach(entry => entry.target.style.setProperty('--preview-scale', entry.contentRect.width / 1440)));
showcase.querySelectorAll('.browser-viewport').forEach(viewport => previewSizer.observe(viewport));
