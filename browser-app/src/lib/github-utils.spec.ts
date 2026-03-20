import { describe, expect, it } from 'vitest';
import { parseGitHubRepo } from './github-utils';

describe('parseGitHubRepo', () => {
  it('returns empty string for empty input', () => {
    expect(parseGitHubRepo('')).toBe('');
  });

  it('returns owner/repo as-is for already normalized format', () => {
    expect(parseGitHubRepo('facebook/react')).toBe('facebook/react');
  });

  it('trims whitespace from owner/repo format', () => {
    expect(parseGitHubRepo('  facebook/react  ')).toBe('facebook/react');
  });

  it('extracts owner/repo from a full GitHub URL', () => {
    expect(parseGitHubRepo('https://github.com/facebook/react')).toBe(
      'facebook/react',
    );
  });

  it('extracts only owner/repo when URL contains extra path segments', () => {
    expect(
      parseGitHubRepo('https://github.com/facebook/react/tree/main/packages'),
    ).toBe('facebook/react');
  });

  it('extracts owner/repo from a GitHub URL with trailing slash', () => {
    expect(parseGitHubRepo('https://github.com/facebook/react/')).toBe(
      'facebook/react',
    );
  });

  it('returns trimmed input for a non-GitHub URL', () => {
    expect(parseGitHubRepo('https://gitlab.com/owner/repo')).toBe(
      'https://gitlab.com/owner/repo',
    );
  });

  it('returns trimmed input for a plain string that is not owner/repo format', () => {
    expect(parseGitHubRepo('  some-invalid-input  ')).toBe(
      'some-invalid-input',
    );
  });
});
