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
    },
  },
  plugins: [],
};

export default config;

