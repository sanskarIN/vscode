/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { getGitIgnoreAppendText } from '../ignore';

suite('git ignore document updates', () => {
	suite('empty and existing documents', () => {
		test('appends a single rule to a blank document', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['/build/']), '/build/\n');
		});

		test('appends several rules to a blank document', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['/build/', '/cache/']), '/build/\n/cache/\n');
		});

		test('appends after an existing newline', () => {
			assert.strictEqual(getGitIgnoreAppendText('/old/\n', ['/new/']), '/new/\n');
		});

		test('adds a separating newline when needed', () => {
			assert.strictEqual(getGitIgnoreAppendText('/old/', ['/new/']), '\n/new/\n');
		});

		test('preserves LF in existing content', () => {
			assert.strictEqual(getGitIgnoreAppendText('a\nb\n', ['/c/']), '/c/\n');
		});

		test('preserves CRLF in existing content', () => {
			assert.strictEqual(getGitIgnoreAppendText('a\r\nb\r\n', ['/c/']), '/c/\r\n');
		});

		test('adds CRLF separator when document lacks terminal newline', () => {
			assert.strictEqual(getGitIgnoreAppendText('a\r\nb', ['/c/']), '\r\n/c/\r\n');
		});

		test('handles existing blank lines', () => {
			assert.strictEqual(getGitIgnoreAppendText('\n\n', ['/new/']), '/new/\n');
		});

		test('handles a document ending in an empty line', () => {
			assert.strictEqual(getGitIgnoreAppendText('a\n\n', ['/new/']), '/new/\n');
		});

		test('does not append a rule already on the first line', () => {
			assert.strictEqual(getGitIgnoreAppendText('/build/\n/other/\n', ['/build/']), '');
		});

		test('does not append a rule already on the last line', () => {
			assert.strictEqual(getGitIgnoreAppendText('/other/\n/build/', ['/build/']), '');
		});

		test('does not append a rule already in the middle', () => {
			assert.strictEqual(getGitIgnoreAppendText('/a/\n/build/\n/z/', ['/build/']), '');
		});

		test('does not append a rule already in CRLF content', () => {
			assert.strictEqual(getGitIgnoreAppendText('/a/\r\n/build/\r\n/z/\r\n', ['/build/']), '');
		});

		test('recognizes an exact match, but does not trim existing lines', () => {
			assert.strictEqual(getGitIgnoreAppendText('/build/ \n', ['/build/']), '/build/\n');
		});

		test('leaves comments as comments', () => {
			assert.strictEqual(getGitIgnoreAppendText('# /build/\n', ['/build/']), '/build/\n');
		});

		test('leaves negated rules intact', () => {
			assert.strictEqual(getGitIgnoreAppendText('!/build/\n', ['/build/']), '/build/\n');
		});

		test('does not interpret existing Git patterns', () => {
			assert.strictEqual(getGitIgnoreAppendText('/build*\n', ['/build/']), '/build/\n');
		});

		test('does not convert relative rules into anchored rules', () => {
			assert.strictEqual(getGitIgnoreAppendText('build/\n', ['/build/']), '/build/\n');
		});

		test('preserves existing content without a new entry', () => {
			assert.strictEqual(getGitIgnoreAppendText('/build/\n', ['/build/']), '');
		});

		test('does not append an empty request', () => {
			assert.strictEqual(getGitIgnoreAppendText('/build/\n', []), '');
		});

		test('does not append when all requested rules are duplicates', () => {
			assert.strictEqual(getGitIgnoreAppendText('/build/\n/cache/\n', ['/cache/', '/build/']), '');
		});

		test('does not add extra separators to an empty document', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['/a/']), '/a/\n');
		});

		test('keeps surrounding text unchanged', () => {
			const current = '# Copyright\n\n*.tmp\n!/important.tmp\n\n';
			const next = getGitIgnoreAppendText(current, ['/cache/']);
			assert.strictEqual(current + next, '# Copyright\n\n*.tmp\n!/important.tmp\n\n/cache/\n');
		});
	});

	suite('request filtering and stable ordering', () => {
		test('deduplicates entries inside one request', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['/a/', '/a/', '/b/', '/a/']), '/a/\n/b/\n');
		});

		test('keeps original ordering, not alphabetical ordering', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['/z/', '/c/', '/a/', '/b/']), '/z/\n/c/\n/a/\n/b/\n');
		});

		test('does not repeat rules present in existing content', () => {
			assert.strictEqual(getGitIgnoreAppendText('/b/\n', ['/a/', '/b/', '/c/']), '/a/\n/c/\n');
		});

		test('ignores empty rules', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['', '/valid/']), '/valid/\n');
		});

		test('ignores rules containing newline', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['/unsafe\nrule', '/valid/']), '/valid/\n');
		});

		test('ignores rules containing carriage return', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['/unsafe\rrule', '/valid/']), '/valid/\n');
		});

		test('ignores rules containing NUL', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['/unsafe\0rule', '/valid/']), '/valid/\n');
		});

		test('retains literal bracket escapes', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['/\\[a\\].txt']), '/\\[a\\].txt\n');
		});

		test('retains literal star escapes', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['/a\\*b.txt']), '/a\\*b.txt\n');
		});

		test('retains literal question-mark escapes', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['/a\\?b.txt']), '/a\\?b.txt\n');
		});

		test('retains escaped trailing spaces', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['/file\\ ']), '/file\\ \n');
		});

		test('accepts rules with Unicode letters', () => {
			assert.strictEqual(getGitIgnoreAppendText('', ['/हिंदी/', '/日本語/']), '/हिंदी/\n/日本語/\n');
		});

		test('handles a request with thousands of repeated entries', () => {
			const patterns = Array.from({ length: 2000 }, (_, index) => '/dep-' + (index % 100) + '/');
			const expected = Array.from({ length: 100 }, (_, index) => '/dep-' + index + '/').join('\n') + '\n';
			assert.strictEqual(getGitIgnoreAppendText('', patterns), expected);
		});
	});

	suite('idempotence and two-step updates', () => {
		test('a second identical append is a no-op', () => {
			const first = getGitIgnoreAppendText('', ['/a/', '/b/']);
			const second = getGitIgnoreAppendText(first, ['/a/', '/b/']);
			assert.strictEqual(first, '/a/\n/b/\n');
			assert.strictEqual(second, '');
		});

		test('a second append only adds newly selected rules', () => {
			const first = getGitIgnoreAppendText('', ['/a/', '/b/']);
			const second = getGitIgnoreAppendText(first, ['/b/', '/c/']);
			assert.strictEqual(first + second, '/a/\n/b/\n/c/\n');
		});

		test('CRLF roundtrip remains CRLF', () => {
			const first = 'existing\r\n' + getGitIgnoreAppendText('existing\r\n', ['/a/']);
			const second = getGitIgnoreAppendText(first, ['/b/']);
			assert.strictEqual(first + second, 'existing\r\n/a/\r\n/b/\r\n');
		});

		test('a file without a final newline gets one before the new rules', () => {
			const first = '/before' + getGitIgnoreAppendText('/before', ['/new/']);
			const second = getGitIgnoreAppendText(first, ['/last/']);
			assert.strictEqual(first + second, '/before\n/new/\n/last/\n');
		});

		test('negated rules retain their order relative to new rules', () => {
			const existing = '/cache/\n!/cache/keep.json\n';
			const appended = getGitIgnoreAppendText(existing, ['/node_modules/']);
			assert.strictEqual(existing + appended, '/cache/\n!/cache/keep.json\n/node_modules/\n');
		});

		test('comments and blank lines stay untouched on repeat updates', () => {
			const existing = '# header\r\n\r\n*.log\r\n';
			const once = existing + getGitIgnoreAppendText(existing, ['/cache/']);
			const twice = once + getGitIgnoreAppendText(once, ['/cache/', '/tmp/']);
			assert.strictEqual(twice, '# header\r\n\r\n*.log\r\n/cache/\r\n/tmp/\r\n');
		});
	});
});
