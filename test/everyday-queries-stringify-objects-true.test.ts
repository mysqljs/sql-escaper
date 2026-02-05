import type { SqlValue, Timezone } from '../src/index.ts';
import { Buffer } from 'node:buffer';
import { assert, describe, test } from 'poku';
import { escape as _escape, format as _format, raw } from '../src/index.ts';

const format = (
  sql: string,
  values?: SqlValue | SqlValue[],
  timezone?: Timezone
) => _format(sql, values, true, timezone);

const escape = (value: SqlValue, timezone?: Timezone) =>
  _escape(value, true, timezone);

describe('Critical: UPDATE with named columns (unchanged - no objects)', () => {
  test('SET foo = ?, bar = ? WHERE id = ? (scalars only)', () => {
    const sql = format('UPDATE users SET foo = ?, bar = ? WHERE id = ?', [
      'value1',
      'value2',
      42,
    ]);
    assert.equal(
      sql,
      "UPDATE users SET foo = 'value1', bar = 'value2' WHERE id = 42"
    );
  });

  test('UPDATE with mixed types in SET clause (scalars only)', () => {
    const sql = format(
      'UPDATE t SET active = ?, count = ?, name = ? WHERE id = ?',
      [true, 100, "O'Brien", 1]
    );
    assert.equal(
      sql,
      "UPDATE t SET active = true, count = 100, name = 'O\\'Brien' WHERE id = 1"
    );
  });
});

describe('Critical: UPDATE ?? SET ? WHERE — objects become [object Object]', () => {
  test('object in SET position becomes [object Object]', () => {
    const sql = format('UPDATE ?? SET ?', ['users', { name: 'John', age: 30 }]);
    assert.equal(sql, "UPDATE `users` SET '[object Object]'");
  });

  test('dynamic table with object containing raw() — object not expanded', () => {
    const sql = format('UPDATE ?? SET ?', [
      'posts',
      { title: 'Hello', updated_at: raw('NOW()') },
    ]);
    assert.equal(sql, "UPDATE `posts` SET '[object Object]'");
  });
});

describe('Critical: Bulk INSERT with nested arrays (unchanged - uses arrays)', () => {
  test('INSERT INTO t VALUES ? with nested array', () => {
    const sql = format('INSERT INTO t VALUES ?', [
      [
        [1, 'a'],
        [2, 'b'],
        [3, 'c'],
      ],
    ]);
    assert.equal(sql, "INSERT INTO t VALUES (1, 'a'), (2, 'b'), (3, 'c')");
  });

  test('bulk INSERT with mixed types', () => {
    const sql = format('INSERT INTO users (id, name, active) VALUES ?', [
      [
        [1, 'Alice', true],
        [2, 'Bob', false],
        [3, null, true],
      ],
    ]);
    assert.equal(
      sql,
      "INSERT INTO users (id, name, active) VALUES (1, 'Alice', true), (2, 'Bob', false), (3, NULL, true)"
    );
  });

  test('bulk INSERT with dates', () => {
    const date = new Date(2024, 0, 15, 10, 30, 0, 0);
    const sql = format('INSERT INTO events VALUES ?', [
      [
        [1, 'Event A', date],
        [2, 'Event B', date],
      ],
    ]);
    assert.equal(
      sql,
      "INSERT INTO events VALUES (1, 'Event A', '2024-01-15 10:30:00.000'), (2, 'Event B', '2024-01-15 10:30:00.000')"
    );
  });
});

