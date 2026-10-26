/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getGitIgnoreAppendText, getGitIgnorePatterns, getIgnoreDirectoryCandidate, toGitIgnorePattern } from '../ignore';

const execFileAsync = promisify(execFile);

suite('git ignore Git CLI integration', function () {
	let root: string;

	async function git(args: string[]): Promise<string> {
		const result = await execFileAsync('git', args, { cwd: root, encoding: 'utf8' });
		return result.stdout;
	}

	async function ignored(relative: string): Promise<boolean> {
		try {
			await git(['check-ignore', '-q', '--', relative]);
			return true;
		} catch (error) {
			const exitCode = (error as NodeJS.ErrnoException & { code?: string | number }).code;
			if (exitCode === 1) {
				return false;
			}
			throw error;
		}
	}

	async function setPatterns(patterns: readonly string[]): Promise<void> {
		await fs.writeFile(path.join(root, '.gitignore'), patterns.join('\n') + '\n', 'utf8');
	}

	async function expectLiteralFileIgnored(filename: string, unrelated: string): Promise<void> {
		const pattern = toGitIgnorePattern(root, path.join(root, filename));
		assert.ok(pattern, 'Expected a representable Git ignore pattern');
		await setPatterns([pattern]);
		assert.strictEqual(await ignored(filename), true, 'selected filename was not ignored');
		assert.strictEqual(await ignored(unrelated), false, 'unselected filename was ignored');
	}

	suiteSetup(async function () {
		this.timeout(10_000);
		root = await fs.mkdtemp(path.join(os.tmpdir(), 'vscode-git-ignore-'));
		await git(['init', '-q']);
	});

	suiteTeardown(async function () {
		if (root) {
			await fs.rm(root, { recursive: true, force: true });
		}
	});

	suite('literal names versus glob expansion', () => {
		const cases: ReadonlyArray<readonly [string, string, string]> = [
			['literal star', 'a*file.txt', 'another-file.txt'],
			['literal question mark', 'a?file.txt', 'abfile.txt'],
			['literal opening bracket', 'a[file.txt', 'abfile.txt'],
			['literal bracket pair', '[test].txt', 't.txt'],
			['literal closing bracket', 'a]file.txt', 'aXfile.txt'],
			['literal glob class', '[0-9].txt', '1.txt'],
			['literal negated class', '[!a].txt', 'b.txt'],
			['literal double star', 'a**z.txt', 'abcdez.txt'],
			['literal wildcard in directory', 'build*/file.js', 'build-other/file.js'],
			['literal bracket in directory', '[build]/file.js', 'b/file.js'],
			['literal question mark in directory', 'a?/file.js', 'ab/file.js'],
			['literal trailing asterisk', 'file*.txt', 'fileXYZ.txt'],
			['literal trailing question mark', 'file?.txt', 'fileX.txt'],
			['literal space', 'file one.txt', 'file two.txt'],
			['literal leading exclamation', '!notes.txt', 'notes.txt'],
			['literal leading hash', '#notes.txt', 'notes.txt'],
			['literal mid-name hash', 'notes#one.txt', 'notes#two.txt'],
			['literal mid-name exclamation', 'notes!one.txt', 'notes!two.txt'],
			['literal plus sign', 'part+one.txt', 'part-two.txt'],
			['literal parentheses', 'part(1).txt', 'part2.txt'],
			['literal curly brackets', 'part{1}.txt', 'part2.txt'],
			['literal Unicode', 'नमस्ते.txt', 'दूसरा.txt'],
			['literal Japanese', '日本語.txt', 'English.txt'],
			['literal emoji', '🧪.txt', '🏁.txt'],
			['anchored nested filename', 'one/foo.txt', 'two/foo.txt'],
			['anchored deeply nested filename', 'one/two/three/foo.txt', 'one/three/foo.txt'],
			['path with whitespace', 'directory with spaces/one file', 'directory with spaces/two file']
		];

		for (const [name, filename, unrelated] of cases) {
			test(name, async function () {
				if (process.platform === 'win32' && /[?*]/.test(filename)) {
					this.skip();
				}

				await expectLiteralFileIgnored(filename, unrelated);
			});
		}
	});

	suite('directories and exact boundaries', () => {
		test('ignores a folder rather than appending all child entries', async () => {
			const selected = [
				path.join(root, 'node_modules/a/index.js'),
				path.join(root, 'node_modules/b/index.js'),
				path.join(root, 'node_modules/c/index.js')
			];
			const candidate = getIgnoreDirectoryCandidate(root, selected);
			assert.strictEqual(candidate?.pattern, '/node_modules/');
			await setPatterns([candidate!.pattern]);
			assert.strictEqual(await ignored('node_modules/a/index.js'), true);
			assert.strictEqual(await ignored('node_modules/b/index.js'), true);
			assert.strictEqual(await ignored('node_modules/unselected.js'), true);
			assert.strictEqual(await ignored('src/index.js'), false);
		});

		test('does not ignore a similarly named sibling folder', async () => {
			await setPatterns(['/build/']);
			assert.strictEqual(await ignored('build/file.js'), true);
			assert.strictEqual(await ignored('build2/file.js'), false);
		});

		test('anchoring only ignores the root-level directory', async () => {
			await setPatterns(['/cache/']);
			assert.strictEqual(await ignored('cache/saved.json'), true);
			assert.strictEqual(await ignored('src/cache/saved.json'), false);
		});

		test('directory name containing spaces remains literal', async () => {
			await setPatterns(['/generated data/']);
			assert.strictEqual(await ignored('generated data/file.json'), true);
			assert.strictEqual(await ignored('generated-data/file.json'), false);
		});

		test('directory name containing brackets remains literal', async () => {
			const pattern = toGitIgnorePattern(root, path.join(root, '[generated]'), true);
			await setPatterns([pattern!]);
			assert.strictEqual(await ignored('[generated]/file.json'), true);
			assert.strictEqual(await ignored('generated/file.json'), false);
		});

		test('a child rule does not ignore its ancestor', async () => {
			await setPatterns(['/deps/generated/']);
			assert.strictEqual(await ignored('deps/generated/index.js'), true);
			assert.strictEqual(await ignored('deps/README.md'), false);
		});

		test('a rule ending with slash matches an entire directory tree', async () => {
			await setPatterns(['/deps/cache/']);
			assert.strictEqual(await ignored('deps/cache/one.js'), true);
			assert.strictEqual(await ignored('deps/cache/nested/deep.js'), true);
			assert.strictEqual(await ignored('deps/cache2/one.js'), false);
		});
	});

	suite('idempotent end-to-end .gitignore changes', () => {
		test('appending the same file twice does not duplicate a rule', async () => {
			const pattern = toGitIgnorePattern(root, path.join(root, 'generated.txt'))!;
			const first = getGitIgnoreAppendText('', [pattern]);
			const second = getGitIgnoreAppendText(first, [pattern]);
			assert.strictEqual(second, '');
			await fs.writeFile(path.join(root, '.gitignore'), first + second, 'utf8');
			assert.strictEqual((await fs.readFile(path.join(root, '.gitignore'), 'utf8')).split(pattern).length - 1, 1);
			assert.strictEqual(await ignored('generated.txt'), true);
		});

		test('only new entries are appended when a selection overlaps old rules', async () => {
			const first = getGitIgnoreAppendText('', ['/first.txt', '/second.txt']);
			const second = getGitIgnoreAppendText(first, ['/second.txt', '/third.txt']);
			assert.strictEqual(second, '/third.txt\n');
			await fs.writeFile(path.join(root, '.gitignore'), first + second, 'utf8');
			assert.strictEqual(await ignored('first.txt'), true);
			assert.strictEqual(await ignored('second.txt'), true);
			assert.strictEqual(await ignored('third.txt'), true);
			assert.strictEqual(await ignored('fourth.txt'), false);
		});

		test('literal selected file mode leaves sibling files visible', async () => {
			const paths = ['deps/a.js', 'deps/b.js'].map(filename => path.join(root, filename));
			const patterns = getGitIgnorePatterns(root, paths);
			await setPatterns(patterns);
			assert.deepStrictEqual(patterns, ['/deps/a.js', '/deps/b.js']);
			assert.strictEqual(await ignored('deps/a.js'), true);
			assert.strictEqual(await ignored('deps/b.js'), true);
			assert.strictEqual(await ignored('deps/unselected.js'), false);
		});

		test('a new anchored rule can override previous negation', async () => {
			const existing = '/deps/\n!/deps/keep.txt\n';
			const appended = getGitIgnoreAppendText(existing, ['/deps/keep.txt']);
			await fs.writeFile(path.join(root, '.gitignore'), existing + appended, 'utf8');
			assert.strictEqual(await ignored('deps/keep.txt'), true);
		});

		test('original rules and comments are preserved byte-for-byte', async () => {
			const existing = '# Preserve header\r\n\r\n/old.txt\r\n';
			const appended = getGitIgnoreAppendText(existing, ['/new.txt']);
			await fs.writeFile(path.join(root, '.gitignore'), existing + appended, 'utf8');
			assert.strictEqual(await fs.readFile(path.join(root, '.gitignore'), 'utf8'), '# Preserve header\r\n\r\n/old.txt\r\n/new.txt\r\n');
			assert.strictEqual(await ignored('old.txt'), true);
			assert.strictEqual(await ignored('new.txt'), true);
		});
	});
});
