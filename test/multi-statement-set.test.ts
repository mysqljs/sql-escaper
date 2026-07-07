import type { SqlValue } from '../src/index.ts';
import { assert, describe, it } from 'poku';
import { format as _format } from '../src/index.ts';

const format = (sql: string, values?: SqlValue) => _format(sql, values, false);

describe('Multi-statement: object expands after the nearest SET', () => {
  it('should expand SET ? in a later statement preceded by SET @var (issue #26)', () => {
    const query = format('SET @foo = 1; INSERT INTO bar SET ?', [
      { foo: 'bar' },
    ]);

    assert.strictEqual(
      query,
      "SET @foo = 1; INSERT INTO bar SET `foo` = 'bar'"
    );
  });

  it('should expand UPDATE SET ? when a prior statement sets a session variable', () => {
    const query = format('SET @x = 1; UPDATE b SET ?', [{ active: true }]);

    assert.strictEqual(query, 'SET @x = 1; UPDATE b SET `active` = true');
  });

  it('should keep a scalar in SET @var = ? and expand the following SET ?', () => {
    const query = format('SET @foo = ?; UPDATE t SET ?', [5, { name: 'x' }]);

    assert.strictEqual(query, "SET @foo = 5; UPDATE t SET `name` = 'x'");
  });

  it('should expand both SET ? clauses interleaved with a session SET', () => {
    const query = format('UPDATE a SET ?; SET @x = 1; UPDATE b SET ?', [
      { a: 1 },
      { b: 2 },
    ]);

    assert.strictEqual(
      query,
      'UPDATE a SET `a` = 1; SET @x = 1; UPDATE b SET `b` = 2'
    );
  });

  it('should expand two consecutive INSERT SET ? statements', () => {
    const query = format('INSERT INTO a SET ?; INSERT INTO b SET ?', [
      { x: 1 },
      { y: 2 },
    ]);

    assert.strictEqual(
      query,
      'INSERT INTO a SET `x` = 1; INSERT INTO b SET `y` = 2'
    );
  });

  it('should expand SET ? after multiple prior session SET statements', () => {
    const query = format('SET @a = 1; SET @b = 2; UPDATE t SET ?', [
      { done: true },
    ]);

    assert.strictEqual(
      query,
      'SET @a = 1; SET @b = 2; UPDATE t SET `done` = true'
    );
  });
});

describe('Multi-statement: object does NOT expand outside a SET clause', () => {
  it('should not expand an object in WHERE after a prior SET statement', () => {
    const query = format('SET @x = 1; SELECT * FROM t WHERE id = ?', [
      { id: 1 },
    ]);

    assert.strictEqual(
      query,
      "SET @x = 1; SELECT * FROM t WHERE id = '[object Object]'"
    );
  });

  it('should expand the SET ? but not the WHERE object in a later statement', () => {
    const query = format('UPDATE a SET ?; SELECT * FROM b WHERE id = ?', [
      { n: 1 },
      { id: 2 },
    ]);

    assert.strictEqual(
      query,
      "UPDATE a SET `n` = 1; SELECT * FROM b WHERE id = '[object Object]'"
    );
  });

  it('should not expand an object in SELECT ? after prior session SETs', () => {
    const query = format('SET @a = 1; SET @b = 2; SELECT ?', [{ x: 1 }]);

    assert.strictEqual(
      query,
      "SET @a = 1; SET @b = 2; SELECT '[object Object]'"
    );
  });

  it('should not expand an object in WHERE of the same statement that owns SET', () => {
    const query = format('UPDATE t SET a = 1 WHERE id = ?; SELECT 1', [
      { id: 5 },
    ]);

    assert.strictEqual(
      query,
      "UPDATE t SET a = 1 WHERE id = '[object Object]'; SELECT 1"
    );
  });
});

describe('Multi-statement: SET must be a real keyword', () => {
  it('should skip a commented-out SET and expand the real SET ?', () => {
    const query = format('/* SET fake */ UPDATE t SET ?', [{ a: 1 }]);

    assert.strictEqual(query, '/* SET fake */ UPDATE t SET `a` = 1');
  });

  it('should not treat SET inside a string literal of a prior statement as a clause', () => {
    const query = format("SELECT 'SET x = 1'; SELECT * FROM t WHERE id = ?", [
      { id: 1 },
    ]);

    assert.strictEqual(
      query,
      "SELECT 'SET x = 1'; SELECT * FROM t WHERE id = '[object Object]'"
    );
  });

  it('should pick the real SET clause even when a column named SET appears earlier', () => {
    const query = format('SELECT * FROM t WHERE SET = 1; UPDATE u SET ?', [
      { a: 1 },
    ]);

    assert.strictEqual(
      query,
      'SELECT * FROM t WHERE SET = 1; UPDATE u SET `a` = 1'
    );
  });

  it('should not match OFFSET as SET across statements', () => {
    const query = format('SELECT * FROM a LIMIT 10 OFFSET ?; UPDATE b SET ?', [
      5,
      { x: 1 },
    ]);

    assert.strictEqual(
      query,
      'SELECT * FROM a LIMIT 10 OFFSET 5; UPDATE b SET `x` = 1'
    );
  });
});

