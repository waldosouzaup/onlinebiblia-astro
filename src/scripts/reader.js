const $ = (selector) => document.querySelector(selector);

const languageFiles = { pt: '/data/bible-pt.json', en: '/data/bible-en.json' };
const state = {
  bibles: {},
  version: 'pt',
  testament: 'all',
  bookId: null,
  chapter: 1,
  verse: 1,
  fontSize: 20,
};

const ALIAS_MAP = {
  romans: 'romanos',
  john: 'joao',
  psalms: 'salmos',
  genesis: 'genesis',
  proverbs: 'proverbios',
  jeremiah: 'jeremias',
  '1-corinthians': '1-corintios',
  '2-corinthians': '2-corintios',
  philippians: 'filipenses',
  hebrews: 'hebreus',
  james: 'tiago',
  ephesians: 'efesios',
  '1-john': '1-joao',
};

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g);
}

function asEntries(value) {
  if (Array.isArray(value)) return value.map((item, index) => [index + 1, item]);
  if (value && typeof value === 'object') return Object.entries(value).sort((a, b) => Number(a[0]) - Number(b[0]));
  return [];
}

function normalizeVerses(rawVerses) {
  return asEntries(rawVerses)
    .map(([key, rawVerse], index) => {
      if (typeof rawVerse === 'string' || typeof rawVerse === 'number') {
        return { verse: Number(key) || index + 1, text: String(rawVerse) };
      }
      if (!rawVerse || typeof rawVerse !== 'object') return null;
      const verseNumber = Number(rawVerse.verse ?? rawVerse.number ?? rawVerse.verseNumber ?? rawVerse.id ?? key) || index + 1;
      const text = rawVerse.text ?? rawVerse.content ?? rawVerse.body ?? rawVerse.verseText ?? rawVerse.value ?? '';
      return { verse: verseNumber, text: String(text) };
    })
    .filter((verse) => verse && verse.text.trim())
    .sort((a, b) => a.verse - b.verse);
}

function normalizeChapters(rawBook) {
  const source = rawBook.chapters ?? rawBook.chapter ?? [];
  let chapters;
  if (Array.isArray(source)) {
    chapters = source.map((item, index) => {
      if (Array.isArray(item)) return { chapter: index + 1, verses: normalizeVerses(item) };
      if (typeof item === 'string') return { chapter: index + 1, verses: normalizeVerses([item]) };
      if (!item || typeof item !== 'object') return null;
      const number = Number(item.chapter ?? item.number ?? item.chapterNumber ?? item.id ?? index + 1) || index + 1;
      return { chapter: number, verses: normalizeVerses(item.verses ?? item.items ?? item.texts ?? item) };
    });
  } else if (source && typeof source === 'object') {
    chapters = Object.entries(source).map(([key, value]) => {
      if (Array.isArray(value)) return { chapter: Number(key) || 1, verses: normalizeVerses(value) };
      if (value && typeof value === 'object') return { chapter: Number(value.chapter ?? value.number ?? key) || 1, verses: normalizeVerses(value.verses ?? value.items ?? value) };
      return { chapter: Number(key) || 1, verses: normalizeVerses([value]) };
    });
  } else {
    chapters = [];
  }
  return chapters.filter((chapter) => chapter && chapter.verses.length).sort((a, b) => a.chapter - b.chapter);
}

function normalizeBible(raw, language) {
  const sourceBooks = raw?.books ?? raw?.data?.books ?? raw?.scriptures ?? (Array.isArray(raw) ? raw : []);
  const books = (Array.isArray(sourceBooks) ? sourceBooks : Object.values(sourceBooks))
    .map((book, index) => {
      const name = String(book.name ?? book.title ?? book.book ?? book.bookName ?? `Livro ${index + 1}`);
      let testamentValue = String(book.testament ?? book.testamentName ?? book.part ?? '').toLowerCase();
      let testament = /new|novo|nt|new testament/.test(testamentValue) ? 'new' : /old|antigo|ot|old testament/.test(testamentValue) ? 'old' : index < 39 ? 'old' : 'new';
      return {
        id: String(book.id ?? book.slug ?? slugify(name)),
        name,
        testament,
        chapters: normalizeChapters(book),
      };
    })
    .filter((book) => book.chapters.length);
  return {
    language,
    versionLabel: raw?.versionLabel ?? raw?.version ?? (language === 'pt' ? 'NVI' : 'KJV'),
    isDemo: Boolean(raw?.isDemo ?? raw?.demo ?? false),
    books,
  };
}

