import { describe, test, expect } from 'vitest';
import { formatCompact, formatFull } from './formatters';

describe('formatCompact', () => {
  test('formats millions with currency prefix', () => {
    expect(formatCompact(1_200_000, 'currency')).toBe('$1.2M');
  });

  test('formats thousands with currency prefix', () => {
    expect(formatCompact(847_500, 'currency')).toBe('$847.5K');
  });

  test('formats small currency values with two decimals', () => {
    expect(formatCompact(342.5, 'currency')).toBe('$342.50');
  });

  test('formats plain number without prefix', () => {
    expect(formatCompact(42)).toBe('42');
  });

  test('returns -- for null', () => {
    expect(formatCompact(null)).toBe('--');
  });

  test('returns -- for undefined', () => {
    expect(formatCompact(undefined)).toBe('--');
  });

  test('formats percent with one decimal', () => {
    expect(formatCompact(84.3, 'percent')).toBe('84.3%');
  });

  test('formats negative millions', () => {
    expect(formatCompact(-2_500_000, 'currency')).toBe('$-2.5M');
  });

  test('formats negative thousands', () => {
    expect(formatCompact(-500, 'currency')).toBe('$-500.00');
  });

  test('formats large plain number in thousands', () => {
    expect(formatCompact(5_000)).toBe('5.0K');
  });
});

describe('formatFull', () => {
  test('formats currency with commas and two decimals', () => {
    expect(formatFull(1_234_567.89, 'currency')).toBe('$1,234,567.89');
  });

  test('formats number with commas', () => {
    expect(formatFull(1_234_567, 'number')).toBe('1,234,567');
  });

  test('returns -- for null', () => {
    expect(formatFull(null)).toBe('--');
  });

  test('returns -- for undefined', () => {
    expect(formatFull(undefined)).toBe('--');
  });

  test('passes through text as string', () => {
    expect(formatFull('hello world')).toBe('hello world');
  });

  test('passes through numbers as string when no format', () => {
    expect(formatFull(123)).toBe('123');
  });

  test('formats percent with one decimal', () => {
    expect(formatFull(84.3, 'percent')).toBe('84.3%');
  });
});
