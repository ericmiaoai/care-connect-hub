/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000', 
        surface: '#1C1C1E', 
        surfaceSecondary: '#2C2C2E', 
        primary: '#0A84FF', 
        success: '#32D74B', 
        warning: '#FFD60A', 
        error: '#FF453A', 
        textPrimary: '#FFFFFF',
        textSecondary: '#EBEBF5',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ]
      }
    },
  },
  plugins: [],
}