async function fetchBible(language) {
  const response = await fetch(languageFiles[language], { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Não foi possível abrir ${languageFiles[language]}`);
  return normalizeBible(await response.json(), language);
}

function currentBible() {
  return state.bibles[state.version];
}
function currentBook() {
  return currentBible()?.books.find((book) => book.id === state.bookId) || currentBible()?.books[0] || null;
}
function currentChapter(book = currentBook()) {
  return book?.chapters.find((chapter) => chapter.chapter === Number(state.chapter)) || book?.chapters[0] || null;
}
function getBookById(bible, id) {
  if (!bible || !id) return null;
  const target = String(id).toLowerCase().trim();
  const canonical = ALIAS_MAP[target] || target;
  return (
    bible.books.find(
      (book) =>
        book.id === canonical ||
        book.id === target ||
        slugify(book.name) === target ||
        slugify(book.name) === canonical
    ) || null
  );
}
function getAvailableChapters() {
  const bible = currentBible();
  return (bible?.books || []).flatMap((book, bookIndex) =>
    book.chapters.map((chapter) => ({ bookId: book.id, chapter: chapter.chapter, bookIndex }))
  );
}

function addOptions(select, options, selectedValue, emptyLabel = null) {
  if (!select) return;
  select.replaceChildren();
  if (!options.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = emptyLabel || 'Sem opções';
    select.append(option);
    select.disabled = true;
    return;
  }
  for (const item of options) {
    const option = document.createElement('option');
    option.value = String(item.value);
    option.textContent = item.label;
    option.selected = String(item.value) === String(selectedValue);
    select.append(option);
  }
  select.disabled = false;
}

function updateBookOptions() {
  const bookSelect = $('#book-select');
  if (!bookSelect) return;
  const bible = currentBible();
  if (!bible) return;
  const current = currentBook();
  let visibleBooks = bible.books.filter((book) => state.testament === 'all' || book.testament === state.testament);
  if (!visibleBooks.length) visibleBooks = bible.books;
  if (!visibleBooks.some((book) => book.id === current?.id)) state.bookId = visibleBooks[0].id;
  addOptions(bookSelect, visibleBooks.map((book) => ({ value: book.id, label: book.name })), state.bookId);
  updateChapterOptions();
}

function updateChapterOptions() {
  const chapterSelect = $('#chapter-select');
  if (!chapterSelect) return;
  const book = currentBook();
  if (!book) return;
  const chapters = book.chapters;
  if (!chapters.some((chapter) => chapter.chapter === Number(state.chapter))) state.chapter = chapters[0]?.chapter ?? 1;
  addOptions(chapterSelect, chapters.map((chapter) => ({ value: chapter.chapter, label: String(chapter.chapter) })), state.chapter);
  updateVerseOptions();
}

function updateVerseOptions() {
  const verseSelect = $('#verse-select');
  if (!verseSelect) return;
  const chapter = currentChapter();
  const verses = chapter?.verses || [];
  if (!verses.some((verse) => verse.verse === Number(state.verse))) state.verse = verses[0]?.verse ?? 1;
  addOptions(verseSelect, verses.map((verse) => ({ value: verse.verse, label: String(verse.verse) })), state.verse);
}

function updateVersionButtons() {
  const versionButtons = document.querySelectorAll('[data-version]');
  versionButtons.forEach((button) => {
    const isActive = button.dataset.version === state.version;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function updateTestamentButtons() {
  const testamentButtons = document.querySelectorAll('[data-testament]');
  testamentButtons.forEach((button) => {
    const isActive = button.dataset.testament === state.testament;
    button.classList.toggle('is-selected', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function updateUrl() {
  const params = new URLSearchParams(window.location.search);
  params.set('book', state.bookId || '');
  params.set('chapter', String(state.chapter));
  params.set('verse', String(state.verse));
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', nextUrl);
}

function renderChapter({ scrollToVerse = false } = {}) {
  const currentRef = $('#current-ref');
  const chapterCount = $('#chapter-count');
  const versionLabel = $('#version-label');
  const demoNotice = $('#demo-notice');
  const readingStatus = $('#reading-status');
  const readingContent = $('#reading-content');
  const previousButton = $('#previous-chapter');
  const nextButton = $('#next-chapter');
  const verseSelect = $('#verse-select');

  if (!readingContent) return;

  const bible = currentBible();
  const book = currentBook();
  const chapter = currentChapter(book);
  if (!bible || !book || !chapter) {
    if (currentRef) currentRef.textContent = 'Conteúdo não encontrado';
    readingContent.replaceChildren();
    if (readingStatus) readingStatus.textContent = 'Confira se o arquivo JSON contém livros, capítulos e versículos.';
    if (previousButton) previousButton.disabled = true;
    if (nextButton) nextButton.disabled = true;
    return;
  }

  if (currentRef) currentRef.textContent = `${book.name} ${chapter.chapter}`;
  if (chapterCount) chapterCount.textContent = `Capítulo ${chapter.chapter}`;
  if (versionLabel) {
    versionLabel.textContent = bible.versionLabel;
    versionLabel.title = `Versão carregada: ${bible.versionLabel}`;
  }
  if (demoNotice) demoNotice.hidden = !bible.isDemo;
  if (readingStatus) readingStatus.textContent = '';
  readingContent.replaceChildren();

  for (const verse of chapter.verses) {
    const paragraph = document.createElement('p');
    paragraph.className = 'verse-line';
    paragraph.id = `verse-${verse.verse}`;
    if (Number(verse.verse) === Number(state.verse)) paragraph.classList.add('is-highlighted');

    const number = document.createElement('button');
    number.type = 'button';
    number.className = 'verse-number';
    number.textContent = String(verse.verse);
    number.setAttribute('aria-label', `Selecionar versículo ${verse.verse}`);
    number.addEventListener('click', () => {
      state.verse = verse.verse;
      if (verseSelect) verseSelect.value = String(verse.verse);
      readingContent.querySelectorAll('.verse-line').forEach((line) => line.classList.toggle('is-highlighted', line.id === `verse-${verse.verse}`));
      updateUrl();
    });
    paragraph.append(number, document.createTextNode(verse.text));
    readingContent.append(paragraph);
  }

  const positions = getAvailableChapters();
  const currentIndex = positions.findIndex((item) => item.bookId === book.id && item.chapter === chapter.chapter);
  const dockPrev = $('#dock-previous-chapter');
  const dockNext = $('#dock-next-chapter');
  if (previousButton) previousButton.disabled = currentIndex <= 0;
  if (dockPrev) dockPrev.disabled = currentIndex <= 0;
  if (nextButton) nextButton.disabled = currentIndex < 0 || currentIndex >= positions.length - 1;
  if (dockNext) dockNext.disabled = currentIndex < 0 || currentIndex >= positions.length - 1;
  updateUrl();
  if (scrollToVerse) {
    requestAnimationFrame(() => document.getElementById(`verse-${state.verse}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }
}

function renderAll() {
  updateVersionButtons();
  updateTestamentButtons();
  updateBookOptions();
  renderChapter();
}

function navigateChapter(direction) {
  const chapters = getAvailableChapters();
  const index = chapters.findIndex((item) => item.bookId === state.bookId && item.chapter === Number(state.chapter));
  const next = chapters[index + direction];
  if (!next) return;
  state.bookId = next.bookId;
  state.chapter = next.chapter;
  state.verse = currentChapter(getBookById(currentBible(), next.bookId))?.verses?.[0]?.verse ?? 1;
  updateBookOptions();
  renderChapter();
}

function closeMobileSelection() {
  const panel = $('#selection-panel');
  const backdrop = $('#selection-backdrop');
  const toggleBtn = $('#toggle-selection-panel');
  if (panel) panel.classList.remove('is-open');
  if (backdrop) backdrop.classList.remove('is-active');
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

function openReference(bookId, chapterNumber, verseNumber, { scroll = true } = {}) {
  const book = getBookById(currentBible(), bookId) || currentBible()?.books[0];
  if (!book) return;
  state.bookId = book.id;
  state.chapter = Number(chapterNumber) || book.chapters[0]?.chapter || 1;
  state.verse = Number(verseNumber) || 1;
  updateBookOptions();
  updateChapterOptions();
  updateVerseOptions();
  renderChapter({ scrollToVerse: scroll });
  if (window.innerWidth <= 780) {
    closeMobileSelection();
  }
}

function runSearch(event) {
  event?.preventDefault();
  const searchInput = $('#bible-search');
  const searchResults = $('#search-results');
  if (!searchInput || !searchResults) return;

  const term = searchInput.value.trim().toLocaleLowerCase(state.version === 'pt' ? 'pt-BR' : 'en-US');
  searchResults.replaceChildren();
  if (!term) return;

  const bible = currentBible();
  if (!bible) return;

  const matches = [];
  for (const book of bible.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        if (verse.text.toLocaleLowerCase(state.version === 'pt' ? 'pt-BR' : 'en-US').includes(term)) {
          matches.push({ book, chapter, verse });
          if (matches.length >= 12) break;
        }
      }
      if (matches.length >= 12) break;
    }
    if (matches.length >= 12) break;
  }

  const heading = document.createElement('p');
  heading.className = 'search-results-title';
  heading.textContent = matches.length ? `${matches.length}${matches.length === 12 ? '+' : ''} resultado(s)` : 'Nenhum resultado';
  searchResults.append(heading);

  if (!matches.length) {
    const empty = document.createElement('p');
    empty.className = 'search-empty';
    empty.textContent = 'Tente outra palavra ou expressão.';
    searchResults.append(empty);
    return;
  }

  for (const match of matches) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result';
    const title = document.createElement('strong');
    title.textContent = `${match.book.name} ${match.chapter.chapter}:${match.verse.verse}`;
    const excerpt = document.createElement('span');
    excerpt.textContent = match.verse.text;
    button.append(title, excerpt);
    button.addEventListener('click', () => {
      state.testament = 'all';
      updateTestamentButtons();
      openReference(match.book.id, match.chapter.chapter, match.verse.verse);
      searchResults.replaceChildren();
    });
    searchResults.append(button);
  }
}

