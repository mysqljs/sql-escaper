import type { SqlValue } from '../src/index.ts';
import { assert, describe, it } from 'poku';
import { format as _format } from '../src/index.ts';

const format = (sql: string, values?: SqlValue) => _format(sql, values, false);

describe('SET continuation: object expands at a later assignment position', () => {
  it('should expand an object after a function call in the SET list (issue #4126)', () => {
    const query = format(
      'UPDATE t SET modified = UTC_TIMESTAMP(), ? WHERE id = ?',
      [{ foo: 'bar' }, 123]
    );

    assert.strictEqual(
      query,
      "UPDATE t SET modified = UTC_TIMESTAMP(), `foo` = 'bar' WHERE id = 123"
    );
  });

  it('should expand an object after multiple prior assignments', () => {
    const query = format('INSERT INTO t SET a = 1, b = 2, ?', [{ c: 3 }]);

    assert.strictEqual(query, 'INSERT INTO t SET a = 1, b = 2, `c` = 3');
  });

  it('should expand both objects in SET ?, ?', () => {
    const query = format('UPDATE t SET ?, ?', [{ a: 1 }, { b: 2 }]);

    assert.strictEqual(query, 'UPDATE t SET `a` = 1, `b` = 2');
  });

  it('should expand a continuation in ON DUPLICATE KEY UPDATE', () => {
    const query = format(
      'INSERT INTO t SET a = 1 ON DUPLICATE KEY UPDATE x = 1, ?',
      [{ y: 2 }]
    );

    assert.strictEqual(
      query,
      'INSERT INTO t SET a = 1 ON DUPLICATE KEY UPDATE x = 1, `y` = 2'
    );
  });

  it('should ignore a WHERE inside a subquery assignment and still expand', () => {
    const query = format('UPDATE t SET a = (SELECT x FROM y WHERE z = 1), ?', [
      { b: 2 },
    ]);

    assert.strictEqual(
      query,
      'UPDATE t SET a = (SELECT x FROM y WHERE z = 1), `b` = 2'
    );
  });

  it('should ignore commas inside a function call and still expand', () => {
    const query = format('UPDATE t SET a = IF(x > 1, 2, 3), ?', [{ b: 2 }]);

    assert.strictEqual(query, 'UPDATE t SET a = IF(x > 1, 2, 3), `b` = 2');
  });

  it('should ignore a comma inside a backtick identifier', () => {
    const query = format('UPDATE t SET `we,ird` = 1, ?', [{ b: 2 }]);

    assert.strictEqual(query, 'UPDATE t SET `we,ird` = 1, `b` = 2');
  });

  it('should expand a Map in a continuation position', () => {
    const query = format('UPDATE t SET a = 1, ?', [new Map([['b', 2]])]);

    assert.strictEqual(query, 'UPDATE t SET a = 1, `b` = 2');
  });
});

describe('SET continuation: value positions must NOT expand', () => {
  it('should stringify an object on the right-hand side of an assignment', () => {
    const query = format('UPDATE t SET a = ?', [{ x: 1 }]);

    assert.strictEqual(query, "UPDATE t SET a = '[object Object]'");
  });

  it('should stringify an object as a later right-hand side value', () => {
    const query = format('UPDATE t SET a = 1, b = ?', [{ x: 1 }]);

    assert.strictEqual(query, "UPDATE t SET a = 1, b = '[object Object]'");
  });

  it('should stringify an object inside a function call in the SET list', () => {
    const query = format('UPDATE t SET a = COALESCE(x, ?)', [{ x: 1 }]);

    assert.strictEqual(
      query,
      "UPDATE t SET a = COALESCE(x, '[object Object]')"
    );
  });

  it('should stringify an object after the SET clause ends at WHERE', () => {
    const query = format('UPDATE t SET a = 1 WHERE b = ?', [{ x: 1 }]);

    assert.strictEqual(query, "UPDATE t SET a = 1 WHERE b = '[object Object]'");
  });

  it('should stringify an object in an ORDER BY comma list after SET', () => {
    const query = format('UPDATE t SET a = 1 ORDER BY b, ?', [{ x: 1 }]);

    assert.strictEqual(
      query,
      "UPDATE t SET a = 1 ORDER BY b, '[object Object]'"
    );
  });

  it('should not let a SET in a prior statement reach a later value position', () => {
    const query = format('UPDATE t SET a = 1; SELECT b, ?', [{ x: 1 }]);

    assert.strictEqual(
      query,
      "UPDATE t SET a = 1; SELECT b, '[object Object]'"
    );
  });
});
