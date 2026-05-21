Audita seguridad del proyecto QuizVerse.

Busca:
- API keys o tokens en código fuente (grep por patrones de keys).
- `.env` trackeado en git.
- `NEXT_PUBLIC_*` usado para secretos.
- Supabase service role key expuesta en client.
- Formularios o inputs sin validación Zod.
- XSS: `dangerouslySetInnerHTML` sin sanitizar.
- Rate limiting funcionando en API routes.
- Dependencias con vulnerabilidades (`npm audit`).

Entrega `✅ OK` o `❌ BLOQUEADO` con fixes mínimos.

Contexto: $ARGUMENTS
