import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF6B35',
          coral: '#FF8B68',
        },
        accent: {
          teal: '#00C9A7',
        },
        dark: '#2D2D2D',
        success: {
          green: '#10B981',
        },
        warning: {
          orange: '#F59E0B',
        },
        error: {
          red: '#EF4444',
        },
        // Keep existing colors for backward compatibility during transition
        ocean: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        coral: {
          50: '#FFF1F2',
          100: '#FFE4E6',
          500: '#FB7185',
          600: '#F43F5E',
        },
        emerald: {
          50: '#ECFDF5',
          500: '#10B981',
          600: '#059669',
        },
      },
      backgroundImage: {
        'warm-gradient': 'linear-gradient(135deg, #FFF5F2 0%, #FFE9E1 100%)',
      },
    },
  },
  plugins: [],
};

export default config;