function bindEvents() {
  const bookSelect = $('#book-select');
  const chapterSelect = $('#chapter-select');
  const verseSelect = $('#verse-select');
  const previousButton = $('#previous-chapter');
  const nextButton = $('#next-chapter');
  const searchForm = $('#search-form');
  const searchInput = $('#bible-search');
  const searchResults = $('#search-results');
  const fontDown = $('#font-decrease');
  const fontUp = $('#font-increase');
  const testamentButtons = document.querySelectorAll('[data-testament]');
  const versionButtons = document.querySelectorAll('[data-version]');

  bookSelect?.addEventListener('change', () => {
    state.bookId = bookSelect.value;
    const book = currentBook();
    state.chapter = book?.chapters[0]?.chapter ?? 1;
    state.verse = book?.chapters[0]?.verses[0]?.verse ?? 1;
    updateChapterOptions();
    renderChapter();
  });

  chapterSelect?.addEventListener('change', () => {
    state.chapter = Number(chapterSelect.value);
    state.verse = currentChapter()?.verses?.[0]?.verse ?? 1;
    updateVerseOptions();
    renderChapter();
    if (window.innerWidth <= 780) {
      closeMobileSelection();
    }
  });

  verseSelect?.addEventListener('change', () => {
    state.verse = Number(verseSelect.value);
    renderChapter({ scrollToVerse: true });
    if (window.innerWidth <= 780) {
      closeMobileSelection();
    }
  });

  const updateFontSize = (size) => {
    state.fontSize = Math.min(32, Math.max(16, size));
    document.documentElement.style.setProperty('--reading-size', `${state.fontSize}px`);
    localStorage.setItem('onlinebiblia-font-size', String(state.fontSize));
    const scaleText = $('#dock-scale-text');
    if (scaleText) {
      const ratio = (state.fontSize / 20).toFixed(1);
      scaleText.textContent = state.fontSize === 20 ? '1x' : `${ratio}x`;
    }
  };

  const dockPrev = $('#dock-previous-chapter');
  const dockNext = $('#dock-next-chapter');
  const dockFontDown = $('#dock-font-decrease');
  const dockFontUp = $('#dock-font-increase');
  const dockFontReset = $('#dock-font-reset');
  const dockFocusToggle = $('#dock-focus-toggle');

  previousButton?.addEventListener('click', () => navigateChapter(-1));
  dockPrev?.addEventListener('click', () => navigateChapter(-1));
  nextButton?.addEventListener('click', () => navigateChapter(1));
  dockNext?.addEventListener('click', () => navigateChapter(1));

  searchForm?.addEventListener('submit', runSearch);
  searchInput?.addEventListener('input', () => {
    if (!searchInput.value.trim() && searchResults) searchResults.replaceChildren();
  });

  fontDown?.addEventListener('click', () => updateFontSize(state.fontSize - 1));
  dockFontDown?.addEventListener('click', () => updateFontSize(state.fontSize - 1));

  fontUp?.addEventListener('click', () => updateFontSize(state.fontSize + 1));
  dockFontUp?.addEventListener('click', () => updateFontSize(state.fontSize + 1));

  dockFontReset?.addEventListener('click', () => updateFontSize(20));

  dockFocusToggle?.addEventListener('click', () => {
    const isFocus = document.body.classList.toggle('is-focus-mode');
    dockFocusToggle.classList.toggle('is-active', isFocus);
    dockFocusToggle.setAttribute('aria-pressed', String(isFocus));
  });

  // Mobile selection drawer
  const toggleSelectionBtn = $('#toggle-selection-panel');
  const closeSelectionBtn = $('#close-selection-panel');
  const selectionPanel = $('#selection-panel');
  const selectionBackdrop = $('#selection-backdrop');

  function openMobileSelection() {
    selectionPanel?.classList.add('is-open');
    selectionBackdrop?.classList.add('is-active');
    toggleSelectionBtn?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  toggleSelectionBtn?.addEventListener('click', openMobileSelection);
  closeSelectionBtn?.addEventListener('click', closeMobileSelection);
  selectionBackdrop?.addEventListener('click', closeMobileSelection);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (selectionPanel?.classList.contains('is-open')) {
        closeMobileSelection();
      }
      if (document.body.classList.contains('is-focus-mode')) {
        document.body.classList.remove('is-focus-mode');
        dockFocusToggle?.classList.remove('is-active');
        dockFocusToggle?.setAttribute('aria-pressed', 'false');
      }
    }
  });

  testamentButtons.forEach((button) =>
    button.addEventListener('click', () => {
      state.testament = button.dataset.testament;
      updateTestamentButtons();
      updateBookOptions();
      renderChapter();
    })
  );

  versionButtons.forEach((button) =>
    button.addEventListener('click', async () => {
      const version = button.dataset.version;
      if (version === state.version || !languageFiles[version]) return;
      state.version = version;
      if (!state.bibles[version]) {
        const readingStatus = $('#reading-status');
        if (readingStatus) readingStatus.textContent = 'Carregando versão…';
        try {
          state.bibles[version] = await fetchBible(version);
        } catch (error) {
          if (readingStatus) readingStatus.textContent = 'Não foi possível carregar essa versão.';
          return;
        }
      }
      const newBible = currentBible();
      if (!getBookById(newBible, state.bookId)) state.bookId = newBible.books[0]?.id ?? null;
      const book = currentBook();
      if (!book?.chapters.some((chapter) => chapter.chapter === Number(state.chapter))) state.chapter = book?.chapters[0]?.chapter ?? 1;
      state.verse = currentChapter(book)?.verses?.some((verse) => verse.verse === Number(state.verse))
        ? state.verse
        : currentChapter(book)?.verses?.[0]?.verse ?? 1;
      renderAll();
    })
  );
}

