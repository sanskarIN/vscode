/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createFileDataTransferItem, createStringDataTransferItem, VSDataTransfer } from '../../common/dataTransfer.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from './utils.js';

suite('VSDataTransfer', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suite('append', () => {
		for (const firstMimeType of ['text/plain', 'Text/Plain', 'TEXT/PLAIN']) {
			for (const secondMimeType of ['text/plain', 'Text/Plain', 'TEXT/PLAIN']) {
				test(`preserves entries when appending ${secondMimeType} after ${firstMimeType}`, () => {
					const transfer = new VSDataTransfer();
					const first = createStringDataTransferItem('first');
					const second = createStringDataTransferItem('second');
					transfer.append(firstMimeType, first);
					transfer.append(secondMimeType, second);

					assert.deepStrictEqual({
						size: transfer.size,
						first: transfer.get('Text/Plain'),
						entries: Array.from(transfer),
					}, {
						size: 1,
						first,
						entries: [['text/plain', first], ['text/plain', second]],
					});
				});
			}
		}

		test('preserves other MIME types when appending to an existing type', () => {
			const transfer = new VSDataTransfer();
			const first = createStringDataTransferItem('first');
			const html = createStringDataTransferItem('<p>html</p>');
			const second = createStringDataTransferItem('second');
			transfer.append('text/plain', first);
			transfer.append('text/html', html);
			transfer.append('TEXT/PLAIN', second);

			assert.deepStrictEqual(Array.from(transfer), [
				['text/plain', first],
				['text/plain', second],
				['text/html', html],
			]);
		});

		test('appends to a replaced entry regardless of MIME type casing', () => {
			const transfer = new VSDataTransfer();
			const replacement = createStringDataTransferItem('replacement');
			const appended = createStringDataTransferItem('appended');
			transfer.append('text/plain', createStringDataTransferItem('original'));
			transfer.replace('Text/Plain', replacement);
			transfer.append('TEXT/PLAIN', appended);

			assert.deepStrictEqual(Array.from(transfer), [
				['text/plain', replacement],
				['text/plain', appended],
			]);
		});

		test('preserves files appended with mixed-case MIME types', () => {
			const transfer = new VSDataTransfer();
			const first = createFileDataTransferItem('first.png', undefined, async () => new Uint8Array([1]));
			const second = createFileDataTransferItem('second.png', undefined, async () => new Uint8Array([2]));
			transfer.append('image/png', first);
			transfer.append('Image/PNG', second);

			assert.deepStrictEqual(Array.from(transfer, ([mime, item]) => [mime, item.asFile()]), [
				['image/png', first.asFile()],
				['image/png', second.asFile()],
			]);
		});
	});
});
