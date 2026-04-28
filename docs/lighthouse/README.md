# Lighthouse Baseline

**Data:** 2026-04-28
**Versão medida:** v0.17.57-alpha (mobile, Slow 4G simulado, headless Chrome)
**URL:** https://scoreplace.app/

---

## Scores

| Categoria | Score |
|---|---:|
| Performance | **57** |
| Accessibility | 88 |
| Best Practices | 96 |
| SEO | 100 |

## Core Web Vitals (mobile)

| Métrica | Valor | Threshold "good" |
|---|---:|---:|
| First Contentful Paint (FCP) | **8.8 s** | ≤ 1.8 s |
| Largest Contentful Paint (LCP) | **9.4 s** | ≤ 2.5 s |
| Total Blocking Time (TBT) | 0 ms | ≤ 200 ms |
| Cumulative Layout Shift (CLS) | 0 | ≤ 0.1 |
| Speed Index | 8.8 s | ≤ 3.4 s |
| Time to Interactive (TTI) | 9.4 s | ≤ 3.8 s |

## Resource breakdown (transfer / gzipped)

| Tipo | Requests | Transfer KB |
|---|---:|---:|
| Total | 151 | 1,292 |
| Script | 98 | 1,091 |
| Third-party | 46 | 429 |
| Font | 4 | 79 |
| Image | 22 | 60 |
| Other | 10 | 33 |
| Stylesheet | 12 | 23 |
| Document | 5 | 6 |

---

## Caveat metodológico do baseline

A primeira run de Lighthouse (rotulada `baseline-v0.17.55-mobile`) aconteceu durante o rollout do deploy v0.17.56 no GitHub Pages — Chrome já carregou o `main.js` reduzido (152 KB) e não o original de 1.16 MB. Os números "before" e "after" no comparativo direto são quase idênticos por isso, **não porque o lazy-load não funcionou**.

Evidência de que o lazy-load funciona (verificada por curl + audit de network do Lighthouse):
- `main.js` em produção: **152 KB raw / 40 KB gzipped** (era 1,160 KB raw / ~250 KB gzipped).
- `release-notes.js` **não é fetchado** no first paint nem aparece nos `network-requests` do Lighthouse — só carrega ao abrir o modal de Help.

## Por que FCP/LCP não despencaram

O ganho de bytes (-210 KB gzipped no first paint) é real mas **não é o gargalo do FCP**. main.js carrega no fim do bloco de `<script>` do `index.html` — não bloqueia o paint inicial. Os blockers efetivos são:

1. **Bloco inicial de scripts no head**: theme.js, i18n.js, i18n-pt.js, i18n-en.js, store.js, firebase-db.js, presence-db.js, etc. — ~14 scripts antes do CSS, ~120 KB gzipped.
2. **Firebase SDK init** (third-party 429 KB) — bloqueia o JS engine na inicialização.
3. **42 scripts em série sem `defer`/`async`** — cada um espera o anterior parsear.

## Próximas alavancas (priorizadas por ROI)

### 🥇 Prioridade 1 — `defer` em todos os scripts da view
Adicionar `defer` em todas as 42 tags `<script>` do `index.html`. Browser carrega em paralelo e parseia após HTMLParser. **Estimativa: -3 a -5 segundos no FCP**, esforço de ~10 minutos. Risco: baixo (vanilla JS, sem ES Modules, sem ordering crítico além do que já é alfabeticamente correto).

### 🥈 Prioridade 2 — Lazy-load de i18n-en.js
Como já documentado em `bundle-audit.md` Win #2. Saves 107 KB raw (~30 KB gzipped) para users PT. **Estimativa: -100 a -300ms FCP**, esforço de ~45 minutos.

### 🥉 Prioridade 3 — Lazy-load de Firebase
Carregar Firebase SDK + initialize só no primeiro flow que precisa (login, save). Hoje carrega no boot. **Estimativa: -1 a -2 segundos no FCP**, esforço alto (~4 horas, requer entender quais módulos precisam quando).

### 4 — Inline critical CSS
Inline o subset de `style.css` necessário pro acima-da-dobra; lazy-load o resto via media="print" trick. **Estimativa: -200 a -500ms FCP**, esforço médio.

### 5 — Route-based code splitting (Bundle Audit Finding #3)
Não carregar `bracket-ui.js`, `create-tournament.js`, `venues.js` no boot. Esforço alto (~1 sprint). Defer pra Sprint 3.

---

## Reproduzir

```bash
cd docs/lighthouse
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
npx --yes lighthouse@12 https://scoreplace.app/ \
  --quiet \
  --chrome-flags="--headless=new --no-sandbox --incognito" \
  --output=json --output=html \
  --output-path=./run-$(date +%Y%m%d-%H%M)-mobile \
  --form-factor=mobile --screenEmulation.mobile=true \
  --only-categories=performance,accessibility,best-practices,seo
```

⚠️ Há um `LanternError: rootNode not found` benigno no fim de cada run com lighthouse@12 — relatórios são gerados normalmente apesar do erro. Não afeta os números.

## Arquivos neste diretório

- `baseline-v0.17.55-mobile.report.{json,html}` — primeira run (já com v0.17.56 servindo, ver caveat).
- `after-v0.17.56-mobile.report.{json,html}` — segunda run (mesma versão deployed).
- `after-v0.17.57-mobile.report.{json,html}` — pós-fix do SW precache.

Próximos targets para tracking: FCP < 5s, Performance score > 70.
