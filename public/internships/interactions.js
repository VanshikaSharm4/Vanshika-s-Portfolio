// Portfolio interactions are local; no form data or photographs are sent anywhere.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if ('IntersectionObserver' in window && !reducedMotion) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.07 });
  document.querySelectorAll('.reveal').forEach((section) => { section.classList.add('reveal-ready'); observer.observe(section); });
}

const photoDialog = document.querySelector('#photo-dialog');
if (photoDialog) {
  document.querySelectorAll('[data-photo]').forEach((button) => {
    button.addEventListener('click', () => {
      photoDialog.querySelector('img').src = button.dataset.photo;
      photoDialog.querySelector('img').alt = button.querySelector('img').alt;
      photoDialog.querySelector('p').textContent = button.dataset.caption;
      photoDialog.showModal();
    });
  });
  photoDialog.querySelector('.close-dialog').addEventListener('click', () => photoDialog.close());
  photoDialog.addEventListener('click', (event) => { if (event.target === photoDialog) photoDialog.close(); });
}

const stages = document.querySelectorAll('[data-stage]');
stages.forEach((button) => {
  button.addEventListener('click', () => {
    stages.forEach((stage) => stage.setAttribute('aria-pressed', String(stage === button)));
    document.querySelector('#stage-number').textContent = button.dataset.stage;
    document.querySelector('#stage-title').textContent = button.dataset.title;
    document.querySelector('#stage-description').textContent = button.dataset.description;
    document.querySelector('#stage-output').textContent = button.dataset.output;
  });
});

const riskInput = document.querySelector('#risk-input');
if (riskInput) {
  const updateRisk = () => {
    const risk = Number(riskInput.value);
    const state = risk < 30 ? 'go' : risk < 65 ? 'hold' : 'no-go';
    const result = document.querySelector('#risk-result');
    result.dataset.state = state;
    document.querySelector('#risk-value').textContent = `${risk}%`;
    document.querySelector('#risk-label').textContent = state.toUpperCase();
    document.querySelector('#risk-description').textContent = state === 'go'
      ? 'Lower illustrative risk. Review the evidence before proceeding.'
      : state === 'hold' ? 'Uncertain territory. Investigate the signals before making a decision.'
      : 'Elevated illustrative risk. Resolve the blockers and reassess.';
  };
  riskInput.addEventListener('input', updateRisk);
  updateRisk();
}

const sectionLinks = document.querySelectorAll('.case-nav a');
if (sectionLinks.length && 'IntersectionObserver' in window) {
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      sectionLinks.forEach((link) => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-15% 0px -60% 0px' });
  document.querySelectorAll('main section[id]').forEach((section) => sectionObserver.observe(section));
}
