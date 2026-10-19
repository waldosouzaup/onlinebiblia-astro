# Online Bíblia — Astro

Redesign responsivo do Online Bíblia, criado com Astro e JavaScript sem framework de interface adicional.

## Funcionalidades

- Filtro de livros por Antigo Testamento, Novo Testamento ou todos.
- Seletores de livro, capítulo e versículo.
- Alternância entre os arquivos em português e inglês.
- Ajuste de tamanho da fonte durante a leitura.
- Tema claro/escuro, com preferência salva no navegador.
- Busca textual nos versículos carregados.
- Devocional diário lido de um JSON independente.
- Concordância bíblica organizada por tema, categoria e referências.
- Layout adaptável a celular, tablet e desktop, com navegação por teclado e estados acessíveis.

## Começar

Requer Node.js 20.3+.

```bash
npm install
npm run dev
```

Abra o endereço local indicado pelo Astro. Para gerar a versão estática:

```bash
npm run build
npm run preview
```

## Conteúdo bíblico completo importado

O conteúdo integral da Bíblia Sagrada foi importado a partir dos repositórios:
- **Português**: [thiagobodruk/biblia](https://github.com/thiagobodruk/biblia) (NVI, ACF, AA)
- **Inglês**: [aruljohn/Bible-niv](https://github.com/aruljohn/Bible-niv) (NIV completa em 66 livros)

- **66 Livros e 1.189 Capítulos** na íntegra em ambos os idiomas.
- **Traduções disponíveis em `src/data/bibles/`**:
  - `nvi.json`: Nova Versão Internacional (Português).
  - `en_niv.json`: New International Version (Inglês — 66 livros de aruljohn/Bible-niv).
  - `acf.json`: Almeida Corrigida Fiel.
  - `aa.json`: Almeida Atualizada.
  - `en_kjv.json`: King James Version (Inglês).
- **Arquivos públicos em `public/data/`**:
  - `bible-pt.json`: Texto completo em português (NVI, 66 livros).
  - `bible-en.json`: Texto completo em inglês (NIV, 66 livros).
  - `concordance.json`: Temas e referências cruzadas atualizados com os slugs canônicos.
  - `devotional.json`: Texto devocional do dia com link direto para o capítulo estático.

## Geração Estática de Páginas com Astro (SSG)

A aplicação utiliza o Astro para pré-renderizar **mais de 2.500 páginas estáticas** em HTML puro, suave e ultra leve:

### Em Português (NVI):
- `/biblia/`: Diretório completo com os 66 livros divididos por Antigo e Novo Testamento e categorias (Pentateuco, Poéticos, Evangelhos, Cartas...).
- `/biblia/[livro]/`: Visão geral do livro com grid interativo de todos os seus capítulos.
- `/biblia/[livro]/[capitulo]/`: Leitor estático dos 1.189 capítulos com versículos em HTML semântico, navegação com `<ClientRouter />`, controle de fonte e cópia formatada.

### Em Inglês (NIV):
- `/en/bible/`: Full English Bible directory with all 66 books (Old & New Testament).
- `/en/bible/[book]/`: English book hub with chapters grid.
- `/en/bible/[book]/[chapter]/`: Static chapter reader for all 1,189 chapters in English NIV with direct language toggle to Portuguese.

- `/concordancia/`: Guia temático com busca e links diretos para as páginas estáticas dos capítulos.

## Formato de JSON recomendado

O leitor aceita o formato abaixo. Os campos `id`, `name`, `testament`, `chapters`, `chapter`, `verses`, `verse` e `text` são os mais importantes para a navegação. `testament` pode ser `old` ou `new`.

```json
{
  "language": "pt",
  "versionLabel": "NVI",
  "isDemo": false,
  "books": [
    {
      "id": "genesis",
      "name": "Gênesis",
      "testament": "old",
      "chapters": [
        {
          "chapter": 1,
          "verses": [
            { "verse": 1, "text": "Texto do primeiro versículo." },
            { "verse": 2, "text": "Texto do segundo versículo." }
          ]
        }
      ]
    }
  ]
}
```

Para o inglês, use a mesma estrutura em `bible-en.json`, por exemplo com `"language": "en"` e `"versionLabel": "NIV"`. **Mantenha os mesmos `id` de livro nos dois arquivos** para preservar a referência ao alternar de idioma. O leitor também normaliza formatos comuns em que capítulos ou versículos vêm como listas ou objetos indexados, mas o formato acima é o mais previsível.

Ao trocar os JSONs de demonstração, configure `"isDemo": false`. O rótulo `versionLabel` aparece na interface e pode ser definido como `NVI`, `NIV` ou outro nome permitido pela licença do conteúdo.

## Formato da concordância

`public/data/concordance.json` usa uma lista `topics`. Cada tema tem `id`, `title`, `category`, `description` e uma lista de referências. O `bookId` de cada referência deve corresponder ao `id` usado em `bible-pt.json`.

```json
{
  "topics": [
    {
      "id": "esperanca",
      "title": "Esperança",
      "category": "Emoções e cuidado",
      "description": "Passagens relacionadas à esperança.",
      "references": [
        { "bookId": "romans", "chapter": 15, "verse": 13 }
      ]
    }
  ]
}
```

## Formato do devocional

`public/data/devotional.json` é um item único que pode ser atualizado pelo seu processo editorial ou de conteúdo:

```json
{
  "eyebrow": "PARA HOJE",
  "title": "Título do devocional",
  "reference": "Romanos 15:13",
  "body": "Texto principal.",
  "reflection": "Pergunta para reflexão.",
  "prayer": "Oração sugerida.",
  "bookId": "romans",
  "chapter": 15,
  "verse": 13
}
```

## Estrutura

```text
src/
  components/SiteHeader.astro
  layouts/BaseLayout.astro
  pages/index.astro
  pages/concordancia.astro
  scripts/reader.js
  scripts/concordance.js
  scripts/theme.js
  styles/global.css
public/data/
  bible-pt.json
  bible-en.json
  concordance.json
  devotional.json
```

## Observações para produção

- Use apenas textos bíblicos e recursos cujo uso e distribuição estejam autorizados para o seu projeto.
- O devocional e os temas de demonstração devem ser revisados e substituídos pelo conteúdo editorial definitivo.
- Se os arquivos JSON forem muito grandes, considere dividi-los por livro/capítulo e carregar os dados sob demanda, preservando a mesma API de navegação.
