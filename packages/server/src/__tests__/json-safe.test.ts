import { toJsonSafe } from '../server';

describe('toJsonSafe', () => {
  test('converts BigInt to number within the safe-integer range', () => {
    expect(toJsonSafe([{ order_id: 1001n, units: 12n }])).toEqual([
      { order_id: 1001, units: 12 },
    ]);
  });

  test('falls back to string beyond the safe-integer range', () => {
    const huge = 9007199254740993n; // Number.MAX_SAFE_INTEGER + 2
    expect(toJsonSafe([{ id: huge }])).toEqual([{ id: '9007199254740993' }]);
  });

  test('leaves other value types untouched', () => {
    const rows = [{ region: 'APAC', revenue: 1234.56, ok: true, missing: null }];
    expect(toJsonSafe(rows)).toEqual(rows);
  });

  test('result survives JSON.stringify', () => {
    // The original failure: res.json() threw "Do not know how to serialize a BigInt"
    // on any result set containing an integer column.
    expect(() => JSON.stringify(toJsonSafe([{ order_id: 1n }]))).not.toThrow();
  });
});