describe('Multi-statement: ON DUPLICATE KEY UPDATE', () => {
  it('should expand after ON DUPLICATE KEY UPDATE preceded by a session SET', () => {
    const query = format(
      'SET @x = 1; INSERT INTO t (a) VALUES (?) ON DUPLICATE KEY UPDATE ?',
      [1, { a: 2 }]
    );

    assert.strictEqual(
      query,
      'SET @x = 1; INSERT INTO t (a) VALUES (1) ON DUPLICATE KEY UPDATE `a` = 2'
    );
  });

  it('should expand a SET ? and a later ON DUPLICATE KEY UPDATE ?', () => {
    const query = format(
      'INSERT INTO a SET ?; INSERT INTO b (x) VALUES (?) ON DUPLICATE KEY UPDATE ?',
      [{ p: 1 }, 2, { q: 3 }]
    );

    assert.strictEqual(
      query,
      'INSERT INTO a SET `p` = 1; INSERT INTO b (x) VALUES (2) ON DUPLICATE KEY UPDATE `q` = 3'
    );
  });
});

describe('Multi-statement: Map and Set follow the same rules', () => {
  it('should expand a Map after the nearest SET like an object', () => {
    const query = format('SET @x = 1; UPDATE t SET ?', [
      new Map<string, number | string>([
        ['name', 'foo'],
        ['count', 7],
      ]),
    ]);

    assert.strictEqual(
      query,
      "SET @x = 1; UPDATE t SET `name` = 'foo', `count` = 7"
    );
  });

  it('should treat a Set in a later SET position like a list', () => {
    const query = format('SET @x = 1; UPDATE t SET ?', [new Set(['a', 'b'])]);

    assert.strictEqual(query, "SET @x = 1; UPDATE t SET 'a', 'b'");
  });

  it('should not expand a Map outside a SET clause after a prior SET', () => {
    const query = format('SET @x = 1; SELECT * FROM t WHERE d = ?', [
      new Map([['x', 1]]),
    ]);

    assert.strictEqual(
      query,
      "SET @x = 1; SELECT * FROM t WHERE d = '[object Map]'"
    );
  });
});

describe('Multi-statement: multiline queries', () => {
  it('should expand the SET ? clause across statements and lines', () => {
    const query = format(
      `SET @locale = ?;
       UPDATE users
       SET ?
       WHERE id = ?`,
      ['en', { name: 'foo', active: true }, 1]
    );

    assert.strictEqual(
      query,
      `SET @locale = 'en';
       UPDATE users
       SET \`name\` = 'foo', \`active\` = true
       WHERE id = 1`
    );
  });
});

describe('Multi-statement: values are inert and fully escaped', () => {
  it('should not let a value containing SET affect a following placeholder', () => {
    const query = format('SELECT ?, ?', ['garbage SET', { id: 1 }]);

    assert.strictEqual(query, "SELECT 'garbage SET', '[object Object]'");
  });

  it('should expand a real SET ? while keeping a prior SET-like value inert', () => {
    const query = format('SELECT ?; INSERT INTO t SET ?', ['SET', { a: 1 }]);

    assert.strictEqual(query, "SELECT 'SET'; INSERT INTO t SET `a` = 1");
  });

  it('should ignore a SET keyword hidden in a prior string literal value', () => {
    const query = format("SET @a = 'INSERT INTO x SET '; UPDATE t SET ?", [
      { n: 'v' },
    ]);

    assert.strictEqual(
      query,
      "SET @a = 'INSERT INTO x SET '; UPDATE t SET `n` = 'v'"
    );
  });

  it('should escape an injection payload passed as an expanded value', () => {
    const query = format('SET @x = 1; UPDATE t SET ?', [
      { name: "a'; DROP TABLE t; --" },
    ]);

    assert.strictEqual(
      query,
      "SET @x = 1; UPDATE t SET `name` = 'a\\'; DROP TABLE t; --'"
    );
  });

  it('should escape a malicious key so it cannot break out of the identifier', () => {
    const query = format('SET @a = 1; INSERT INTO t SET ?', [
      { 'evil` = 1; DROP TABLE users -- ': 2 },
    ]);

    assert.strictEqual(
      query,
      'SET @a = 1; INSERT INTO t SET `evil`` = 1; DROP TABLE users -- ` = 2'
    );
  });
});
