import { describe, expect, it } from 'vitest';
import { buildStackblitzPath, isTimeoutError } from './stackblitz-utils';

describe('isTimeoutError', () => {
  it('returns true for the exact StackBlitz VM timeout string', () => {
    expect(
      isTimeoutError(
        'Timeout: Unable to establish a connection with the StackBlitz VM',
      ),
    ).toBe(true);
  });

  it('returns true for an Error instance with timeout message', () => {
    expect(
      isTimeoutError(
        new Error(
          'Timeout: Unable to establish a connection with the StackBlitz VM',
        ),
      ),
    ).toBe(true);
  });

  it('returns true for a string containing only "Timeout"', () => {
    expect(isTimeoutError('Timeout')).toBe(true);
  });

  it('returns true for a string containing "Unable to establish a connection"', () => {
    expect(isTimeoutError('Unable to establish a connection')).toBe(true);
  });

  it('returns false for an unrelated error string', () => {
    expect(isTimeoutError('Some other error')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isTimeoutError(null)).toBe(false);
  });

  it('returns false for an empty object', () => {
    expect(isTimeoutError({})).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isTimeoutError('')).toBe(false);
  });
});

describe('buildStackblitzPath', () => {
  it('returns only the repo when branch and projectRoot are empty', () => {
    expect(buildStackblitzPath('facebook/react', '', '')).toBe(
      'facebook/react',
    );
  });

  it('appends branch segment when branch is provided', () => {
    expect(buildStackblitzPath('facebook/react', 'main', '')).toBe(
      'facebook/react/tree/main',
    );
  });

  it('does not encode slashes in branch names', () => {
    expect(buildStackblitzPath('owner/repo', 'claude/fix-foo', '')).toBe(
      'owner/repo/tree/claude/fix-foo',
    );
  });

  it('appends projectRoot after branch segment', () => {
    expect(buildStackblitzPath('owner/repo', 'main', 'packages/app')).toBe(
      'owner/repo/tree/main/packages/app',
    );
  });

  it('appends projectRoot even when branch is empty', () => {
    expect(buildStackblitzPath('owner/repo', '', 'subdir')).toBe(
      'owner/repo/subdir',
    );
  });

  it('ignores projectRoot that is only whitespace', () => {
    expect(buildStackblitzPath('owner/repo', 'main', '   ')).toBe(
      'owner/repo/tree/main',
    );
  });

  it('trims whitespace from projectRoot', () => {
    expect(buildStackblitzPath('owner/repo', 'main', '  app  ')).toBe(
      'owner/repo/tree/main/app',
    );
  });
});
