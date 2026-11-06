/**
 * SNAPPY GIFTZ — Centralized Design System & Theme Tokens
 * Luxury Indian Gifting Atelier Brand Identity
 * 
 * Palette: Deep Midnight Onyx, 24K Handcrafted Gold, Rich Metallic Foil, Silk Slate
 */

export const THEME_TOKENS = {
  colors: {
    // Backgrounds
    background: '#08090B',            // Primary deep midnight canvas
    surface: '#12141A',               // Card & container surface
    surfaceElevated: '#17181C',       // Elevated surface / modal / row
    surfaceHighlight: '#1F222C',      // Highlighted row / focused card
    surfaceInput: '#0D0F14',          // Form controls & input backgrounds

    // Metallic Golds
    goldPrimary: '#D5A34A',           // Classic 24K warm gold
    goldHighlight: '#F5BD48',         // Bright radiant gold accent
    goldDark: '#997328',              // Deep burnished gold
    goldGlow: 'rgba(213, 163, 74, 0.18)',

    // Accents
    pinkAccent: '#EC3E98',            // Signature celebration pink
    pinkGlow: 'rgba(236, 62, 152, 0.20)',

    // Typography & Content
    textPrimary: '#F1F5F9',           // High contrast crisp white
    textSecondary: '#CBD5E1',         // Muted silver / body text
    textMuted: '#94A3B8',             // Subtitles & metadata
    textDim: '#64748B',               // Tertiary notes & disabled labels

    // Borders
    borderSubtle: 'rgba(213, 163, 74, 0.15)',
    borderMedium: 'rgba(213, 163, 74, 0.30)',
    borderStrong: 'rgba(213, 163, 74, 0.60)',
    borderMuted: 'rgba(255, 255, 255, 0.08)',

    // Semantic Status Tones (Dark luxury transluscent)
    status: {
      pending: {
        bg: 'rgba(245, 158, 11, 0.12)',
        text: '#FBBF24',
        border: 'rgba(245, 158, 11, 0.30)',
      },
      confirmed: {
        bg: 'rgba(16, 185, 129, 0.12)',
        text: '#34D399',
        border: 'rgba(16, 185, 129, 0.30)',
      },
      inCustomization: {
        bg: 'rgba(168, 85, 247, 0.12)',
        text: '#C084FC',
        border: 'rgba(168, 85, 247, 0.30)',
      },
      qualityCheck: {
        bg: 'rgba(56, 189, 248, 0.12)',
        text: '#38BDF8',
        border: 'rgba(56, 189, 248, 0.30)',
      },
      dispatched: {
        bg: 'rgba(99, 102, 241, 0.12)',
        text: '#818CF8',
        border: 'rgba(99, 102, 241, 0.30)',
      },
      delivered: {
        bg: 'rgba(16, 185, 129, 0.15)',
        text: '#10B981',
        border: 'rgba(16, 185, 129, 0.40)',
      },
      cancelled: {
        bg: 'rgba(239, 68, 68, 0.12)',
        text: '#F87171',
        border: 'rgba(239, 68, 68, 0.30)',
      },
    },
  },

  typography: {
    fontSerif: 'var(--font-serif)',
    fontCormorant: 'var(--font-cormorant)',
    fontSans: 'var(--font-sans)',
    fontScript: 'var(--font-script)',
  },

  radii: {
    sm: '0.5rem',    // 8px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.5rem',    // 24px
    full: '9999px',
  },

  shadows: {
    card: '0 8px 32px -4px rgba(0, 0, 0, 0.5)',
    goldSubtle: '0 4px 20px -2px rgba(213, 163, 74, 0.15)',
    goldHover: '0 12px 36px -4px rgba(213, 163, 74, 0.25)',
    elevated: '0 16px 40px -8px rgba(0, 0, 0, 0.7)',
  },
} as const;

export type ThemeTokens = typeof THEME_TOKENS;

