// Client-side instant filter for pre-rendered Concordance cards
function normalized(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function initConcordance() {
  const topicSearch = document.querySelector('#topic-search');
  const categoryFilters = document.querySelector('#category-filters');
  const topicsGrid = document.querySelector('#topics-grid');
  const topicsStatus = document.querySelector('#topics-status');
  const footerYear = document.querySelector('#footer-year');

  if (!topicsGrid) return;
  if (footerYear) footerYear.textContent = String(new Date().getFullYear());

  const cards = Array.from(topicsGrid.querySelectorAll('.topic-card'));
  if (!cards.length) return;

  let currentCategory = 'Todos';

  function filterCards() {
    const query = normalized(topicSearch?.value.trim() || '');
    let visibleCount = 0;

    cards.forEach((card) => {
      const cardCategory = card.getAttribute('data-category') || '';
      const searchable = card.getAttribute('data-searchable') || '';
      const matchesCategory = currentCategory === 'Todos' || cardCategory === currentCategory;
      const matchesSearch = !query || normalized(searchable).includes(query);

      if (matchesCategory && matchesSearch) {
        card.style.display = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    // Handle empty state
    let emptyMsg = topicsGrid.querySelector('.no-topics-dynamic');
    if (visibleCount === 0) {
      if (!emptyMsg) {
        emptyMsg = document.createElement('div');
        emptyMsg.className = 'no-topics no-topics-dynamic';
        emptyMsg.textContent = 'Nenhum tema encontrado para os filtros selecionados.';
        topicsGrid.appendChild(emptyMsg);
      }
    } else if (emptyMsg) {
      emptyMsg.remove();
    }

    if (topicsStatus) {
      topicsStatus.textContent = `${visibleCount} ${visibleCount === 1 ? 'tema encontrado' : 'temas encontrados'}`;
    }
  }

  // Bind category buttons
  if (categoryFilters) {
    categoryFilters.querySelectorAll('.category-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        categoryFilters.querySelectorAll('.category-chip').forEach((b) => {
          b.classList.remove('is-selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('is-selected');
        btn.setAttribute('aria-pressed', 'true');
        currentCategory = btn.getAttribute('data-category') || 'Todos';
        filterCards();
      });
    });
  }

  // Bind search input
  topicSearch?.addEventListener('input', filterCards);
}

initConcordance();
document.addEventListener('astro:page-load', initConcordance);

