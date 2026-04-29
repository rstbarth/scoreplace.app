# Acessibilidade — Auditoria Lighthouse

**Score atual:** **96** / 100 ✅ (beta target ≥95 atingido)
**Target beta:** ≥ 95 ✅
**Última atualização:** 2026-04-28 (v0.17.65)

## Histórico

| Versão | Score | label issues | Mudança |
|---|---:|---:|---|
| v0.17.62 (baseline) | 88 | 28 | — |
| v0.17.63 | 93 | 28 | + heading-order h2 sr-only + 2 selects aria-label |
| v0.17.64 | 93 | 20 | + aria-label injetado no helper _toggleSwitch (9 toggles) |
| **v0.17.65** | **96** | **0** | + batch aria-label nos 20 inputs restantes (create-tournament + 1 auth) |

## Pendência única (≥95 já atingido)

**color-contrast** (weight 7, 2 elementos) — 2 botões CTA da landing.
Não bloqueante pra beta. Fix sugerido: escurecer gradiente do
`btn-success` em ~10%. Requer review visual nos 4 temas. Esforço ~30min.

Score projetado pós-fix: ~100 (perfeito).

Lighthouse mobile slow-4G saiu de 88 → 96 em 3 deploys (v0.17.63, .64, .65).
Esta doc é o histórico do que foi fixado e o que sobra (color-contrast).

---

## ✅ Fixes aplicados (v0.17.63 → v0.17.65)

### 1. Selects sem labels associados (audit `select-name`, weight 7)
**Era:** 2 elementos sem `aria-label` nem `<label for>` apontando.
**Fix:** adicionado `aria-label` em ambos.

| ID | Arquivo:Linha | Fix |
|---|---|---|
| `profile-edit-gender` | js/views/auth.js:2493 | + `for=` no label adjacente + `aria-label` |
| `profile-phone-country` | js/views/auth.js:2545 | + `aria-label="DDI do telefone"` |

### 2. Heading order (audit `heading-order`, weight 3)
**Era:** `<h3>` em `landing-feat-card` sem `<h2>` precedente — pulava nível.
**Fix:** adicionado `<h2 class="sr-only">Recursos da plataforma</h2>` na
section `landing-features`. Visualmente invisível, lido por screen readers.
Classe `.sr-only` adicionada em `css/style.css` (padrão WAI-ARIA).

| Arquivo:Linha | Mudança |
|---|---|
| js/views/landing.js:73 | `<h2 class="sr-only">` adicionada antes do grid de cards |
| css/style.css | classe `.sr-only` (clip-path screen-reader-only) |
| js/i18n-pt.js:172 | + chave `landing.featuresTitle` = "Recursos da plataforma" |
| js/i18n-en.js:172 | + chave `landing.featuresTitle` = "Platform features" |

---

### 3. Form labels (audit `label`, weight 7) — **28 inputs → 0** ✅ resolvido em v0.17.64+v0.17.65

**Estratégia em 2 etapas:**
- **v0.17.64**: 9 toggles do modal de perfil (todos via `_toggleSwitch` em `js/ui.js`).
  Single fix no helper que extrai `opts.label`, strip de tags, injeta como
  `aria-label` no `<input>`. Zero call-site change.
- **v0.17.65**: 20 inputs restantes (19 em `create-tournament.js` + 1 em `auth.js`).
  Batch script Python aplicou `aria-label` em cada `id=...` que ainda não tinha.
  Mecânico, validado com Playwright (12/12 verde) antes do deploy.

#### Lista cobertos (referência histórica)

##### Modal Criar Torneio (`js/views/create-tournament.js`) — 19 inputs cobertos

Todos são `<input>` cujo `<label>` adjacente não tem `for=` apontando ao
`id` do input. Em alguns casos não há label visível — a UX usa só
contexto visual (ex: pills toggleáveis).

**Estratégia recomendada:**
- **Inputs com label visível adjacente:** adicionar `for=` no `<label>`
  apontando para o `id` do input. Zero risco visual.
- **Inputs em toggles "pill" sem label:** adicionar `aria-label` ao input
  com texto descritivo equivalente ao label visual.

