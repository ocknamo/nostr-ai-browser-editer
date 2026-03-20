import { describe, it, expect } from 'vitest';
import { isTimeoutError } from './stackblitz-utils';

describe('isTimeoutError', () => {
  it('returns true for the exact StackBlitz VM timeout string', () => {
    expect(
      isTimeoutError('Timeout: Unable to establish a connection with the StackBlitz VM')
    ).toBe(true);
  });

  it('returns true for an Error instance with timeout message', () => {
    expect(
      isTimeoutError(new Error('Timeout: Unable to establish a connection with the StackBlitz VM'))
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
