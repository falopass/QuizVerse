# QuizVerse — CommandCode Configuration

## Instalación

Desde la raíz de tu proyecto QuizVerse:

```bash
# 1. Copia AGENTS.md a la raíz del proyecto
cp AGENTS.md /ruta/a/quizverse/AGENTS.md

# 2. Copia la carpeta .commandcode completa
cp -r .commandcode /ruta/a/quizverse/.commandcode

# 3. Commitea al repo
cd /ruta/a/quizverse
git add AGENTS.md .commandcode/
git commit -m "feat: add CommandCode agents, commands and skills config"
```

## Estructura

```
quizverse/
├── AGENTS.md                                          # Memory: contexto del proyecto
└── .commandcode/
    ├── agents/                                        # Subagentes especializados
    │   ├── architect.md                               # Arquitectura y decisiones grandes
    │   ├── planner.md                                 # Análisis read-only y planes
    │   ├── frontend-dev.md                            # UI/UX, Tailwind, Framer Motion
    │   ├── quality-gate.md                            # Review: APPROVED/BLOCKED
    │   ├── debugger.md                                # Diagnóstico de bugs
    │   ├── seo-audit.md                               # SEO técnico y local
    │   ├── perf-audit.md                              # Performance
    │   ├── security-audit.md                          # Seguridad
    │   └── content-writer.md                          # Copy bilingüe EN/ES
    ├── commands/                                      # Slash commands (/)
    │   ├── tsc.md                                     # /tsc — TypeScript check
    │   ├── test.md                                    # /test — Vitest
    │   ├── gpush.md                                   # /gpush "mensaje"
    │   ├── review-code.md                             # /review-code
    │   ├── plan-feature.md                            # /plan-feature descripción
    │   ├── check-build.md                             # /check-build — validación completa
    │   ├── deploy.md                                  # /deploy preview|production
    │   ├── seed-pipeline.md                           # /seed-pipeline [paso]
    │   ├── seo-check.md                               # /seo-check
    │   ├── perf-check.md                              # /perf-check
    │   ├── security-check.md                          # /security-check
    │   ├── cleanup.md                                 # /cleanup — código muerto
    │   └── i18n-check.md                              # /i18n-check — bilingüe
    └── skills/
        └── quizverse-engine/                          # Skill: lógica de quizzes
            ├── SKILL.md                               # Knowledge base principal
            └── references/
                ├── SUPABASE_SCHEMA.md                 # Schema de la DB
                └── ROUTES_AND_LOCALE.md               # Rutas y sistema i18n
```

## Nombres reservados

CommandCode reserva `explore`, `plan`, `review` y `general` para agentes built-in.
Por eso renombramos:
- `plan` → **`planner`**
- `review` → **`quality-gate`**

## Uso rápido

```bash
# Iniciar CommandCode en el proyecto
cd quizverse && cmd

# Comandos disponibles (escribe / en el prompt)
/tsc                              # TypeScript check
/test                             # Correr tests
/test scoring                     # Tests de scoring
/gpush "feat: add dark mode"      # Commit + push
/review-code                      # Review del diff actual
/plan-feature "add ads system"    # Planificar feature
/check-build                      # Validación completa pre-deploy
/deploy preview                   # Preparar deploy
/seed-pipeline full               # Pipeline completo de seed
/seo-check                        # Auditoría SEO
/perf-check                       # Auditoría performance
/security-check                   # Auditoría seguridad
/cleanup                          # Buscar código muerto
/i18n-check                       # Verificar soporte bilingüe
```

## Diferencias con OpenCode

| OpenCode | CommandCode |
|---|---|
| `opencode.json` (modelos) | Studio o `cmd --model` |
| Agentes primarios (Tab) | Agente principal + subagentes (delegación) |
| `agents/*.md` con `mode`, `temperature`, `permission` | `.commandcode/agents/*.md` con `name`, `description`, `tools` |
| `commands/*.md` con `agent:` en frontmatter | `.commandcode/commands/*.md` (sin asignación de agente) |
| `skills/*/SKILL.md` | `.commandcode/skills/*/SKILL.md` (mismo estándar) |
| `$ARGUMENTS` para inputs | `$ARGUMENTS` y `$1`, `$2`... (mismo + posicionales) |
| Taste no existe | `taste-1` aprende tu estilo de código automáticamente |
