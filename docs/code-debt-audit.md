# Code Debt Audit — scoreplace.app

**Data:** 2026-04-28 (v0.17.55-alpha)
**Escopo:** Sprint 1 / Beta-readiness — categorizar TODOs/FIXMEs/legacy.
**Resultado em uma linha:** Zero TODO/FIXME ativos. ~24 comentários `// Legacy` mapeados — todos são fallbacks ou wrappers de compat ainda em uso.

---

## Metodologia

```bash
grep -rn -iE "(// ?(todo|fixme|xxx|hack|wip|bug|deprecated|legacy)\b)" --include="*.js" js/
grep -rn -E "(TODO:|FIXME:|XXX:|HACK:)" --include="*.js" js/
```

Falsos positivos filtrados: `TODOS` (português, "all"), strings de release notes em main.js, comentários explicando bugs já corrigidos.

---

## Achados

### TODO / FIXME / XXX / HACK propriamente ditos

**Zero ocorrências.** O codebase não tem markers de débito pendente.

A única falsa correspondência foi `js/views/venues.js:1352` — "TODOS os cards preferidos" (português, comentário explicando o ciclo de hidratação em todos os preferidos).

---

### Comentários `// Legacy` (24 ocorrências)

Todos são **DEFER** — mantêm-se como fallback/compat em código vivo. Nenhum requer ação imediata.

| Arquivo:Linha | Categoria | Ação |
|---|---|---|
| `store.js:325` | Legacy inline-JS override (cache buster) | DEFER — fallback ativo |
| `store.js:581-592` | Aliases de funções renomeadas (`_reflowChrome`) | DEFER — chamadas externas |
| `firebase-db.js:46` | Bug-fix doc (`__all__` reservado Firestore) | DEFER — defesa ativa |
| `bracket-model.js:408,410` | Storage fields `t.matches`/`t.rounds`/`t.rodadas` | DEFER — estruturas em uso |
| `tournaments-draw-prep.js:2395` | Defesa contra shapes legacy | DEFER — defensa ativa |
| `auth.js:1358` | `viewMode = 'organizer'` (legacy field) | **DEFER** — semanticamente vira flag `is-guest-vs-user` (auth.js:1708,1871 setam pra `'participant'` em logout) — campo ainda lido por `dashboard.js:24` e `store.js:133` |
| `auth.js:2976` | Preferred locations só com label | DEFER — caminho ativo |
| `venue-owner.js:393` | Entry inline-no-perfil | DEFER |
| `venue-owner.js:1142` | Comentário do bug-fix v0.16.17 | DEFER — documentação |
| `bracket.js:1624` | `t.groups[i].rounds` storage | DEFER — em uso |
| `tournaments.js:928` | Fallback round-detection | DEFER |
| `bracket-ui.js:2342` | Fallback adapter ausente | DEFER |
| `tournaments-analytics.js:691` | Fallback adapter ausente | DEFER |
| `venues.js:1515` | Bug-fix doc v0.16.22 | DEFER — documentação |
| `create-tournament.js:881,991,1035` | Wrappers compat | DEFER |
| `create-tournament.js:3661,3752,3759` | GSM stubs e overlay personalizado | DEFER |

---

### Empty catches (10 amostras)

Padrão defensivo aceito (`localStorage`/`sessionStorage`/`scrollRestoration` que podem falhar em modo privado). **DEFER** — não é débito.

```js
try { pref = localStorage.getItem('scoreplace_theme'); } catch(e) {}
try { sessionStorage.setItem('_inviteRefUid', ...); } catch(e) {}
```

### Console pollution

Top emissores:
- `auth.js`: 81
- `firebase-db.js`: 40
- `store.js`: 29
- `venues.js`: 18
- `presence-db.js`: 16
- `bracket-ui.js`: 15

**Plano:** introduzir wrapper centralizado `window._log/_warn/_error` quando plugar Sentry (Sprint 1, task 6). Permite silenciar em prod e roteá-los pra observability. **DEFER** até Sentry boilerplate.

---

## Conclusão

**Não há débito acionável que justifique uma sprint dedicada.** O codebase está enxuto:

- Nenhum TODO/FIXME pendente.
- Comentários `// Legacy` são todos fallbacks ativos com razão de existir documentada.
- Empty catches são defensivos por design.
- Console pollution será endereçada como pré-requisito do Sentry, não como cleanup standalone.

**Veredito:** task Sprint 1 / Cleanup TODOs encerrada como **passou** sem refactor. Próxima task: Bundle audit.
