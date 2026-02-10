import { assert, describe, it } from 'poku';
import { format } from '../src/index.ts';

describe('Safe SET with object parameter', () => {
  const sql = 'UPDATE users SET ?';
  const values = [{ name: 'foo', email: 'bar@test.com' }];
  const expected = "UPDATE users SET `name` = 'foo', `email` = 'bar@test.com'";

  it('should expand object to key-value pairs when stringifyObjects is undefined', () => {
    assert.strictEqual(format(sql, values, undefined), expected);
  });

  it('should expand object to key-value pairs when stringifyObjects is null', () => {
    // @ts-expect-error: testing null as a falsy runtime value
    assert.strictEqual(format(sql, values, null), expected);
  });

  it('should expand object to key-value pairs when stringifyObjects is false', () => {
    assert.strictEqual(format(sql, values, false), expected);
  });

  it('should expand object to key-value pairs when stringifyObjects is 0', () => {
    // @ts-expect-error: testing 0 as a falsy runtime value
    assert.strictEqual(format(sql, values, 0), expected);
  });

  it('should expand object to key-value pairs when stringifyObjects is empty string', () => {
    // @ts-expect-error: testing empty string as a falsy runtime value
    assert.strictEqual(format(sql, values, ''), expected);
  });

  it('should expand object to key-value pairs when stringifyObjects is omitted', () => {
    assert.strictEqual(format(sql, values), expected);
  });
});

describe("Can't bypass via object password injection", () => {
  const sql = 'SELECT * FROM `users` WHERE `username` = ? AND `password` = ?';
  const values: [string, { password: boolean }] = ['admin', { password: true }];
  const expected =
    "SELECT * FROM `users` WHERE `username` = 'admin' AND `password` = '[object Object]'";

  it('should not generate a SQL fragment when stringifyObjects is undefined', () => {
    assert.strictEqual(format(sql, values, undefined), expected);
  });

  it('should not generate a SQL fragment when stringifyObjects is null', () => {
    // @ts-expect-error: testing null as a falsy runtime value
    assert.strictEqual(format(sql, values, null), expected);
  });

  it('should not generate a SQL fragment when stringifyObjects is false', () => {
    assert.strictEqual(format(sql, values, false), expected);
  });

  it('should not generate a SQL fragment when stringifyObjects is 0', () => {
    // @ts-expect-error: testing 0 as a falsy runtime value
    assert.strictEqual(format(sql, values, 0), expected);
  });

  it('should not generate a SQL fragment when stringifyObjects is empty string', () => {
    // @ts-expect-error: testing empty string as a falsy runtime value
    assert.strictEqual(format(sql, values, ''), expected);
  });

  it('should not generate a SQL fragment when stringifyObjects is omitted', () => {
    assert.strictEqual(format(sql, values), expected);
  });
});
