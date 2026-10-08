import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { createNodeResolver, importX } from 'eslint-plugin-import-x';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintSortDestructure from 'eslint-plugin-sort-destructure-keys';
import globals from 'globals';
import tseslint, { configs as tseslintConfigs } from 'typescript-eslint';

export default tseslint.config(
	{
		// Global ignores — must be in a standalone block to take effect across all configs.
		ignores: ['**/dist/**', '**/*.md'],
	},
	{
		extends: [
			js.configs.recommended,
			stylistic.configs.recommended,
			stylistic.configs.customize({ indent: 'tab', quotes: 'single', arrowParens: 'always', semi: true }),
			importX.flatConfigs.recommended,
			importX.flatConfigs.typescript,
			tseslintConfigs.recommendedTypeChecked,
		],
		plugins: {
			'simple-import-sort': simpleImportSort,
			'sort-destructure-keys': eslintSortDestructure,
		},
		rules: {
			// General ESLint rules based on Airbnb's style guide
			'complexity': ['error', 25], // Adjust complexity threshold as needed
			'eqeqeq': ['error', 'always'],
			'curly': ['error', 'all'],
			'quotes': ['error', 'single'],
			'arrow-body-style': ['error', 'as-needed'],
			'array-callback-return': 'error',
			'dot-notation': 'error',
			'object-shorthand': 'error',
			'func-style': ['error', 'expression'],
			'prefer-template': 'error',
			'prefer-arrow-callback': 'error',
			'no-unneeded-ternary': 'error',
			'no-shadow': 'error',
			'no-nested-ternary': 'error',
			'no-lonely-if': 'error',
			'no-else-return': 'error',
			'no-undef': 'error',
			'no-template-curly-in-string': 'error',
			'no-use-before-define': 1,
			'no-console': 0,
			'@stylistic/multiline-ternary': 0,
			'@stylistic/operator-linebreak': ['error', 'after', { overrides: { '?': 'before', ':': 'before' } }],
			'@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],

			// Import / export rules
			'simple-import-sort/imports': 'error',
			'simple-import-sort/exports': 'error',
			'import-x/extensions': ['error', 'never'],
			'sort-destructure-keys/sort-destructure-keys': 'error',
		},
		languageOptions: {
			globals: {
				...globals.node,
				...globals.browser,
				BufferEncoding: 'readonly',
			},
			ecmaVersion: 'latest',
			parserOptions: {
				parser: tsParser,
				ecmaVersion: 'latest',
				sourceType: 'module',
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		settings: {
			'import-x/resolver-next': [createTypeScriptImportResolver(), createNodeResolver()],
		},
	},
	{
		files: ['**/*.{js,mjs,cjs}'],
		extends: [tseslintConfigs.disableTypeChecked],
	},
	{
		// node:test gibt Promises aus describe/it zurück, der Runner wartet selbst darauf.
		files: ['**/*.test.ts'],
		rules: {
			'@typescript-eslint/no-floating-promises': 'off',
		},
	},
	{
		files: ['**/*.{ts,tsx}'],
		rules: {
			'@stylistic/indent': 'off', // Disable for TypeScript files to prevent stack overflow
		},
	},
);
