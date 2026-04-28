/**
 * Community-node lint config for n8n.
 *
 * Uses `plugin:n8n-nodes-base/community` from `eslint-plugin-n8n-nodes-base`
 * so the linter validates n8n-specific conventions (alphabetized options,
 * Name-or-ID dynamic dropdowns, codex shape, package.json structure, etc.).
 */
module.exports = {
	root: true,
	ignorePatterns: ['node_modules/**', 'dist/**', 'gulpfile.js', '*.js', '*.cjs'],
	overrides: [
		{
			files: ['package.json'],
			parser: 'jsonc-eslint-parser',
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/community'],
			rules: {
				'n8n-nodes-base/community-package-json-name-still-default': 'off',
			},
		},
		{
			files: ['./credentials/**/*.ts'],
			parser: '@typescript-eslint/parser',
			parserOptions: {
				project: ['./tsconfig.json'],
				sourceType: 'module',
			},
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
			rules: {
				// The "miscased" rule was designed for the built-in `documentationUrl`
				// slug convention used inside the n8n monorepo (e.g. 'mindee'). Community
				// nodes must point to a real HTTPS URL, which the rule misclassifies.
				'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			},
		},
		{
			files: ['./nodes/**/*.ts'],
			parser: '@typescript-eslint/parser',
			parserOptions: {
				project: ['./tsconfig.json'],
				sourceType: 'module',
			},
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
		},
		{
			files: ['./nodes/**/*.json'],
			parser: 'jsonc-eslint-parser',
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
		},
	],
};
