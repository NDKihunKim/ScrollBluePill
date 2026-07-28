/** @type {import("prettier").Config} */
export default {
  // Let the Astro plugin handle .astro files
  plugins: ['prettier-plugin-astro'],

  // Override formatting for .astro files — use the astro parser
  overrides: [
    {
      files: '*.astro',
      options: { parser: 'astro' },
    },
  ],

  // Reasonable defaults for a modern codebase
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  semi: true,
};
