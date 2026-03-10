import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        bg: {
          page: { value: "#f9fafb" },
          card: { value: "#ffffff" },
          sidebar: { value: "#f2f4f7" },
        },
        border: {
          default: { value: "#eaecf0" },
          subtle: { value: "rgba(0,0,0,0.06)" },
        },
        text: {
          primary: { value: "#101828" },
          secondary: { value: "#475467" },
        },
        accent: {
          500: { value: "#7f56d9" },
          600: { value: "#2f1868" },
        },
        status: {
          green: { value: "#059669" },
          yellow: { value: "#fec84b" },
          red: { value: "#dc2626" },
        },
        table: {
          stripe: { value: "#f9fafb" },
          hover: { value: "#f2f4f7" },
        },
        skeleton: {
          base: { value: "#eaecf0" },
          shine: { value: "#f2f4f7" },
        },
      },
      shadows: {
        card: { value: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(16,24,40,0.06)" },
        cardHover: { value: "0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(16,24,40,0.1)" },
        nav: { value: "0 1px 3px rgba(0,0,0,0.06)" },
      },
      radii: {
        card: { value: "12px" },
      },
      fonts: {
        body: { value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
        heading: { value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
      },
    },
    semanticTokens: {
      colors: {
        "bg.page": { value: "{colors.bg.page}" },
        "bg.card": { value: "{colors.bg.card}" },
        "bg.sidebar": { value: "{colors.bg.sidebar}" },
        "border.default": { value: "{colors.border.default}" },
        "border.subtle": { value: "{colors.border.subtle}" },
        "text.primary": { value: "{colors.text.primary}" },
        "text.secondary": { value: "{colors.text.secondary}" },
        "accent.500": { value: "{colors.accent.500}" },
        "accent.600": { value: "{colors.accent.600}" },
        "status.green": { value: "{colors.status.green}" },
        "status.yellow": { value: "{colors.status.yellow}" },
        "status.red": { value: "{colors.status.red}" },
        "table.stripe": { value: "{colors.table.stripe}" },
        "table.hover": { value: "{colors.table.hover}" },
      },
      shadows: {
        "shadow.card": { value: "{shadows.card}" },
        "shadow.cardHover": { value: "{shadows.cardHover}" },
        "shadow.nav": { value: "{shadows.nav}" },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
