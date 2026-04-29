# Acessibilidade — Auditoria Lighthouse v0.17.62

**Score atual:** 88 / 100
**Target beta:** ≥ 95
**Data:** 2026-04-28

Lighthouse mobile slow-4G aponta 4 categorias de issues a11y. Esta doc lista
o estado atual e o caminho até `≥95`.

---

## ✅ Fixes aplicados (v0.17.63)

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

## 🟡 Pendências (não-bloqueantes pra beta, mas pra ≥95)

### 3. Form labels (audit `label`, weight 7) — **28 inputs sem label associado**

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

##### Modal Perfil (`js/views/auth.js`) — 10 inputs

| ID | Tipo | Label visível? | Fix sugerido |
|---|---|---|---|
| `profile-edit-name` | text | Sim ("Nome") | `for=` no label |
| `profile-accept-friends` | checkbox | Sim | `for=` no label |
| `profile-filter-todas` | checkbox | Sim ("Todas") | `for=` no label |
| `profile-filter-importantes` | checkbox | Sim ("Importantes") | `for=` no label |
| `profile-filter-fundamentais` | checkbox | Sim ("Fundamentais") | `for=` no label |
| `profile-notify-platform` | checkbox | Sim ("Plataforma") | `for=` no label |
| `profile-notify-email` | checkbox | Sim ("Email") | `for=` no label |
| `profile-presence-auto-checkin` | checkbox | Sim ("Auto check-in GPS") | `for=` no label |
| `profile-hints-enabled` | checkbox | Sim ("Mostrar dicas") | `for=` no label |

**Esforço estimado:** ~2h pra cobrir todos (mecânico, mas precisa testar
visualmente cada modal pra não quebrar layout).

**Score impact:** weight 7 → ganho de ~7 pontos (88 → ~95) quando todos
forem corrigidos. Mais que suficiente pra atingir target beta.

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

## Score breakdown projetado

| Estado | Score |
|---|---:|
| Antes da v0.17.63 | 88 |
| Após v0.17.63 (selects + heading-order) | ~91 |
| Após fix dos 28 form labels | ~94 |
| Após fix do contrast | ~98 |

**Pra beta basta chegar em ~95** — corrigir os 28 labels (mecânico) já
basta. O contrast fix entra como nice-to-have antes de v1.

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
