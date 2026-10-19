let state = { topics: [], category: 'Todos', books: new Map() };

const symbols = {
  'Relacionamentos': '♡',
  'Vida espiritual': '✦',
  'Emoções e cuidado': '☼',
  'Vida prática': '⌁',
  'Temas bíblicos': '❋',
};

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function formatReference(reference) {
  const name = state.books.get(reference.bookId) || reference.bookId;
  return `${name} ${reference.chapter}:${reference.verse}`;
}

function buildCategoryFilters(container, onSelect) {
  if (!container) return;
  const categories = ['Todos', ...new Set(state.topics.map((topic) => topic.category).filter(Boolean))];
  container.replaceChildren();
  for (const category of categories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `category-chip${state.category === category ? ' is-selected' : ''}`;
    button.textContent = category;
    button.setAttribute('aria-pressed', String(state.category === category));
    button.addEventListener('click', () => {
      state.category = category;
      buildCategoryFilters(container, onSelect);
      onSelect();
    });
    container.append(button);
  }
}

function renderTopics(grid, statusEl, searchInput) {
  if (!grid) return;
  const query = normalized(searchInput?.value.trim() || '');
  const topics = state.topics.filter((topic) => {
    const matchesCategory = state.category === 'Todos' || topic.category === state.category;
    const searchable = normalized(`${topic.title} ${topic.category} ${topic.description} ${(topic.references || []).map(formatReference).join(' ')}`);
    return matchesCategory && (!query || searchable.includes(query));
  });

  grid.replaceChildren();
  if (!topics.length) {
    const empty = document.createElement('div');
    empty.className = 'no-topics';
    empty.textContent = 'Nenhum tema encontrado. Tente outro termo ou categoria.';
    grid.append(empty);
    if (statusEl) statusEl.textContent = '0 temas';
    return;
  }

  topics.forEach((topic) => {
    const card = document.createElement('article');
    card.className = 'topic-card';
    const top = document.createElement('div');
    top.className = 'topic-card-top';
    const symbol = document.createElement('span');
    symbol.className = 'topic-symbol';
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = symbols[topic.category] || '✧';
    const titleBlock = document.createElement('div');
    const category = document.createElement('div');
    category.className = 'topic-category';
    category.textContent = topic.category || 'Tema bíblico';
    const title = document.createElement('h3');
    title.textContent = topic.title;
    titleBlock.append(category, title);
    top.append(symbol, titleBlock);

    const description = document.createElement('p');
    description.textContent = topic.description || '';

    const refs = document.createElement('div');
    refs.className = 'topic-references';
    (topic.references || []).forEach((reference) => {
      const link = document.createElement('a');
      link.className = 'reference-chip';
      const ch = Number(reference.chapter) || 1;
      const v = Number(reference.verse) || 1;
      link.href = `/biblia/${encodeURIComponent(reference.bookId)}/${ch}/#verse-${v}`;
      link.textContent = formatReference(reference);
      link.setAttribute('aria-label', `Ler ${formatReference(reference)} na Bíblia`);
      refs.append(link);
    });

    card.append(top, description, refs);
    grid.append(card);
  });

  if (statusEl) {
    statusEl.textContent = `${topics.length} ${topics.length === 1 ? 'tema encontrado' : 'temas encontrados'}`;
  }
}

async function initConcordance() {
  const topicSearch = document.querySelector('#topic-search');
  const categoryFilters = document.querySelector('#category-filters');
  const topicsGrid = document.querySelector('#topics-grid');
  const topicsStatus = document.querySelector('#topics-status');
  const footerYear = document.querySelector('#footer-year');

  if (!topicsGrid) return;
  if (footerYear) footerYear.textContent = String(new Date().getFullYear());

  const triggerRender = () => renderTopics(topicsGrid, topicsStatus, topicSearch);
  topicSearch?.addEventListener('input', triggerRender);

  if (state.topics.length && state.books.size) {
    buildCategoryFilters(categoryFilters, triggerRender);
    triggerRender();
    return;
  }

  try {
    const [concordanceResponse, bibleResponse] = await Promise.all([
      fetch('/data/concordance.json'),
      fetch('/data/bible-pt.json')
    ]);
    if (!concordanceResponse.ok || !bibleResponse.ok) throw new Error('Arquivos não encontrados.');
    const concordance = await concordanceResponse.json();
    const bible = await bibleResponse.json();

    const books = Array.isArray(bible.books) ? bible.books : Object.values(bible.books || {});
    books.forEach((book) => {
      const id = String(book.id ?? book.slug ?? book.name ?? book.title ?? '');
      const name = String(book.name ?? book.title ?? book.book ?? id);
      state.books.set(id, name);
    });

    state.topics = Array.isArray(concordance.topics) ? concordance.topics : [];
    buildCategoryFilters(categoryFilters, triggerRender);
    triggerRender();
  } catch (error) {
    console.error(error);
    topicsGrid.replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'no-topics';
    empty.textContent = 'Não foi possível carregar os temas. Confira public/data/concordance.json.';
    topicsGrid.append(empty);
    if (topicsStatus) topicsStatus.textContent = '';
  }
}

initConcordance();
document.addEventListener('astro:page-load', initConcordance);
