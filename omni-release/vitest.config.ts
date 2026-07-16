import { defineConfig } from "vitest/config";

// The source uses NodeNext ESM `.js` specifiers that point at `.ts` files.
// extensionAlias lets Vitest resolve those `.js` imports to the real `.ts`.
export default defineConfig({
  resolve: {
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
