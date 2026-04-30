---
version: "alpha"
name: "Lumina — Onboarding Architecture"
description: "Lumina Architecture Onboarding Section is designed for building reusable UI components in modern web projects. Key features include reusable structure, responsive behavior, and production-ready presentation. It is suitable for component libraries and responsive product interfaces."
colors:
  primary: "#EA580C"
  secondary: "#FFFFFF"
  tertiary: "#F0FA06"
  neutral: "#FFFFFF"
  background: "#FFFFFF"
  surface: "#FCFBFA"
  text-primary: "#2C2A28"
  text-secondary: "#736E67"
  border: "#EAE6DF"
  accent: "#EA580C"
typography:
  display-lg:
    fontFamily: "Inter"
    fontSize: "72px"
    fontWeight: 300
    lineHeight: "72px"
    letterSpacing: "-0.05em"
  body-md:
    fontFamily: "Inter"
    fontSize: "16px"
    fontWeight: 300
    lineHeight: "26px"
  label-md:
    fontFamily: "JetBrains Mono"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "1.2px"
    textTransform: "uppercase"
rounded:
  md: "12px"
spacing:
  base: "4px"
  sm: "1px"
  md: "2px"
  lg: "4px"
  xl: "8px"
  gap: "8px"
  card-padding: "14px"
  section-padding: "24px"
components:
  button-primary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "16px"
  button-link:
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-md}"
    rounded: "0px"
    padding: "0px"
  card:
    backgroundColor: "{colors.secondary}"
    rounded: "23px"
    padding: "32px"
---

## Overview

- **Composition cues:**
  - Layout: Grid
  - Content Width: Full Bleed
  - Framing: Open
  - Grid: Strong

## Colors

The color system uses a warm light mode with #EA580C as the main accent and #FFFFFF as the neutral foundation.

- **Primary (#EA580C):** Main accent and emphasis color.
- **Secondary (#FFFFFF):** Supporting accent for secondary emphasis.
- **Tertiary (#F0FA06):** Reserved accent for supporting contrast moments.
- **Neutral (#FFFFFF):** Neutral foundation for backgrounds, surfaces, and supporting chrome.

- **Usage:** Background: #FFFFFF; Surface: #FCFBFA; Text Primary: #2C2A28; Text Secondary: #736E67; Border: #EAE6DF; Accent: #EA580C

- **Gradients:** bg-gradient-to-br from-white to-[#EAE6DF], bg-gradient-to-b from-white/40 to-transparent, bg-gradient-to-br from-white to-transparent via-[#EAE6DF], bg-gradient-to-br from-[#EAE6DF] to-[#DED9CF] via-[#F4F2EB]

## Typography

Typography pairs Inter for display hierarchy with JetBrains Mono for supporting content and interface copy.

- **Display (`display-lg`):** Inter, 72px, weight 300, line-height 72px, letter-spacing -0.05em.
- **Body (`body-md`):** Inter, 16px, weight 300, line-height 26px.
- **Labels (`label-md`):** JetBrains Mono, 12px, weight 500, line-height 16px, letter-spacing 1.2px, uppercase.

## Layout

Layout follows a grid composition with reusable spacing tokens. Preserve the grid, full bleed structural frame before changing ornament or component styling. Use 4px as the base rhythm and let larger gaps step up from that cadence instead of introducing unrelated spacing values.

Treat the page as a grid / full bleed composition, and keep that framing stable when adding or remixing sections.

- **Layout type:** Grid
- **Content width:** Full Bleed
- **Base unit:** 4px
- **Scale:** 1px, 2px, 4px, 8px, 12px, 16px, 20px, 24px
- **Section padding:** 24px, 32px, 40px, 48px
- **Card padding:** 14px, 24px, 32px, 48px
- **Gaps:** 8px, 12px, 16px, 24px

## Elevation & Depth

Depth is communicated through elevated, border contrast, and reusable shadow or blur treatments. Keep those recipes consistent across hero panels, cards, and controls so the page reads as one material system.

Surfaces should read as elevated first, with borders, shadows, and blur only reinforcing that material choice.

- **Surface style:** Elevated
- **Borders:** 1px #EAE6DF; 2px #DED9CF; 1px #EA580C; 2px #EA580C
- **Shadows:** rgba(0,0,0,0.06) layered stack (0px through 24px -12px); stronger variant with rgba(0,0,0,0.1) 2px 3px -1px

### Techniques
- **Gradient border shell:** Wrap the surface in an outer shell with 1px padding and a 13px radius. Drive the shell with linear-gradient(rgba(255,255,255,0.4), rgba(0,0,0,0)) so the edge reads like premium depth. Inset the real content surface inside with a slightly smaller radius.

## Shapes

Shapes rely on a tight radius system anchored by 8px and scaled across cards, buttons, and supporting surfaces.

- **Corner radii:** 8px, 12px, 13px, 23px, 24px, 9999px
- **Icon treatment:** Linear
- **Icon sets:** Solar

## Components

### Buttons
- **Primary:** background #FCFBFA, text #2C2A28, radius 12px, padding 16px.
- **Links:** text #736E67, radius 0px, padding 0px.

### Cards and Surfaces
- **Card surface:** background #FFFFFF, radius 23px, padding 32px, shadow layered.

### Iconography
- **Treatment:** Linear.
- **Sets:** Solar (lucide-react as proxy).

## Do's and Don'ts

### Do
- Do use the primary palette (#EA580C) as the main accent for emphasis and action states.
- Do keep spacing aligned to the 4px rhythm.
- Do reuse the Elevated surface treatment consistently across cards and controls.
- Do keep corner radii within the 8px, 12px, 13px, 23px, 24px, 9999px family.

### Don't
- Don't introduce extra accent colors outside the core palette roles.
- Don't mix unrelated shadow or blur recipes that break the current depth system.
- Don't exceed moderate motion intensity without a deliberate reason.

## Motion

Motion feels controlled and interface-led across text, layout, and section transitions.

**Motion Level:** moderate  
**Easings:** ease  
**Hover Patterns:** color, text, underline  
**Scroll Patterns:** gsap-scrolltrigger
