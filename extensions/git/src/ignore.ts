/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';

/**
 * A suggestion to ignore the common containing directory of multiple files,
 * rather than adding potentially thousands of individual file rules.
 */
export interface IIgnoreDirectoryCandidate {
	/** Absolute filesystem path of the directory to ignore. */
	readonly absolutePath: string;
	/** Repository-relative directory, using forward slashes. */
	readonly relativePath: string;
	/** Anchored and escaped Git ignore pattern. */
	readonly pattern: string;
	/** Number of distinct selected files in the directory. */
	readonly fileCount: number;
}

/**
 * An ignored path must belong to the repository. A path containing a line break
 * cannot be represented as one line in a .gitignore file, so reject it rather
 * than accidentally creating additional ignore rules.
 */
function repositoryRelativePath(repositoryRoot: string, target: string, paths: typeof path): string | undefined {
	if (!paths.isAbsolute(target) || /[\r\n\0]/.test(target)) {
		return undefined;
	}

	const relative = paths.relative(repositoryRoot, target);
	if (!relative || relative === '.' || relative === '..' ||
		relative.startsWith('..' + paths.sep) || paths.isAbsolute(relative)) {
		return undefined;
	}

	return relative;
}

/**
 * Escape glob metacharacters in Git's .gitignore format. An anchored pattern
 * prevents an ignore rule for `foo/bar` from matching another folder elsewhere.
 *
 * Git treats trailing unescaped spaces specially. Escape only those spaces:
 * internal spaces are legal in patterns and should remain readable.
 */
function escapeGitIgnorePath(relative: string, paths: typeof path): string {
	const segments = relative.split(paths.sep);
	return segments.map(segment => {
		const escaped = segment.replace(/[\\*?\[\]]/g, '\\$&');
		return escaped.replace(/ +$/, spaces => '\\ '.repeat(spaces.length));
	}).join('/');
}

/**
 * Produce a literal, repository-anchored .gitignore rule for an absolute file
 * or directory path. Undefined means the input cannot be safely represented.
 *
 * Unlike a pattern derived from the filename alone, the anchored rule only
 * matches the selected entry within this repository.
 */
export function toGitIgnorePattern(
	repositoryRoot: string,
	absolutePath: string,
	isDirectory = false,
	paths: typeof path = path
): string | undefined {
	const relative = repositoryRelativePath(repositoryRoot, absolutePath, paths);
	if (!relative) {
		return undefined;
	}

	const escaped = escapeGitIgnorePath(relative, paths);
	return '/' + escaped + (isDirectory ? '/' : '');
}

/**
 * Returns the closest common directory containing the selected files. This is
 * only a *suggestion*: the caller must ask the user before ignoring a directory,
 * since that may also hide unselected files.
 *
 * The repository root itself is never suggested. This protects selections that
 * happen to span otherwise unrelated folders.
 */
export function getIgnoreDirectoryCandidate(
	repositoryRoot: string,
	absolutePaths: readonly string[],
	paths: typeof path = path
): IIgnoreDirectoryCandidate | undefined {
	const relativePaths = new Set<string>();

	for (const target of absolutePaths) {
		const relative = repositoryRelativePath(repositoryRoot, target, paths);
		if (!relative) {
			return undefined;
		}
		relativePaths.add(relative);
	}

	if (relativePaths.size < 2) {
		return undefined;
	}

	const selectedPaths = [...relativePaths];
	let commonDirectory = paths.dirname(selectedPaths[0]);

	while (commonDirectory !== '.' && commonDirectory !== paths.sep) {
		if (selectedPaths.every(target =>
			target.startsWith(commonDirectory + paths.sep))) {
			const absolutePath = paths.join(repositoryRoot, commonDirectory);
			const pattern = toGitIgnorePattern(repositoryRoot, absolutePath, true, paths);
			if (!pattern) {
				return undefined;
			}

			return {
				absolutePath,
				relativePath: commonDirectory.split(paths.sep).join('/'),
				pattern,
				fileCount: selectedPaths.length
			};
		}

		const parent = paths.dirname(commonDirectory);
		if (parent === commonDirectory) {
			break;
		}
		commonDirectory = parent;
	}

	return undefined;
}

/**
 * Return unique, safe Git ignore patterns, preserving the caller's selection
 * order. Invalid/out-of-repository paths are excluded rather than accidentally
 * creating rules for a different repository.
 */
export function getGitIgnorePatterns(
	repositoryRoot: string,
	absolutePaths: readonly string[],
	isDirectory = false,
	paths: typeof path = path
): string[] {
	const patterns = new Set<string>();
	for (const target of absolutePaths) {
		const pattern = toGitIgnorePattern(repositoryRoot, target, isDirectory, paths);
		if (pattern) {
			patterns.add(pattern);
		}
	}
	return [...patterns];
}

/**
 * Build the exact text to append to a .gitignore document. Exact duplicate
 * rules, including duplicates inside the request, are not appended again.
 *
 * This deliberately avoids interpreting/reordering existing rules: Git ignore
 * precedence and negated patterns are order-dependent. The caller can add the
 * returned text at the end of the document without rewriting existing content.
 *
 * The existing newline style is preserved, including CRLF and LF.
 */
export function getGitIgnoreAppendText(existing: string, requested: readonly string[]): string {
	const existingRules = new Set(existing.split(/\r?\n/));
	const added = new Set<string>();

	for (const pattern of requested) {
		if (!pattern || /[\r\n\0]/.test(pattern) || existingRules.has(pattern)) {
			continue;
		}
		added.add(pattern);
	}

	if (added.size === 0) {
		return '';
	}

	const newline = existing.includes('\r\n') ? '\r\n' : '\n';
	const prefix = existing && !existing.endsWith('\n') ? newline : '';
	return prefix + [...added].join(newline) + newline;
}
