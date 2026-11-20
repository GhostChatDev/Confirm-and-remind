import { describe, expect, it } from 'vitest';
import { formatDate, markdown, tomorrowMorning } from './model';

describe('notes and tasks', () => {
  it('exports original note text and task state', () => {
    const result = markdown([{ id: 'n1', text: 'Call Mom\nAt 8', pinned: false, version: 1, created_at: '', updated_at: '' }], [{ id: 't1', title: 'Pay bill', status: 'done', created_at: '' }]);
    expect(result).toContain('Call Mom\nAt 8');
    expect(result).toContain('- [x] Pay bill');
  });
  it('formats missing or invalid dates safely', () => {
    expect(formatDate(null)).toBe('No date');
    expect(formatDate('invalid')).toBe('Invalid date');
  });
  it('snoozes until the next local morning', () => {
    const next = tomorrowMorning(new Date(2025, 1, 14, 18));
    expect(next.getDate()).toBe(15);
    expect(next.getHours()).toBe(8);
  });
});
