module.exports = {
  important: "#storefront",
  content: ["./app/**/*.{js,jsx}", "./components/store/**/*.{js,jsx}"],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        ink: "#10233a",
        tide: "#1a6b6b",
        foam: "#e8f1f4",
      },
      fontFamily: {
        display: ["Syne", "sans-serif"],
        sans: ["Manrope", "sans-serif"],
      },
    },
  },
};
