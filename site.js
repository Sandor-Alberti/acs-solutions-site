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
  ben: {title:'Ben Lammers Studio', image:'assets/ben-lammers-full.png', description:'Photography and film portfolio with a cinematic visual direction. The related client portal is a demo.'},
  tfin: {title:'T.FIN Building Solutions', image:'assets/tfin-full.png', description:'Website for a glass and glazing manufacturers’ representative, including product lines, projects, quote requests, and content editing.'}
};
const dialog = document.getElementById('project-dialog');
document.querySelectorAll('[data-preview]').forEach(button => button.addEventListener('click', () => {
  const project = projects[button.dataset.preview];
  document.getElementById('preview-title').textContent = project.title;
  document.getElementById('preview-image').src = project.image;
  document.getElementById('preview-image').alt = `${project.title} website preview`;
  document.getElementById('preview-description').textContent = project.description;
  dialog.showModal();
}));
document.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
document.getElementById('year').textContent = new Date().getFullYear();

// The shared motion control stops both the project rotation and background signals.
const heroScene = document.querySelector('.hero-scene');
const showcase = document.querySelector('.hero-showcase');
const slides = [...document.querySelectorAll('[data-slide]')];
const selectors = [...document.querySelectorAll('[data-showcase]')];
const motionToggle = document.querySelector('.motion-toggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeSlide = 0;
let motionPaused = false;
let heroVisible = true;
let showcaseEngaged = false;
let rotationTimer;
document.documentElement.classList.add('js-motion');

function showSlide(index) {
  activeSlide = index;
  slides.forEach((slide, i) => {
    slide.classList.toggle('is-active', i === index);
    slide.setAttribute('aria-hidden', String(i !== index));
  });
  selectors.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
}
function syncHeroMotion() {
  clearInterval(rotationTimer);
  const idle = !heroVisible || document.hidden;
  heroScene.classList.toggle('motion-paused', motionPaused || reducedMotion.matches);
  heroScene.classList.toggle('motion-idle', idle);
  motionToggle.setAttribute('aria-pressed', String(motionPaused));
  motionToggle.setAttribute('aria-label', motionPaused ? 'Resume hero motion' : 'Pause hero motion');
  motionToggle.querySelector('span:first-child').textContent = motionPaused ? '▷' : 'Ⅱ';
  motionToggle.querySelector('.motion-label').textContent = motionPaused ? 'Resume motion' : 'Pause motion';
  if (!motionPaused && !reducedMotion.matches && !idle && !showcaseEngaged) {
    rotationTimer = setInterval(() => showSlide((activeSlide + 1) % slides.length), 6500);
  }
}
selectors.forEach(button => button.addEventListener('click', () => {
  showSlide(Number(button.dataset.showcase));
  syncHeroMotion();
}));
motionToggle.addEventListener('click', () => { motionPaused = !motionPaused; syncHeroMotion(); });
function updateEngagement() {
  showcaseEngaged = showcase.matches(':hover') || showcase.contains(document.activeElement);
  syncHeroMotion();
}
showcase.addEventListener('mouseenter', updateEngagement);
showcase.addEventListener('mouseleave', updateEngagement);
showcase.addEventListener('focusin', updateEngagement);
showcase.addEventListener('focusout', () => setTimeout(updateEngagement, 0));
reducedMotion.addEventListener('change', syncHeroMotion);
document.addEventListener('visibilitychange', syncHeroMotion);
new IntersectionObserver(entries => {
  heroVisible = entries[0].isIntersecting;
  syncHeroMotion();
}, {threshold:0.1}).observe(heroScene);
syncHeroMotion();
