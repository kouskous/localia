# Localia

A premium, minimal AI chat interface built with Vue 3, TypeScript and Vite.

## Design system

The UI follows a warm, neutral, restrained design language — one accent
color used sparingly, generous whitespace, and typography-led hierarchy
instead of boxes and gradients. All shared values (color, spacing, radius,
shadow, typography, motion) live as CSS custom properties in
[`src/styles/tokens.css`](src/styles/tokens.css); components consume those
tokens rather than hard-coded values.

Key building blocks:

- `src/components/ui/` — primitives: buttons, icon buttons, the AI "spark"
  identity mark, progress bar, typing-dots indicator, file chips.
- `src/components/chat/` — the empty state, suggestion chips, composer
  (auto-growing textarea, attachments, drag & drop), message list and
  bubbles, streaming/processing indicator, drop overlay.
- `src/components/LoadingScreen.vue` — the first-run intro screen.
- `src/composables/useChat.ts` — chat state and a simulated streaming
  response, standing in for a real model/backend integration.

Motion respects `prefers-reduced-motion`, and the layout is designed for
desktop, tablet and mobile (keyboard-safe composer, full-height
conversation, touch-friendly targets).

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build for production
npm run preview  # preview the production build
```
