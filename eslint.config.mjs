import globals from "globals";
import pluginJs from "@eslint/js";
import tailwind from "eslint-plugin-tailwindcss";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        PACKAGE_VERSION: "readonly",
        PACKAGE_DATE: "readonly",
      }
    }
  },
  pluginJs.configs.recommended,
  ...tailwind.configs["flat/recommended"],
];