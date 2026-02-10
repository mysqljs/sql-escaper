import { assert, describe, it } from 'poku';
import { escape } from '../src/index.ts';

describe("Can't bypass via object injection using escape directly", () => {
  const value = { password: 1 };
  const expected = "'[object Object]'";

  it('should stringify object when stringifyObjects is true', () => {
    assert.strictEqual(escape(value, true), expected);
  });

  it('should stringify object when stringifyObjects is false', () => {
    assert.strictEqual(escape(value, false), expected);
  });

  it('should stringify object when stringifyObjects is 0', () => {
    // @ts-expect-error: testing 0 as a falsy runtime value
    assert.strictEqual(escape(value, 0), expected);
  });

  it('should stringify object when stringifyObjects is empty string', () => {
    // @ts-expect-error: testing empty string as a falsy runtime value
    assert.strictEqual(escape(value, ''), expected);
  });
});

describe('Object expansion when stringifyObjects is nullish', () => {
  const value = { password: 1 };
  const expanded = '`password` = 1';

  it('should expand object when stringifyObjects is undefined', () => {
    assert.strictEqual(escape(value, undefined), expanded);
  });

  it('should expand object when stringifyObjects is null', () => {
    // @ts-expect-error: testing null as a falsy runtime value
    assert.strictEqual(escape(value, null), expanded);
  });

  it('should expand object when stringifyObjects is omitted', () => {
    assert.strictEqual(escape(value), expanded);
  });
});

describe('Safe object to key-value expansion for SET clauses', () => {
  it('should expand single key-value pair', () => {
    assert.strictEqual(escape({ name: 'foo' }), "`name` = 'foo'");
  });

  it('should expand multiple key-value pairs', () => {
    assert.strictEqual(
      escape({ name: 'foo', email: 'bar@test.com' }),
      "`name` = 'foo', `email` = 'bar@test.com'"
    );
  });

  it('should expand mixed value types', () => {
    assert.strictEqual(
      escape({ name: 'foo', active: true, age: 30 }),
      "`name` = 'foo', `active` = true, `age` = 30"
    );
  });

  it('should skip function values', () => {
    assert.strictEqual(escape({ name: 'foo', fn: () => {} }), "`name` = 'foo'");
  });

  it('should return empty string for empty object', () => {
    assert.strictEqual(escape({}), '');
  });
});
