/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as path from 'path';
import { getIgnoreDirectoryCandidate } from '../ignore';

suite('git ignore directory selection', () => {
	const root = '/workspace/project';
	const within = (filename: string): string => path.posix.join(root, filename);

	suite('common ancestor rules', () => {
		const cases: ReadonlyArray<{
			name: string;
			files: readonly string[];
			expected: string | undefined;
		}> = [
			{
				name: 'two files in a package directory',
				files: ['node_modules/a.js', 'node_modules/b.js'],
				expected: 'node_modules'
			},
			{
				name: 'nested dependency directories',
				files: ['node_modules/a/index.js', 'node_modules/b/index.js'],
				expected: 'node_modules'
			},
			{
				name: 'deep common ancestor',
				files: ['external/node_modules/x/a', 'external/node_modules/x/b'],
				expected: 'external/node_modules/x'
			},
			{
				name: 'sibling child directories',
				files: ['external/a/index.js', 'external/b/index.js'],
				expected: 'external'
			},
			{
				name: 'three files in the same folder',
				files: ['build/a.js', 'build/b.js', 'build/c.js'],
				expected: 'build'
			},
			{
				name: 'nested files below a direct child',
				files: ['build/a.js', 'build/nested/b.js'],
				expected: 'build'
			},
			{
				name: 'nested files at multiple depths',
				files: ['build/a.js', 'build/a/b/c.js', 'build/d/e/f.js'],
				expected: 'build'
			},
			{
				name: 'a file and its sibling',
				files: ['generated/output.log', 'generated/input.log'],
				expected: 'generated'
			},
			{
				name: 'hidden and normal files',
				files: ['generated/.metadata', 'generated/output.log'],
				expected: 'generated'
			},
			{
				name: 'files with wildcard characters',
				files: ['build/x*.js', 'build/y?.js'],
				expected: 'build'
			},
			{
				name: 'common folder containing a wildcard',
				files: ['[generated]/a', '[generated]/b'],
				expected: '[generated]'
			},
			{
				name: 'common folder with whitespace',
				files: ['generated data/a', 'generated data/b'],
				expected: 'generated data'
			},
			{
				name: 'common folder with trailing spaces',
				files: ['generated /a', 'generated /b'],
				expected: 'generated '
			},
			{
				name: 'Unicode folder',
				files: ['नमस्ते/a', 'नमस्ते/b'],
				expected: 'नमस्ते'
			},
			{
				name: 'mixed case directory names',
				files: ['Source/a', 'Source/b'],
				expected: 'Source'
			},
			{
				name: 'nested folder with dot',
				files: ['.cache/generated/a', '.cache/generated/b'],
				expected: '.cache/generated'
			},
			{
				name: 'directory whose name begins with a dot',
				files: ['.cache/a', '.cache/b'],
				expected: '.cache'
			},
			{
				name: 'directory whose name starts with dash',
				files: ['-cache/a', '-cache/b'],
				expected: '-cache'
			},
			{
				name: 'several intermediate directories',
				files: ['a/b/c/d/e/one', 'a/b/c/d/e/two'],
				expected: 'a/b/c/d/e'
			},
			{
				name: 'different deepest directories',
				files: ['a/b/c/d/one', 'a/b/c/e/two'],
				expected: 'a/b/c'
			},
			{
				name: 'root-level siblings',
				files: ['one.js', 'two.js'],
				expected: undefined
			},
			{
				name: 'root and nested file',
				files: ['one.js', 'build/two.js'],
				expected: undefined
			},
			{
				name: 'files in distinct root folders',
				files: ['build/one.js', 'src/two.js'],
				expected: undefined
			},
			{
				name: 'one selection',
				files: ['build/one.js'],
				expected: undefined
			},
			{
				name: 'empty selection',
				files: [],
				expected: undefined
			},
			{
				name: 'only one unique path',
				files: ['build/one.js', 'build/one.js'],
				expected: undefined
			},
			{
				name: 'identical path with normalized components',
				files: ['build/a/../one.js', 'build/one.js'],
				expected: undefined
			},
			{
				name: 'a path outside the repository',
				files: ['build/a.js', '../another/b.js'],
				expected: undefined
			},
			{
				name: 'a line break in a selected path',
				files: ['build/a.js', 'build/b\nc.js'],
				expected: undefined
			},
			{
				name: 'a carriage return in a selected path',
				files: ['build/a.js', 'build/b\rc.js'],
				expected: undefined
			},
			{
				name: 'a NUL byte in a selected path',
				files: ['build/a.js', 'build/b\0c.js'],
				expected: undefined
			}
		];

		for (const scenario of cases) {
			test(scenario.name, () => {
				const absolute = scenario.files.map(within);
				const candidate = getIgnoreDirectoryCandidate(root, absolute, path.posix);

				assert.strictEqual(candidate?.relativePath, scenario.expected);
				if (scenario.expected) {
					assert.strictEqual(candidate?.absolutePath, within(scenario.expected));
					assert.strictEqual(candidate?.fileCount, new Set(absolute).size);
					assert.strictEqual(candidate?.pattern.endsWith('/'), true);
				} else {
					assert.strictEqual(candidate, undefined);
				}
			});
		}
	});

	suite('deduplication and path boundaries', () => {
		test('a duplicate path does not increase the selection count', () => {
			const candidate = getIgnoreDirectoryCandidate(root, [
				within('build/a'), within('build/a'), within('build/b'),
				within('build/b'), within('build/a')
			], path.posix);
			assert.strictEqual(candidate?.fileCount, 2);
		});

		test('an absolute path to another repository cancels the folder suggestion', () => {
			const candidate = getIgnoreDirectoryCandidate(root, [
				within('build/a'), within('build/b'), '/workspace/another/c'
			], path.posix);
			assert.strictEqual(candidate, undefined);
		});

		test('a path at the repository root does not suggest the whole repository', () => {
			const candidate = getIgnoreDirectoryCandidate(root, [
				root, within('build/a'), within('build/b')
			], path.posix);
			assert.strictEqual(candidate, undefined);
		});

		test('a relative path is rejected to avoid confusing the prompt', () => {
			const candidate = getIgnoreDirectoryCandidate(root, [
				'build/a', within('build/b')
			], path.posix);
			assert.strictEqual(candidate, undefined);
		});

		test('similar folder prefixes are not treated as the same directory', () => {
			const candidate = getIgnoreDirectoryCandidate(root, [
				within('build/a'), within('build2/a')
			], path.posix);
			assert.strictEqual(candidate, undefined);
		});

		test('does not infer a directory from a single file', () => {
			const candidate = getIgnoreDirectoryCandidate(root, [
				within('node_modules/huge-file')
			], path.posix);
			assert.strictEqual(candidate, undefined);
		});

		test('handles a generated set of one thousand selected files', () => {
			const files = Array.from({ length: 1000 }, (_, i) => within('node_modules/pkg-' + i + '/index.js'));
			const candidate = getIgnoreDirectoryCandidate(root, files, path.posix);
			assert.strictEqual(candidate?.relativePath, 'node_modules');
			assert.strictEqual(candidate?.pattern, '/node_modules/');
			assert.strictEqual(candidate?.fileCount, 1000);
		});

		test('handles repeated paths across multiple subdirectories', () => {
			const files = Array.from({ length: 900 }, (_, i) => within('node_modules/pkg-' + (i % 100) + '/index.js'));
			const candidate = getIgnoreDirectoryCandidate(root, files, path.posix);
			assert.strictEqual(candidate?.relativePath, 'node_modules');
			assert.strictEqual(candidate?.fileCount, 100);
		});

		test('preserves escaped wildcard directory name in suggested pattern', () => {
			const candidate = getIgnoreDirectoryCandidate(root, [
				within('[build]?/a'), within('[build]?/b')
			], path.posix);
			assert.strictEqual(candidate?.pattern, '/\\[build\\]\\?/');
		});

		test('preserves escaped trailing spaces in directory name', () => {
			const candidate = getIgnoreDirectoryCandidate(root, [
				within('generated /a'), within('generated /b')
			], path.posix);
			assert.strictEqual(candidate?.pattern, '/generated\\ /');
		});
	});

	suite('Windows directory selection', () => {
		const windowsRoot = 'C:\\dev\\my-project';
		const make = (file: string) => path.win32.join(windowsRoot, file);

		test('suggests node_modules under a Windows root', () => {
			const result = getIgnoreDirectoryCandidate(windowsRoot, [
				make('node_modules\\a\\index.js'),
				make('node_modules\\b\\index.js')
			], path.win32);
			assert.strictEqual(result?.relativePath, 'node_modules');
			assert.strictEqual(result?.pattern, '/node_modules/');
		});

		test('handles several nested folders using backslashes', () => {
			const result = getIgnoreDirectoryCandidate(windowsRoot, [
				make('build\\cache\\a\\one.js'),
				make('build\\cache\\b\\two.js')
			], path.win32);
			assert.strictEqual(result?.relativePath, 'build/cache');
			assert.strictEqual(result?.pattern, '/build/cache/');
		});

		test('escapes a wildcard in the common folder', () => {
			const result = getIgnoreDirectoryCandidate(windowsRoot, [
				make('cache[1]\\a'), make('cache[1]\\b')
			], path.win32);
			assert.strictEqual(result?.pattern, '/cache\\[1\\]/');
		});

		test('refuses to suggest across drives', () => {
			const result = getIgnoreDirectoryCandidate(windowsRoot, [
				make('build\\a'),
				'D:\\dev\\another\\build\\b'
			], path.win32);
			assert.strictEqual(result, undefined);
		});

		test('refuses root-level unrelated directories', () => {
			const result = getIgnoreDirectoryCandidate(windowsRoot, [
				make('dist\\a'), make('cache\\b')
			], path.win32);
			assert.strictEqual(result, undefined);
		});

		test('deduplicates Windows paths after normalization', () => {
			const result = getIgnoreDirectoryCandidate(windowsRoot, [
				make('dist\\a'), make('dist\\.\\a'), make('dist\\b')
			], path.win32);
			assert.strictEqual(result?.fileCount, 2);
		});
	});
});
