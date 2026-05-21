Prepara deploy de QuizVerse a Vercel.

Reglas:
1. No deployes si `/check-build` no pasó. Ejecuta validación primero.
2. Revisa que las env vars necesarias estén configuradas en Vercel.
3. Si hay Vercel CLI, úsalo. Si no, deja pasos exactos.
4. No expongas secrets en logs.
5. Verifica que el build de producción sea limpio.

Modo: $ARGUMENTS
(Si no se especifica, asumir preview.)