describe('Critical: SELECT IN (?) with array (unchanged - uses arrays)', () => {
  test('WHERE id IN (?) with array of numbers', () => {
    const sql = format('SELECT * FROM users WHERE id IN (?)', [[1, 2, 3]]);
    assert.equal(sql, 'SELECT * FROM users WHERE id IN (1, 2, 3)');
  });

  test('WHERE id IN (?) with array of strings', () => {
    const sql = format('SELECT * FROM users WHERE status IN (?)', [
      ['active', 'pending', 'review'],
    ]);
    assert.equal(
      sql,
      "SELECT * FROM users WHERE status IN ('active', 'pending', 'review')"
    );
  });

  test('WHERE id IN (?) with mixed types', () => {
    const sql = format('SELECT * FROM items WHERE code IN (?)', [
      [1, 'abc', null],
    ]);
    assert.equal(sql, "SELECT * FROM items WHERE code IN (1, 'abc', NULL)");
  });

  test('multiple IN clauses', () => {
    const sql = format('SELECT * FROM t WHERE a IN (?) AND b IN (?)', [
      [1, 2],
      ['x', 'y'],
    ]);
    assert.equal(sql, "SELECT * FROM t WHERE a IN (1, 2) AND b IN ('x', 'y')");
  });
});

describe('Critical: ON DUPLICATE KEY UPDATE — objects become [object Object]', () => {
  test('object in ON DUPLICATE KEY UPDATE becomes [object Object]', () => {
    const sql = format(
      'INSERT INTO counters (id, count) VALUES (?, ?) ON DUPLICATE KEY UPDATE ?',
      [1, 0, { count: raw('count + 1'), updated_at: raw('NOW()') }]
    );
    assert.equal(
      sql,
      "INSERT INTO counters (id, count) VALUES (1, 0) ON DUPLICATE KEY UPDATE '[object Object]'"
    );
  });

  test('mixed raw and regular values in object — still becomes [object Object]', () => {
    const sql = format(
      'INSERT INTO t (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE ?',
      [1, 'test', { name: 'updated', modified: raw('CURRENT_TIMESTAMP') }]
    );
    assert.equal(
      sql,
      "INSERT INTO t (id, name) VALUES (1, 'test') ON DUPLICATE KEY UPDATE '[object Object]'"
    );
  });
});

describe('Critical: stringifyObjects=true explicitly set', () => {
  test('format with object produces [object Object]', () => {
    const sql = format('UPDATE t SET ?', [{ a: 1, b: 'x' }]);
    assert.equal(sql, "UPDATE t SET '[object Object]'");
  });

  test('escape with object produces [object Object]', () => {
    const result = escape({ a: 1 });
    assert.equal(result, "'[object Object]'");
  });

  test('object with custom toString is used', () => {
    const obj = {
      a: 1,
      toString: () => 'custom-string',
    };
    const result = escape(obj);
    assert.equal(result, "'custom-string'");
  });

  test('object with toSqlString bypasses stringification', () => {
    const obj = {
      toSqlString: () => 'RAW_SQL()',
    };
    const result = escape(obj);
    assert.equal(result, 'RAW_SQL()');
  });
});

describe('Important: ?? with array of columns (unchanged)', () => {
  test('SELECT ?? FROM with column array', () => {
    const sql = format('SELECT ?? FROM users', [['id', 'name', 'email']]);
    assert.equal(sql, 'SELECT `id`, `name`, `email` FROM users');
  });

  test('SELECT ?? with qualified column names', () => {
    const sql = format('SELECT ?? FROM users u', [['u.id', 'u.name']]);
    assert.equal(sql, 'SELECT `u`.`id`, `u`.`name` FROM users u');
  });
});

describe('Important: INSERT with null via format (unchanged)', () => {
  test('INSERT with explicit null values', () => {
    const sql = format('INSERT INTO t (a, b, c) VALUES (?, ?, ?)', [
      1,
      null,
      'x',
    ]);
    assert.equal(sql, "INSERT INTO t (a, b, c) VALUES (1, NULL, 'x')");
  });

  test('INSERT with undefined converts to NULL', () => {
    const sql = format('INSERT INTO t (a, b) VALUES (?, ?)', [1, undefined]);
    assert.equal(sql, 'INSERT INTO t (a, b) VALUES (1, NULL)');
  });
});

