import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	mocha: {
		ui: 'tdd',
		timeout: 60000
	},
	launchArgs: [
		'--disable-extensions',
		'--disable-gpu'
	],
	env: {
		SFDX_DISABLE_TELEMETRY: 'true',
		SF_DISABLE_TELEMETRY: 'true',
		SFDX_USE_GENERIC_UNIX_KEYCHAIN: 'true',
		SF_USE_GENERIC_UNIX_KEYCHAIN: 'true',
		SFDX_DISABLE_INSIGHTS: 'true',
		SF_DISABLE_INSIGHTS: 'true'
	}
});
