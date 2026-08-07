# Meridian UI

`@meridian/ui` is Meridian's lightweight design-system boundary. Application and
feature code should import reusable controls from this package instead of styling
native controls globally.

## Foundations

- `tokens.css` owns semantic color, type, spacing, geometry, and control tokens.
- `themes.css` overrides semantic tokens for light mode.
- `reset.css` contains only document and native-element normalization.
- `globals.css` connects the tokens to Tailwind and imports the foundation files.

## Components

Shared components use native HTML where it is sufficient and Radix primitives
where accessible interaction behavior is needed. Tailwind and CVA provide compact,
consistent variants. Components deliberately use restrained borders, square
controls, and desktop-scale spacing.

```tsx
import { Button, Input, Select } from '@meridian/ui';

<Button variant="secondary" size="sm">Export</Button>
<Input aria-label="Speaker name" />
<Select aria-label="Model">...</Select>
```

Feature-specific layout and state styling stays with its feature. Do not add broad
selectors such as `button { ... }` or `input { ... }` to feature stylesheets.

## Extraction rule

Move a control into `@meridian/ui` when it is reused, represents a standard
interaction, or must remain visually consistent across desktop and future web
surfaces. Keep workflow-specific composition inside `packages/features`.