describe('Important: WHERE column IS ? with null (unchanged)', () => {
  test('WHERE deleted_at IS ? with null', () => {
    const sql = format('SELECT * FROM t WHERE deleted_at IS ?', [null]);
    assert.equal(sql, 'SELECT * FROM t WHERE deleted_at IS NULL');
  });

  test('WHERE value IS NOT ? with null', () => {
    const sql = format('SELECT * FROM t WHERE value IS NOT ?', [null]);
    assert.equal(sql, 'SELECT * FROM t WHERE value IS NOT NULL');
  });
});

describe('Important: INSERT with Buffer via format (unchanged)', () => {
  test('INSERT with binary data', () => {
    const buffer = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    const sql = format('INSERT INTO t (data) VALUES (?)', [buffer]);
    assert.equal(sql, "INSERT INTO t (data) VALUES (X'deadbeef')");
  });

  test('UPDATE with binary data', () => {
    const buffer = Buffer.from([0x01, 0x02, 0x03]);
    const sql = format('UPDATE t SET data = ? WHERE id = ?', [buffer, 1]);
    assert.equal(sql, "UPDATE t SET data = X'010203' WHERE id = 1");
  });
});

describe('Important: Single non-array value as argument (unchanged)', () => {
  test('format with single number', () => {
    const sql = format('SELECT * FROM t WHERE id = ?', 42);
    assert.equal(sql, 'SELECT * FROM t WHERE id = 42');
  });

  test('format with single string', () => {
    const sql = format('SELECT * FROM t WHERE name = ?', 'John');
    assert.equal(sql, "SELECT * FROM t WHERE name = 'John'");
  });

  test('format with single boolean', () => {
    const sql = format('SELECT * FROM t WHERE active = ?', true);
    assert.equal(sql, 'SELECT * FROM t WHERE active = true');
  });
});

describe('Important: Multiple ?? and ? in same query (unchanged for non-objects)', () => {
  test('SELECT with dynamic table, columns, and scalar values', () => {
    const sql = format('SELECT ?? FROM ?? WHERE ?? = ?', [
      ['id', 'name'],
      'users',
      'status',
      'active',
    ]);
    assert.equal(
      sql,
      "SELECT `id`, `name` FROM `users` WHERE `status` = 'active'"
    );
  });

  test('complex query with multiple placeholders', () => {
    const sql = format(
      'SELECT ??, ?? FROM ?? WHERE ?? = ? AND ?? IN (?) ORDER BY ??',
      [
        'id',
        'name',
        'users',
        'active',
        true,
        'role',
        ['admin', 'user'],
        'created_at',
      ]
    );
    assert.equal(
      sql,
      "SELECT `id`, `name` FROM `users` WHERE `active` = true AND `role` IN ('admin', 'user') ORDER BY `created_at`"
    );
  });
});

describe('Important: Empty Buffer (unchanged)', () => {
  test('escape empty buffer', () => {
    const buffer = Buffer.alloc(0);
    assert.equal(escape(buffer), "X''");
  });

  test('format with empty buffer', () => {
    const sql = format('INSERT INTO t (data) VALUES (?)', [Buffer.alloc(0)]);
    assert.equal(sql, "INSERT INTO t (data) VALUES (X'')");
  });
});

describe('Important: format with explicit timezone as 4th argument (unchanged)', () => {
  test('format with UTC timezone', () => {
    const date = new Date(Date.UTC(2024, 5, 15, 12, 30, 45, 123));
    const sql = format('INSERT INTO t (created) VALUES (?)', [date], 'Z');
    assert.equal(
      sql,
      "INSERT INTO t (created) VALUES ('2024-06-15 12:30:45.123')"
    );
  });

  test('format with +05:30 timezone', () => {
    const date = new Date(Date.UTC(2024, 5, 15, 12, 0, 0, 0));
    const sql = format('INSERT INTO t (created) VALUES (?)', [date], '+05:30');
    assert.equal(
      sql,
      "INSERT INTO t (created) VALUES ('2024-06-15 17:30:00.000')"
    );
  });

  test('format with -08:00 timezone', () => {
    const date = new Date(Date.UTC(2024, 5, 15, 12, 0, 0, 0));
    const sql = format('INSERT INTO t (created) VALUES (?)', [date], '-08:00');
    assert.equal(
      sql,
      "INSERT INTO t (created) VALUES ('2024-06-15 04:00:00.000')"
    );
  });
});