#### Lista completa (28 elementos)

##### Modal Criar Torneio (`js/views/create-tournament.js`) — 18 inputs

| ID | Tipo | Label visível? | Fix sugerido |
|---|---|---|---|
| `toggle-public` | checkbox | Sim ("Público") | `for=` no label |
| `tourn-reg-date` | date | Sim ("Inscrições até") | `for=` no label |
| `tourn-reg-time` | time | parcial ("às") | `aria-label="Hora limite das inscrições"` |
| `tourn-start-date` | date | Sim ("Início do torneio") | `for=` no label |
| `tourn-start-time` | time | parcial ("às") | `aria-label="Hora de início"` |
| `tourn-end-date` | date | Sim ("Fim do torneio") | `for=` no label |
| `tourn-end-time` | time | parcial ("às") | `aria-label="Hora de término"` |
| `toggle-venue-public` | checkbox | Sim ("Local público") | `for=` no label |
| `tourn-court-count` | number | Sim ("Quadras") | `for=` no label |
| `game-toggle-simples` | checkbox | Sim ("Simples") | `for=` no label |
| `game-toggle-duplas` | checkbox | Sim ("Duplas") | `for=` no label |
| `enroll-toggle-individual` | checkbox | Sim ("Individual") | `for=` no label |
| `enroll-toggle-team` | checkbox | Sim ("Times") | `for=` no label |
| `wo-toggle-individual` | checkbox | Sim ("W.O. individual") | `for=` no label |
| `late-toggle-closed` | checkbox | Sim | `for=` no label |
| `late-toggle-expand` | checkbox | Sim | `for=` no label |
| `re-toggle-organizer` | checkbox | Sim | `for=` no label |
| `re-toggle-players` | checkbox | Sim | `for=` no label |
| `re-toggle-referee` | checkbox | Sim | `for=` no label |

##### Modal Perfil (`js/views/auth.js`) — 10 inputs cobertos

9 via `_toggleSwitch` helper (v0.17.64) + `profile-edit-name` direto (v0.17.65).

---

### 4. Color contrast (audit `color-contrast`, weight 7) — 2 botões CTA

**Elemento afetado:** `<button class="btn btn-cta btn-success landing-cta-btn">`
(o botão verde "Crie seu torneio grátis" da landing).

**Problema:** texto branco (#ffffff) em fundo verde (provavelmente
`#10b981` ou similar) com contrast ratio insuficiente pra WCAG AA (4.5:1).

**Fix sugerido:** escurecer o gradiente do `btn-success` em ~10% pra que
o texto branco passe AA. Mudança CSS em `components.css`. Afeta visual
de todos os botões `btn-success` no app — testar antes.

**Esforço:** ~30min + screenshot review nos 4 temas.

**Score impact:** weight 7 → ganho de mais ~7 pontos.

---

## Score breakdown realizado

| Estado | Score | Status |
|---|---:|---|
| v0.17.62 baseline | 88 | — |
| v0.17.63 (selects + heading-order) | 93 | aplicado |
| v0.17.64 (helper aria-label, 9 toggles) | 93 | aplicado (binário não moveu até resolver tudo) |
| v0.17.65 (20 inputs restantes) | **96** | ✅ **target beta atingido** |
| Próximo: fix de contrast | ~100 | nice-to-have antes de v1 |

---

## Como reproduzir esta auditoria

```bash
cd docs/lighthouse
npx lighthouse@12 https://scoreplace.app/ \
  --quiet --chrome-flags="--headless=new --no-sandbox --incognito" \
  --output=json --output-path=./run-$(date +%Y%m%d) \
  --form-factor=mobile --screenEmulation.mobile=true \
  --only-categories=accessibility \
  --max-wait-for-load=60000

node -e '
const r = JSON.parse(require("fs").readFileSync("./run-...report.json"));
console.log(r.categories.accessibility.score * 100);
'
```

Pra rodar **só os audits que falham** com detalhes de cada elemento,
ver o script em `docs/lighthouse/README.md`.
