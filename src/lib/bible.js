import booksMeta from '../data/books.json';
import nviRaw from '../data/bibles/nvi.json';
import acfRaw from '../data/bibles/acf.json';
import aaRaw from '../data/bibles/aa.json';
import enNivRaw from '../data/bibles/en_niv.json';

const versions = {
  nvi: { label: 'NVI', name: 'Nova Versão Internacional', data: nviRaw },
  acf: { label: 'ACF', name: 'Almeida Corrigida Fiel', data: acfRaw },
  aa: { label: 'AA', name: 'Almeida Atualizada', data: aaRaw },
  en_niv: { label: 'NIV', name: 'New International Version', data: enNivRaw },
};

// English testament groups mapping
const ENGLISH_GROUPS = {
  'Pentateuco': 'Pentateuch',
  'Históricos': 'Historical Books',
  'Poéticos e Sapienciais': 'Poetry & Wisdom',
  'Profetas Maiores': 'Major Prophets',
  'Profetas Menores': 'Minor Prophets',
  'Evangelhos': 'Gospels',
  'Histórico': 'History',
  'Cartas Paulinas': 'Pauline Epistles',
  'Cartas Gerais': 'General Epistles',
  'Profético': 'Apocalyptic / Prophecy',
};

// Add English metadata
const booksWithEn = booksMeta.map((b) => ({
  ...b,
  testamentNameEn: b.testament === 'old' ? 'Old Testament' : 'New Testament',
  groupEn: ENGLISH_GROUPS[b.group] || b.group,
}));

// Quick map for Portuguese and alias lookup
const aliasMap = new Map();
booksWithEn.forEach((book) => {
  aliasMap.set(book.slug.toLowerCase(), book);
  aliasMap.set(book.id.toLowerCase(), book);
});
booksWithEn.forEach((book) => {
  const abbrevKey = book.abbrev.toLowerCase();
  if (!aliasMap.has(abbrevKey)) {
    aliasMap.set(abbrevKey, book);
  }
  if (book.aliases) {
    book.aliases.forEach((alias) => {
      const aliasKey = String(alias).toLowerCase();
      if (!aliasMap.has(aliasKey)) {
        aliasMap.set(aliasKey, book);
      }
    });
  }
});

// Quick map for English lookup
const englishAliasMap = new Map();
booksWithEn.forEach((book) => {
  englishAliasMap.set(book.slugEn.toLowerCase(), book);
  englishAliasMap.set(book.nameEn.toLowerCase(), book);
  englishAliasMap.set(book.slug.toLowerCase(), book);
  if (book.aliases) {
    book.aliases.forEach((alias) => {
      const aliasKey = String(alias).toLowerCase();
      if (!englishAliasMap.has(aliasKey)) {
        englishAliasMap.set(aliasKey, book);
      }
    });
  }
});

// All 1,189 chapters flat list
const flatChapters = [];
booksWithEn.forEach((book, bookIdx) => {
  for (let ch = 1; ch <= book.chaptersCount; ch++) {
    flatChapters.push({
      flatIndex: flatChapters.length,
      bookIdx,
      bookSlug: book.slug,
      bookSlugEn: book.slugEn,
      bookName: book.name,
      bookNameEn: book.nameEn,
      chapter: ch,
    });
  }
});

export function getAllBooks() {
  return booksWithEn;
}

export function getBook(idOrSlugOrAbbrev) {
  if (!idOrSlugOrAbbrev) return booksWithEn[0];
  const query = String(idOrSlugOrAbbrev).toLowerCase().trim();
  return (
    aliasMap.get(query) ||
    englishAliasMap.get(query) ||
    booksWithEn.find((b) => b.slug === query || b.slugEn === query || b.abbrev === query) ||
    null
  );
}

export function getEnglishBook(idOrSlugOrName) {
  if (!idOrSlugOrName) return booksWithEn[0];
  const query = String(idOrSlugOrName).toLowerCase().trim();
  return (
    englishAliasMap.get(query) ||
    aliasMap.get(query) ||
    booksWithEn.find((b) => b.slugEn === query || b.slug === query) ||
    null
  );
}

export function getAvailableVersions() {
  return Object.entries(versions).map(([key, v]) => ({
    id: key,
    label: v.label,
    name: v.name,
  }));
}

