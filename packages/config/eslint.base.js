/** Shared ESLint config for Social Growth OS packages. */
module.exports = {
  root: false,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-console": ["warn", { allow: ["warn", "error", "log"] }],
  },
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ["dist/", ".next/", "node_modules/"],
};
