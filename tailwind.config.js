/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // ← enables .dark class strategy
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};