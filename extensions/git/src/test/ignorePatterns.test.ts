/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as path from 'path';
import { getGitIgnorePatterns, toGitIgnorePattern } from '../ignore';

suite('git ignore pattern generation', () => {
	const posixRoot = '/workspace/project';
	const windowsRoot = 'C:\\workspace\\project';

	suite('literal POSIX filenames', () => {
		const cases: ReadonlyArray<readonly [string, string]> = [
			['index.ts', '/index.ts'],
			['src/index.ts', '/src/index.ts'],
			['src/index.test.ts', '/src/index.test.ts'],
			['src/index.spec.ts', '/src/index.spec.ts'],
			['README.md', '/README.md'],
			['.env', '/.env'],
			['.env.local', '/.env.local'],
			['.gitignore', '/.gitignore'],
			['.gitattributes', '/.gitattributes'],
			['.vscode/settings.json', '/.vscode/settings.json'],
			['test data/file.txt', '/test data/file.txt'],
			['folder with spaces/a b c.txt', '/folder with spaces/a b c.txt'],
			['file name.txt', '/file name.txt'],
			['a.b.c', '/a.b.c'],
			['file:name', '/file:name'],
			['file=name', '/file=name'],
			['file+name', '/file+name'],
			['file,name', '/file,name'],
			['file;name', '/file;name'],
			['file@name', '/file@name'],
			['file$name', '/file$name'],
			['file(name)', '/file(name)'],
			['file{name}', '/file{name'],
			['file^name', '/file^name'],
			['file%name', '/file%name'],
			['file&name', '/file&name'],
			['file|name', '/file|name'],
			['file<name', '/file<name'],
			['file>name', '/file>name'],
			['name # one.txt', '/name # one.txt'],
			['#comments.txt', '/#comments.txt'],
			['!important.txt', '/!important.txt'],
			['src/#comments.txt', '/src/#comments.txt'],
			['src/!important.txt', '/src/!important.txt'],
			['src/[test].txt', '/src/\\[test\\].txt'],
			['src/a[b].txt', '/src/a\\[b\\].txt'],
			['src/a]b.txt', '/src/a\\]b.txt'],
			['src/a[b.txt', '/src/a\\[b.txt'],
			['src/a*b.txt', '/src/a\\*b.txt'],
			['src/a?b.txt', '/src/a\\?b.txt'],
			['src/a**b.txt', '/src/a\\*\\*b.txt'],
			['src/*.map', '/src/\\*.map'],
			['src/file?.txt', '/src/file\\?.txt'],
			['src/[0-9].txt', '/src/\\[0-9\\].txt'],
			['src/a[bc]d', '/src/a\\[bc\\]d'],
			['src/a[!bc]d', '/src/a\\[!bc\\]d'],
			['src/path\\name', '/src/path\\\\name'],
			['src/ends in space ', '/src/ends in space\\ '],
			['src/multiple   ', '/src/multiple\\ \\ \\ '],
			['dir name /file', '/dir name\\ /file'],
			['dir name /file ', '/dir name\\ /file\\ '],
			['a b c/file d e', '/a b c/file d e'],
			['a b c/file d e ', '/a b c/file d e\\ '],
			['nested/a*b/c?d', '/nested/a\\*b/c\\?d'],
			['nested/[part]/file', '/nested/\\[part\\]/file'],
			['nested/[part]/file name', '/nested/\\[part\\]/file name'],
			['build/file with [brackets].js', '/build/file with \\[brackets\\].js'],
			['build/index*.js', '/build/index\\*.js'],
			['build/data?.json', '/build/data\\?.json'],
			['a/b/c/d/e/f/g/h/i.js', '/a/b/c/d/e/f/g/h/i.js'],
			['a/b/c/[d]/e?.js', '/a/b/c/\\[d\\]/e\\?.js'],
			['a/../b.txt', '/b.txt'],
			['a/b/../../README.md', '/README.md'],
			['a//b///c.txt', '/a/b/c.txt'],
			['a/./b/./c.txt', '/a/b/c.txt'],
			['A.TXT', '/A.TXT'],
			['CamelCase/FileName', '/CamelCase/FileName'],
			['unicode/नमस्ते.txt', '/unicode/नमस्ते.txt'],
			['unicode/日本語.txt', '/unicode/日本語.txt'],
			['unicode/école.txt', '/unicode/école.txt'],
			['unicode/😀.txt', '/unicode/😀.txt'],
			['unicode/العربية.txt', '/unicode/العربية.txt'],
			['unicode/한국어.txt', '/unicode/한국어.txt'],
			['unicode/עברית.txt', '/unicode/עברית.txt'],
			['unicode/Ελληνικά.txt', '/unicode/Ελληνικά.txt'],
			['unicode/ไทย.txt', '/unicode/ไทย.txt'],
			['unicode/हिंदी/फ़ाइल.txt', '/unicode/हिंदी/फ़ाइल.txt'],
			['symbols/~!@#$%^&()', '/symbols/~!@#$%^&()'],
			['symbols/one+two=three', '/symbols/one+two=three'],
			['symbols/this,is;a:test', '/symbols/this,is;a:test'],
			['a/file (1).txt', '/a/file (1).txt'],
			['a/file (copy).txt', '/a/file (copy).txt'],
			['a/-leading-dash', '/a/-leading-dash'],
			['a/--double-dash', '/a/--double-dash'],
			['a/.hidden-file', '/a/.hidden-file'],
			['a/file..txt', '/a/file..txt'],
			['a/file~', '/a/file~'],
			['a/backup~2026', '/a/backup~2026'],
			['a/(draft) 1.txt', '/a/(draft) 1.txt'],
			['a/{draft} 1.txt', '/a/{draft} 1.txt'],
			['a/file#1.txt', '/a/file#1.txt'],
			['a/file!1.txt', '/a/file!1.txt']
		];

		for (const [filename, expected] of cases) {
			test('escapes ' + JSON.stringify(filename), () => {
				const input = path.posix.join(posixRoot, filename);
				assert.strictEqual(toGitIgnorePattern(posixRoot, input, false, path.posix), expected);
			});
		}
	});

	suite('absolute paths and directories', () => {
		test('adds a slash only for explicitly selected directories', () => {
			assert.strictEqual(toGitIgnorePattern(posixRoot, posixRoot + '/build', true, path.posix), '/build/');
			assert.strictEqual(toGitIgnorePattern(posixRoot, posixRoot + '/build', false, path.posix), '/build');
		});
		test('escapes directory names containing glob metacharacters', () => {
			assert.strictEqual(toGitIgnorePattern(posixRoot, posixRoot + '/[build]?*', true, path.posix), '/\\[build\\]\\?\\*/');
		});
		test('rejects a sibling repository', () => {
			assert.strictEqual(toGitIgnorePattern(posixRoot, '/workspace/another/data.txt', false, path.posix), undefined);
		});
		test('rejects a parent directory', () => {
			assert.strictEqual(toGitIgnorePattern(posixRoot, '/workspace', false, path.posix), undefined);
		});
		test('rejects repository root', () => {
			assert.strictEqual(toGitIgnorePattern(posixRoot, posixRoot, true, path.posix), undefined);
		});
		test('rejects relative paths', () => {
			assert.strictEqual(toGitIgnorePattern(posixRoot, 'sub/file.txt', false, path.posix), undefined);
		});
		test('rejects relative traversal', () => {
			assert.strictEqual(toGitIgnorePattern(posixRoot, '../another/file.txt', false, path.posix), undefined);
		});
		test('rejects newline and carriage return', () => {
			assert.strictEqual(toGitIgnorePattern(posixRoot, posixRoot + '/has\nnewline', false, path.posix), undefined);
			assert.strictEqual(toGitIgnorePattern(posixRoot, posixRoot + '/has\rnewline', false, path.posix), undefined);
		});
		test('rejects NUL in a file name', () => {
			assert.strictEqual(toGitIgnorePattern(posixRoot, posixRoot + '/nul\0byte', false, path.posix), undefined);
		});
		test('normalizes traversal within repository', () => {
			assert.strictEqual(toGitIgnorePattern(posixRoot, posixRoot + '/a/../b.txt', false, path.posix), '/b.txt');
		});
	});

	suite('Windows paths', () => {
		const cases: ReadonlyArray<readonly [string, string]> = [
			['src\\main.ts', '/src/main.ts'],
			['node_modules\\package\\index.js', '/node_modules/package/index.js'],
			['build output\\main.js', '/build output/main.js'],
			['build\\[name].js', '/build/\\[name\\].js'],
			['build\\foo*bar', '/build/foo\\*bar'],
			['build\\foo?bar', '/build/foo\\?bar'],
			['build\\file ', '/build/file\\ '],
			['src\\a\\..\\b.ts', '/src/b.ts'],
			['docs\\read me.md', '/docs/read me.md'],
			['unicode\\नमस्ते.txt', '/unicode/नमस्ते.txt'],
			['assets\\日本語.json', '/assets/日本語.json'],
			['tmp\\(copy) file.txt', '/tmp/(copy) file.txt']
		];
		for (const [filename, expected] of cases) {
			test('normalizes ' + JSON.stringify(filename), () => {
				assert.strictEqual(toGitIgnorePattern(windowsRoot, path.win32.join(windowsRoot, filename), false, path.win32), expected);
			});
		}
		test('rejects another drive', () => {
			assert.strictEqual(toGitIgnorePattern(windowsRoot, 'D:\\workspace\\project\\file', false, path.win32), undefined);
		});
		test('rejects a sibling on same drive', () => {
			assert.strictEqual(toGitIgnorePattern(windowsRoot, 'C:\\workspace\\other\\file', false, path.win32), undefined);
		});
		test('supports differently-cased prefix on Windows', () => {
			assert.strictEqual(toGitIgnorePattern(windowsRoot, 'c:\\WORKSPACE\\PROJECT\\file.txt', false, path.win32), '/file.txt');
		});
		test('normalizes nested Windows separators', () => {
			assert.strictEqual(toGitIgnorePattern(windowsRoot, 'C:\\workspace\\project\\a\\b\\c.txt', false, path.win32), '/a/b/c.txt');
		});
	});

	suite('bulk selections', () => {
		test('preserves order', () => {
			assert.deepStrictEqual(getGitIgnorePatterns(posixRoot, [posixRoot + '/z', posixRoot + '/a', posixRoot + '/b'], false, path.posix), ['/z', '/a', '/b']);
		});
		test('deduplicates repeated selection', () => {
			assert.deepStrictEqual(getGitIgnorePatterns(posixRoot, [posixRoot + '/a', posixRoot + '/a', posixRoot + '/b', posixRoot + '/a'], false, path.posix), ['/a', '/b']);
		});
		test('excludes paths outside repository', () => {
			assert.deepStrictEqual(getGitIgnorePatterns(posixRoot, ['/other/a', posixRoot + '/a', '/other/b'], false, path.posix), ['/a']);
		});
		test('excludes nonrepresentable names', () => {
			assert.deepStrictEqual(getGitIgnorePatterns(posixRoot, [posixRoot + '/a\nnew', posixRoot + '/valid'], false, path.posix), ['/valid']);
		});
		test('handles thousands of duplicate paths', () => {
			const selected = Array.from({ length: 1200 }, (_, index) => posixRoot + '/deps/file-' + (index % 400) + '.js');
			const expected = Array.from({ length: 400 }, (_, index) => '/deps/file-' + index + '.js');
			assert.deepStrictEqual(getGitIgnorePatterns(posixRoot, selected, false, path.posix), expected);
		});
	});
});
