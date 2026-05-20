# QuizVerse — Visual & UX Roadmap

**Última actualización:** 2026-05-20
**Stack:** Next.js 16.2.1, React 19.2, Tailwind CSS 4.x, Framer Motion 12.x, Zustand

---

## Prioridad Alta 🔴

### Hero Section — Tipografía cinética + partículas

- Typewriter effect en tagline "What are you today?"
- Partículas flotantes con colores de categorías (tsParticles o canvas ligero)
- Chevron animado como scroll indicator

### Quiz Cards — Parallax hover + glow

```js
whileHover={{
  y: -8,
  scale: 1.03,
  boxShadow: '0 20px 60px -12px rgba(124, 58, 237, 0.3)'
}}
```

- Glow effect con color de categoría en hover
- Cover zoom independiente del contenedor
- Badge de tipo con micro-animación de entrada

### Resultados — Celebración

- Confeti con colores del resultado (canvas-confetti)
- Personality reveal: carta que se voltea con framer-motion
- Barra de progreso animada (0 → porcentaje real)
- Sonido de fanfarria (Web Audio API ya disponible)

---

## Prioridad Media 🟡

### Quiz Player — Inmersión

- Fondo dinámico según `VisualFamily` del quiz: space-opera → estrellas, dark-fantasy → niebla, neon-drama → gradientes
- Timer circular con gradiente de color (verde → amarillo → rojo)
- Transición entre preguntas: slide lateral + blur out (AnimatePresence)
- Efecto de streak: partículas doradas en 3+ correctas seguidas
- Imagen de pregunta cuando exista en los datos

### Categorías — Explorer visual

- Íconos SVG personalizados en vez de emojis
- Ripple effect + escala en click
- Badge con contador animado (0 → N en 500ms)

### Dark/Light Mode

- Toggle sol/luna con morph animation
- ThemeProvider ya existe pero no conectado a UI
- CSS variables para paleta completa en ambos modos
- Portadas procedurales adaptadas al tema activo

### Glassmorphism en navegación

- Nav con `backdrop-blur-xl` + borde blanco semitransparente
- Logo con SVG morphing del ícono
- Indicador de scroll: barra superior que se llena al hacer scroll

---

## Prioridad Baja 🟢

### Page Transitions

- `page-transition.tsx` ya existe, falta implementarlo en layout
- Slide lateral entre páginas con AnimatePresence
- Shared layout animation: card → página de detalle

### Command Menu (⌘K)

- `command-menu.tsx` ya existe — agregar búsqueda instantánea de quizzes
- Resultados con thumbnail
- Atajos de teclado visibles en hover

### Power-ups — Feedback visual

- Íconos animados (CSS o Lottie)
- Efecto de uso: partículas del color del power-up
- Barra glassmorphism en vez de bg sólido

### Mobile Gestures

- Swipe para cambiar pregunta (si navegación libre)
- Pull-to-refresh en explore page
- Haptic feedback (`navigator.vibrate`) en correcto/incorrecto
- Bottom tab bar (Home, Explore, Create, Profile)

---

## Performance Visual ⚡

- Lazy load imágenes con `loading="lazy"` + blur placeholder
- `next/image` con `sizes` prop para responsive
- Reducir bundle de framer-motion (imports puntuales, no árbol completo)
- Skeleton screens (componente ya existe) — usar en vez de spinners

---

## Sistema de Animación

Design tokens centralizados en `tailwind.config`:

```js
animation: {
  'fade-in': 'fadeIn 0.4s ease-out',
  'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
  'scale-in': 'scaleIn 0.3s ease-out',
  'bounce-in': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
}
```

- `prefers-reduced-motion`: desactivar animaciones vía motion prop global
- Stagger delays consistentes: 50ms / 100ms / 150ms

---

## Tipografía & Micro-copy

- `var(--font-display)` para títulos (Georgia serif fallback)
- Ligatures activadas en display
- Letter-spacing negativo en títulos grandes (estilo editorial)
- `tabular-nums` en contadores (plays, likes, scores)
- Números con count-up animation
- Tooltips en badges e íconos (componente ya existe)

---

## Data Visualization

### Leaderboard

- Top 3 con podium visual (oro, plata, bronce)
- Avatares con ring de color según posición
- Animación de entrada escalonada
- Mini bar chart de distribución de scores

### Perfil

- Gráfico de radar para resultados de personalidad (spider chart)
- Timeline de quizzes jugados con mini-cards
- Badge de racha animado (fuego)
