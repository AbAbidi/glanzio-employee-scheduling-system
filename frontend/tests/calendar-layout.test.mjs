import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupCalendarEvents } from '../app/dashboard/assignments/calendar-layout.ts';
const event = (id, start, end) => ({ id, startAt: `2026-10-26T${start}:00Z`, endAt: `2026-10-26T${end}:00Z` });

test('same-time assignments share a side-by-side group', () => {
  const groups = groupCalendarEvents([event('b', '09:00', '11:00'), event('a', '09:00', '10:00')]);
  assert.deepEqual(groups.map(g => g.map(e => e.id)), [['a', 'b']]);
});
test('adjacent intervals are separate and original input is not mutated', () => {
  const input = [event('b', '10:00', '11:00'), event('a', '09:00', '10:00')];
  assert.equal(groupCalendarEvents(input).length, 2);
  assert.equal(input[0].id, 'b');
});
test('nested and connected overlaps stay together, with every event accessible', () => {
  const input = [event('a', '08:00', '12:00'), event('b', '09:00', '10:00'), event('c', '11:00', '13:00'), event('d', '12:30', '14:00'), event('e', '15:00', '16:00')];
  assert.deepEqual(groupCalendarEvents(input).map(g => g.length), [4, 1]);
  assert.deepEqual(groupCalendarEvents([]), []);
});
