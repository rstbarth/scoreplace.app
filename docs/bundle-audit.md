# Bundle Audit — scoreplace.app

**Data:** 2026-04-28 (v0.17.55-alpha)
**Escopo:** Sprint 1 / Beta-readiness — analisar peso atual e propor split.

---

## Snapshot atual

**42 scripts carregados sincronamente no first paint.**
**Total JS uncompressed:** ~4.28 MB.
**Total CSS uncompressed:** ~80 KB.

### Top 10 arquivos JS por tamanho

| Arquivo | Bytes | % do total |
|---|---:|---:|
| `js/main.js` | 1,160,532 | **27%** |
| `js/views/bracket-ui.js` | 413,476 | 9.7% |
| `js/views/create-tournament.js` | 274,416 | 6.4% |
| `js/views/venues.js` | 222,404 | 5.2% |
| `js/views/tournaments-draw-prep.js` | 206,852 | 4.8% |
| `js/views/auth.js` | 189,066 | 4.4% |
| `js/views/bracket.js` | 174,366 | 4.1% |
| `js/views/tournaments.js` | 153,618 | 3.6% |
| `js/views/dashboard.js` | 135,918 | 3.2% |
| `js/i18n-pt.js` | 113,012 | 2.6% |
| `js/i18n-en.js` | 106,694 | 2.5% |

---

## Findings

### 🚨 Finding #1 — `main.js` é 87% release notes inline

```
main.js                       1,160,532 B
├── help modal sections      ~  101,973 B  (lines 5–1003)
├── release notes inline     ~1,009,688 B  (lines 1004–3763)  ← 87%
└── quick-create + shortcuts ~   43,111 B  (lines 3854–end)
```

**~1 MB de strings HTML inline com release notes** que praticamente nenhum usuário lê. Quem abre é o organizador do projeto, raramente.

**Custo concreto:** mobile com 4G de 1 Mbps gasta ~8 segundos baixando release notes que ninguém leu naquela sessão.

**Ação:** lazy-load. Ship um placeholder na tab "📝 Notas de versões". Quando o usuário clicar, fetch `js/release-notes.js` (que injeta o conteúdo no `helpSections`).

**Ganho estimado:** -85% no peso de `main.js`, ou seja, **~1 MB economizado no first paint.**

---

### 🟡 Finding #2 — Ambos i18n carregados sempre

```
i18n-pt.js  113,012 B
i18n-en.js  106,694 B
total       219,706 B
```

Hoje 100% dos usuários carrega ambos. Mas só 1 está ativo.

**Ação:** carregar dinamicamente baseado no `localStorage.scoreplace_lang` (ou `navigator.language`):

```js
// em theme.js (carrega ANTES de tudo)
var lang = (localStorage.getItem('scoreplace_lang')
            || navigator.language || 'pt').slice(0,2);
var s = document.createElement('script');
s.src = 'js/i18n-' + (lang === 'en' ? 'en' : 'pt') + '.js?v=' + V;
document.head.appendChild(s);
```

**Ganho:** -107 KB para users PT (maioria), -113 KB para EN.

**Cuidado:** o toggle PT/EN no perfil precisa carregar o outro arquivo on-demand antes de aplicar.

---

### 🟢 Finding #3 — Views poderiam ser lazy por rota (futuro, não urgente)

`bracket-ui.js` (413 KB), `create-tournament.js` (274 KB), `venues.js` (222 KB) — todos carregados no boot mas só usados em rotas específicas.

**Ação possível:** router carrega scripts da view sob demanda:

```js
// router.js (novo)
var ROUTE_SCRIPTS = {
  'bracket': ['js/views/bracket-model.js','js/views/bracket-logic.js',
              'js/views/bracket.js','js/views/bracket-ui.js'],
  'casual': ['js/views/bracket-ui.js'], // shared
  'venues': ['js/views/venues.js'],
  ...
};
```

**Ganho potencial:** ~1.2 MB em rotas que não precisam dessas views (ex: `#dashboard` puro nunca toca bracket-ui).

**Custo:** refactor do router + dependency tracking entre views. Não é trivial. **DEFER pra Sprint 2 ou 3.**

---

### ✅ Finding #4 — Não-acionáveis (já bons)

- `firebase-db.js` (42 KB), `store.js` (105 KB) — coração do app, precisam estar no boot.
- `auth.js` (189 KB) — boot porque o login pop-up dispara em qualquer rota.
- CSS (80 KB total) — pequeno, sem split necessário pra beta.
- Sem dependencies npm (no `node_modules`). Sem bundler atual — projeto é "ship raw", o que reduz overhead mas elimina tree-shaking.

---

## Plano de ação Sprint 1 (concreto)

### Win #1 — Lazy release notes (ship esta sprint)

**Esforço:** 30 min. **Ganho:** -1 MB no first paint.

Passos:
1. Criar `js/release-notes.js` exportando `window._RELEASE_NOTES_HTML = '<long html string>'`.
2. Mover o conteúdo de `main.js:1004-3763` (campo `content` da seção `notas-versoes`) pro novo arquivo.
3. Em `main.js`, substituir o content por placeholder + handler que lazy-loads o script ao abrir a aba.
4. Bump cache buster + bump SW version + entry no `STATIC_ASSETS`.

### Win #2 — Lazy i18n EN (ship esta sprint)

**Esforço:** 45 min. **Ganho:** -107 KB pra users PT (maioria).

Passos:
1. Remover `<script src="js/i18n-en.js">` do `index.html`.
2. Em `i18n.js`, função `loadLang(lang)` que faz dynamic `<script>` injection se ainda não carregado. Retorna Promise.
3. Toggle PT/EN no perfil chama `loadLang('en').then(applyLanguage)`.
4. Boot: detecta `localStorage.scoreplace_lang` ou `navigator.language` e chama `loadLang` antes de qualquer `_t()`.

### Defer pra Sprints 2-3

- Route-level lazy loading (Finding #3) — exige refactor do router.
- Minification/uglify — sem bundler atual, requer adicionar build step. Decisão de arquitetura, não cleanup.
- Tree-shaking de i18n — só carregar chaves usadas. Pequeno ganho, alto custo.

---

## Conclusão

Dois quick-wins somam **~1.1 MB economizados no first paint** (~26% do bundle total) com ~75 minutos de esforço combinado.

**Próximo passo:** implementar Win #1 (lazy release notes).