describe('Nice to have: Edge case values (unchanged)', () => {
  test('empty string', () => {
    assert.equal(escape(''), "''");
    const sql = format('SELECT * FROM t WHERE name = ?', ['']);
    assert.equal(sql, "SELECT * FROM t WHERE name = ''");
  });

  test('zero', () => {
    assert.equal(escape(0), '0');
    const sql = format('SELECT * FROM t WHERE count = ?', [0]);
    assert.equal(sql, 'SELECT * FROM t WHERE count = 0');
  });

  test('-Infinity', () => {
    assert.equal(escape(Number.NEGATIVE_INFINITY), '-Infinity');
  });

  test('MAX_SAFE_INTEGER', () => {
    assert.equal(escape(Number.MAX_SAFE_INTEGER), '9007199254740991');
    const sql = format('SELECT * FROM t WHERE id = ?', [
      Number.MAX_SAFE_INTEGER,
    ]);
    assert.equal(sql, 'SELECT * FROM t WHERE id = 9007199254740991');
  });

  test('scientific notation', () => {
    assert.equal(escape(1e10), '10000000000');
    assert.equal(escape(1.5e-5), '0.000015');
  });
});

describe('Nice to have: Unicode handling (unchanged)', () => {
  test('CJK characters', () => {
    const sql = format('INSERT INTO t (name) VALUES (?)', ['你好世界']);
    assert.equal(sql, "INSERT INTO t (name) VALUES ('你好世界')");
  });

  test('4-byte emoji', () => {
    const sql = format('INSERT INTO t (content) VALUES (?)', [
      'Hello 🎉 World 🚀',
    ]);
    assert.equal(sql, "INSERT INTO t (content) VALUES ('Hello 🎉 World 🚀')");
  });

  test('mixed unicode', () => {
    const sql = format('INSERT INTO t (text) VALUES (?)', [
      'Café ☕ naïve 日本語',
    ]);
    assert.equal(sql, "INSERT INTO t (text) VALUES ('Café ☕ naïve 日本語')");
  });
});

describe('Nice to have: LIKE with special characters (unchanged)', () => {
  test('LIKE with % wildcard in value', () => {
    const sql = format('SELECT * FROM t WHERE name LIKE ?', ['%test%']);
    assert.equal(sql, "SELECT * FROM t WHERE name LIKE '%test%'");
  });

  test('LIKE with _ wildcard in value', () => {
    const sql = format('SELECT * FROM t WHERE code LIKE ?', ['A_B_C']);
    assert.equal(sql, "SELECT * FROM t WHERE code LIKE 'A_B_C'");
  });

  test('LIKE with escaped special chars', () => {
    const sql = format('SELECT * FROM t WHERE path LIKE ?', [
      '%path\\%to\\%file%',
    ]);
    assert.equal(
      sql,
      "SELECT * FROM t WHERE path LIKE '%path\\\\%to\\\\%file%'"
    );
  });
});

describe('Nice to have: CALL procedure (unchanged)', () => {
  test('CALL with parameters', () => {
    const sql = format('CALL my_procedure(?, ?, ?)', [1, 'test', true]);
    assert.equal(sql, "CALL my_procedure(1, 'test', true)");
  });

  test('CALL with null parameter', () => {
    const sql = format('CALL process_data(?, ?)', [null, 'value']);
    assert.equal(sql, "CALL process_data(NULL, 'value')");
  });
});

describe('Nice to have: Empty array (unchanged)', () => {
  test('escape empty array', () => {
    assert.equal(escape([]), '');
  });

  test('IN clause with empty array produces empty list', () => {
    const sql = format('SELECT * FROM t WHERE id IN (?)', [[]]);
    assert.equal(sql, 'SELECT * FROM t WHERE id IN ()');
  });
});

