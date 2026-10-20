function initTheme() {
  const root = document.documentElement;
  const themeButtons = document.querySelectorAll('[data-theme-toggle]');
  const mobileButton = document.querySelector('[data-mobile-menu]');
  const nav = document.querySelector('.primary-nav');

  function applyTheme(theme) {
    root.dataset.theme = theme;
    try {
      localStorage.setItem('onlinebiblia-theme', theme);
    } catch (_) {}
    themeButtons.forEach((button) => {
      button.setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
      button.setAttribute('title', theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro');
    });
  }

  let savedTheme = 'dark';
  try {
    savedTheme = localStorage.getItem('onlinebiblia-theme') || 'dark';
  } catch (_) {}
  applyTheme(savedTheme === 'light' ? 'light' : 'dark');

  themeButtons.forEach((button) => {
    button.onclick = () => {
      applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    };
  });

  if (mobileButton && nav) {
    mobileButton.onclick = () => {
      const isOpen = mobileButton.getAttribute('aria-expanded') === 'true';
      mobileButton.setAttribute('aria-expanded', String(!isOpen));
      nav.classList.toggle('is-open', !isOpen);
    };

    nav.querySelectorAll('a').forEach((link) => {
      link.onclick = () => {
        nav.classList.remove('is-open');
        mobileButton.setAttribute('aria-expanded', 'false');
      };
    });
  }
}

initTheme();
document.addEventListener('astro:page-load', initTheme);