// Portuguese chapter retrieval
export function getChapter(bookSlug, chapterNumber, version = 'nvi') {
  const book = getBook(bookSlug);
  if (!book) return null;

  const chNum = Number(chapterNumber);
  if (chNum < 1 || chNum > book.chaptersCount) return null;

  const currentVersion = versions[version] || versions.nvi;
  const rawBook = currentVersion.data[book.order - 1];
  const rawVerses = rawBook?.chapters?.[chNum - 1] || [];

  const verses = rawVerses.map((text, idx) => ({
    verse: idx + 1,
    text: String(text).trim(),
  }));

  const currentFlatIdx = flatChapters.findIndex(
    (item) => item.bookSlug === book.slug && item.chapter === chNum
  );

  const prevItem = currentFlatIdx > 0 ? flatChapters[currentFlatIdx - 1] : null;
  const nextItem =
    currentFlatIdx >= 0 && currentFlatIdx < flatChapters.length - 1
      ? flatChapters[currentFlatIdx + 1]
      : null;

  return {
    book,
    chapter: chNum,
    verses,
    totalChapters: book.chaptersCount,
    versionLabel: currentVersion.label,
    versionName: currentVersion.name,
    prevChapter: prevItem
      ? {
          bookSlug: prevItem.bookSlug,
          bookName: prevItem.bookName,
          chapter: prevItem.chapter,
          url: `/biblia/${prevItem.bookSlug}/${prevItem.chapter}/`,
        }
      : null,
    nextChapter: nextItem
      ? {
          bookSlug: nextItem.bookSlug,
          bookName: nextItem.bookName,
          chapter: nextItem.chapter,
          url: `/biblia/${nextItem.bookSlug}/${nextItem.chapter}/`,
        }
      : null,
    equivalentUrl: `/en/bible/${book.slugEn}/${chNum}/`,
  };
}

// English chapter retrieval (aruljohn/Bible-niv)
export function getEnglishChapter(bookSlugOrName, chapterNumber) {
  const book = getEnglishBook(bookSlugOrName);
  if (!book) return null;

  const chNum = Number(chapterNumber);
  if (chNum < 1 || chNum > book.chaptersCount) return null;

  const rawBook = enNivRaw[book.order - 1];
  const rawChapter = rawBook?.chapters?.[chNum - 1];
  const rawVerses = rawChapter?.verses || [];

  const verses = rawVerses.map((v, idx) => ({
    verse: Number(v.verse ?? idx + 1),
    text: String(v.text ?? '').trim(),
  }));

  const currentFlatIdx = flatChapters.findIndex(
    (item) => item.bookIdx === book.order - 1 && item.chapter === chNum
  );

  const prevItem = currentFlatIdx > 0 ? flatChapters[currentFlatIdx - 1] : null;
  const nextItem =
    currentFlatIdx >= 0 && currentFlatIdx < flatChapters.length - 1
      ? flatChapters[currentFlatIdx + 1]
      : null;

  return {
    book,
    chapter: chNum,
    verses,
    totalChapters: book.chaptersCount,
    versionLabel: 'NIV',
    versionName: 'New International Version',
    prevChapter: prevItem
      ? {
          bookSlug: prevItem.bookSlugEn,
          bookName: prevItem.bookNameEn,
          chapter: prevItem.chapter,
          url: `/en/bible/${prevItem.bookSlugEn}/${prevItem.chapter}/`,
        }
      : null,
    nextChapter: nextItem
      ? {
          bookSlug: nextItem.bookSlugEn,
          bookName: nextItem.bookNameEn,
          chapter: nextItem.chapter,
          url: `/en/bible/${nextItem.bookSlugEn}/${nextItem.chapter}/`,
        }
      : null,
    equivalentUrl: `/biblia/${book.slug}/${chNum}/`,
  };
}

export function getAllChapterPaths() {
  return flatChapters.map((item) => ({
    params: {
      livro: item.bookSlug,
      capitulo: String(item.chapter),
    },
    props: {
      bookSlug: item.bookSlug,
      chapter: item.chapter,
    },
  }));
}

export function getAllBookPaths() {
  return booksWithEn.map((book) => ({
    params: {
      livro: book.slug,
    },
    props: {
      book,
    },
  }));
}

export function getAllEnglishChapterPaths() {
  return flatChapters.map((item) => ({
    params: {
      book: item.bookSlugEn,
      chapter: String(item.chapter),
    },
    props: {
      bookSlug: item.bookSlugEn,
      chapter: item.chapter,
    },
  }));
}

export function getAllEnglishBookPaths() {
  return booksWithEn.map((book) => ({
    params: {
      book: book.slugEn,
    },
    props: {
      book,
    },
  }));
}