describe('Nice to have: Object with null values — objects become [object Object]', () => {
  test('SET with object becomes [object Object]', () => {
    const sql = format('UPDATE t SET ?', [{ name: 'test', deleted_at: null }]);
    assert.equal(sql, "UPDATE t SET '[object Object]'");
  });

  test('ON DUPLICATE KEY UPDATE with object becomes [object Object]', () => {
    const sql = format(
      'INSERT INTO t (id) VALUES (?) ON DUPLICATE KEY UPDATE ?',
      [1, { value: null, name: 'x' }]
    );
    assert.equal(
      sql,
      "INSERT INTO t (id) VALUES (1) ON DUPLICATE KEY UPDATE '[object Object]'"
    );
  });
});

describe('Nice to have: escapeId edge cases (unchanged)', () => {
  test('escapeId with empty string', async () => {
    const { escapeId } = await import('../src/index.ts');
    assert.equal(escapeId(''), '``');
  });

  test('escapeId with number zero', async () => {
    const { escapeId } = await import('../src/index.ts');
    assert.equal(escapeId(0), '`0`');
  });

  test('escapeId with reserved word', async () => {
    const { escapeId } = await import('../src/index.ts');
    assert.equal(escapeId('select'), '`select`');
    assert.equal(escapeId('table'), '`table`');
  });
});

describe('Nice to have: Deeply nested arrays (unchanged)', () => {
  test('triple nested array for bulk insert', () => {
    const data = [
      [
        [1, 'a'],
        [2, 'b'],
      ],
    ];
    const sql = format('INSERT INTO t VALUES ?', data);
    assert.equal(sql, "INSERT INTO t VALUES (1, 'a'), (2, 'b')");
  });
});

describe('Nice to have: Boolean in various contexts', () => {
  test('boolean in WHERE clause (unchanged)', () => {
    const sql = format('SELECT * FROM t WHERE active = ? AND deleted = ?', [
      true,
      false,
    ]);
    assert.equal(
      sql,
      'SELECT * FROM t WHERE active = true AND deleted = false'
    );
  });

  test('boolean in INSERT (unchanged)', () => {
    const sql = format('INSERT INTO t (active) VALUES (?)', [false]);
    assert.equal(sql, 'INSERT INTO t (active) VALUES (false)');
  });

  test('boolean in object for SET — object becomes [object Object]', () => {
    const sql = format('UPDATE t SET ?', [{ active: true, archived: false }]);
    assert.equal(sql, "UPDATE t SET '[object Object]'");
  });
});

describe('toSqlString always bypasses stringification', () => {
  test('raw() works normally', () => {
    const sql = format('SELECT ?, ?', [raw('NOW()'), 'test']);
    assert.equal(sql, "SELECT NOW(), 'test'");
  });

  test('custom toSqlString object bypasses stringification', () => {
    const customObj = {
      toSqlString: () => 'CUSTOM_SQL()',
    };
    const sql = format('SELECT ?', [customObj]);
    assert.equal(sql, 'SELECT CUSTOM_SQL()');
  });

  test('toSqlString in array', () => {
    const sql = format('SELECT ?, ?, ?', [1, raw('NOW()'), 'x']);
    assert.equal(sql, "SELECT 1, NOW(), 'x'");
  });
});

describe('toString is used for objects when stringifyObjects: true', () => {
  test('object with custom toString', () => {
    const obj = { toString: () => 'my-custom-value' };
    const sql = format('SELECT ?', [obj]);
    assert.equal(sql, "SELECT 'my-custom-value'");
  });

  test('object with toString containing special chars is escaped', () => {
    const obj = { toString: () => "value'; DROP TABLE users; --" };
    const sql = format('SELECT ?', [obj]);
    assert.equal(sql, "SELECT 'value\\'; DROP TABLE users; --'");
  });
});