async function init() {
  const footerYear = document.querySelector('#footer-year');
  if (footerYear) footerYear.textContent = String(new Date().getFullYear());

  const readingContent = $('#reading-content');
  if (!readingContent) return; // Not on the reader page

  bindEvents();

  const params = new URLSearchParams(window.location.search);
  const requestedBook = params.get('book');
  const requestedChapter = Number(params.get('chapter')) || 1;
  const requestedVerse = Number(params.get('verse')) || 1;

  try {
    if (!state.bibles.pt) {
      state.bibles.pt = await fetchBible('pt');
    }
    try {
      if (!state.bibles.en) state.bibles.en = await fetchBible('en');
    } catch (error) {
      console.warn('Versão em inglês não carregada:', error);
    }
    if (!state.bibles.en) {
      const englishButton = document.querySelector('[data-version="en"]');
      if (englishButton) englishButton.disabled = true;
    }

    state.bookId = requestedBook && getBookById(currentBible(), requestedBook)
      ? getBookById(currentBible(), requestedBook).id
      : currentBible()?.books[0]?.id ?? null;
    state.chapter = requestedChapter;
    state.verse = requestedVerse;
    renderAll();

    const book = currentBook();
    if (book && !book.chapters.some((chapter) => chapter.chapter === requestedChapter)) {
      state.chapter = book.chapters[0]?.chapter ?? 1;
      state.verse = book.chapters[0]?.verses[0]?.verse ?? 1;
      updateChapterOptions();
      updateVerseOptions();
      renderChapter();
    }
  } catch (error) {
    console.error(error);
    const currentRef = $('#current-ref');
    const readingStatus = $('#reading-status');
    if (currentRef) currentRef.textContent = 'Não foi possível carregar a Bíblia';
    if (readingStatus) readingStatus.textContent = 'Confira se public/data/bible-pt.json existe e contém JSON válido.';
    if (readingContent) readingContent.replaceChildren();
  }
}

init();
document.addEventListener('astro:page-load', init);
