Busca y reporta código muerto en el proyecto.

Busca:
- Imports no usados.
- Exports no consumidos.
- Archivos no referenciados.
- Referencias a providers eliminados (Groq, OpenRouter, OpenAI, Qwen).
- Scripts obsoletos en `scripts/`.
- Artifacts generados que ya no se usan en `generated/`.
- Variables de entorno referenciadas pero no necesarias.
- Componentes no renderizados.

NO borres automáticamente. Reporta la lista priorizada para revisión manual.

Contexto: $ARGUMENTS
