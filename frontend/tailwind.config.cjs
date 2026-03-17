/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aida: {
          teal:    '#028897',  // Darker Teal — primary brand color
          dark:    '#003C43',  // Darkest Teal — sidebar, headers
          light:   '#E3FEF7',  // Dull Teal — backgrounds
          mint:    '#A5FBE5',  // Mild Teal — highlights
          red:     '#940606',  // Accent Red
        },
      },
      fontFamily: {
        sans: ['Open Sauce One', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
