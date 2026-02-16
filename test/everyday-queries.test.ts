import { Buffer } from 'node:buffer';
import { assert, describe, test } from 'poku';
import { escape, escapeId, format, raw } from '../src/index.ts';

describe('Critical: UPDATE with named columns', () => {
  test('SET foo = ?, bar = ? WHERE id = ?', () => {
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

  test('UPDATE with mixed types in SET clause', () => {
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

describe('Critical: UPDATE ?? SET ? WHERE (dynamic table + object + raw)', () => {
  test('main README example from sqlstring', () => {
    const sql = format('UPDATE ?? SET ? WHERE id = ?', [
      'users',
      { name: 'John', age: 30 },
      42,
    ]);
    assert.equal(
      sql,
      "UPDATE `users` SET `name` = 'John', `age` = 30 WHERE id = 42"
    );
  });

  test('dynamic table with object containing raw() value', () => {
    const sql = format('UPDATE ?? SET ? WHERE id = ?', [
      'posts',
      { title: 'Hello', updated_at: raw('NOW()') },
      1,
    ]);
    assert.equal(
      sql,
      "UPDATE `posts` SET `title` = 'Hello', `updated_at` = NOW() WHERE id = 1"
    );
  });
});

describe('Critical: Bulk INSERT with nested arrays', () => {
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

describe('Critical: SELECT IN (?) with array', () => {
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

describe('Critical: ON DUPLICATE KEY UPDATE with raw() values', () => {
  test('INSERT ... ON DUPLICATE KEY UPDATE with raw()', () => {
    const sql = format(
      'INSERT INTO counters (id, count) VALUES (?, ?) ON DUPLICATE KEY UPDATE ?',
      [1, 0, { count: raw('count + 1'), updated_at: raw('NOW()') }]
    );
    assert.equal(
      sql,
      'INSERT INTO counters (id, count) VALUES (1, 0) ON DUPLICATE KEY UPDATE `count` = count + 1, `updated_at` = NOW()'
    );
  });

  test('ON DUPLICATE KEY UPDATE with mixed raw and regular values', () => {
    const sql = format(
      'INSERT INTO t (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE ?',
      [1, 'test', { name: 'updated', modified: raw('CURRENT_TIMESTAMP') }]
    );
    assert.equal(
      sql,
      "INSERT INTO t (id, name) VALUES (1, 'test') ON DUPLICATE KEY UPDATE `name` = 'updated', `modified` = CURRENT_TIMESTAMP"
    );
  });

  test('INSERT ... SET ? ON DUPLICATE KEY UPDATE ? with two objects', () => {
    const dataInsert = {
      aula: 'Math101',
      fecha: '2024-01-15',
      texto: 'Lesson content',
      tipo: 'lecture',
      imagen: 'image.png',
      file: 'notes.pdf',
    };
    const { aula, fecha, tipo, ...dataUpdate } = dataInsert;
    const sql = format(
      'INSERT INTO column SET ? ON DUPLICATE KEY UPDATE ?',
      [dataInsert, dataUpdate],
      false
    );
    assert.equal(
      sql,
      "INSERT INTO column SET `aula` = 'Math101', `fecha` = '2024-01-15', `texto` = 'Lesson content', `tipo` = 'lecture', `imagen` = 'image.png', `file` = 'notes.pdf' ON DUPLICATE KEY UPDATE `texto` = 'Lesson content', `imagen` = 'image.png', `file` = 'notes.pdf'"
    );
  });
});

describe('Critical: stringifyObjects=undefined (mysqljs/mysql legacy mode)', () => {
  test('format called without 3rd argument treats objects as values', () => {
    const sql = format('UPDATE t SET ?', [{ a: 1, b: 'x' }]);
    assert.equal(sql, "UPDATE t SET `a` = 1, `b` = 'x'");
  });

  test('format with undefined stringifyObjects', () => {
    const sql = format('UPDATE t SET ?', [{ foo: 'bar' }], undefined);
    assert.equal(sql, "UPDATE t SET `foo` = 'bar'");
  });

  test('escape with undefined stringifyObjects', () => {
    const result = escape({ a: 1 }, undefined);
    assert.equal(result, '`a` = 1');
  });
});

describe('Important: ?? with array of columns', () => {
  test('SELECT ?? FROM with column array', () => {
    const sql = format('SELECT ?? FROM users', [['id', 'name', 'email']]);
    assert.equal(sql, 'SELECT `id`, `name`, `email` FROM users');
  });

  test('SELECT ?? with qualified column names', () => {
    const sql = format('SELECT ?? FROM users u', [['u.id', 'u.name']]);
    assert.equal(sql, 'SELECT `u`.`id`, `u`.`name` FROM users u');
  });
});

describe('Important: INSERT with null via format', () => {
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

describe('Important: WHERE column IS ? with null', () => {
  test('WHERE deleted_at IS ? with null', () => {
    const sql = format('SELECT * FROM t WHERE deleted_at IS ?', [null]);
    assert.equal(sql, 'SELECT * FROM t WHERE deleted_at IS NULL');
  });

  test('WHERE value IS NOT ? with null', () => {
    const sql = format('SELECT * FROM t WHERE value IS NOT ?', [null]);
    assert.equal(sql, 'SELECT * FROM t WHERE value IS NOT NULL');
  });
});

describe('Important: INSERT with Buffer via format', () => {
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

describe('Important: Single non-array value as argument', () => {
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

describe('Important: Multiple ?? and ? in same query', () => {
  test('SELECT with dynamic table, columns, and values', () => {
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

describe('Important: Empty Buffer', () => {
  test('escape empty buffer', () => {
    const buffer = Buffer.alloc(0);
    assert.equal(escape(buffer), "X''");
  });

  test('format with empty buffer', () => {
    const sql = format('INSERT INTO t (data) VALUES (?)', [Buffer.alloc(0)]);
    assert.equal(sql, "INSERT INTO t (data) VALUES (X'')");
  });
});

describe('Important: format with explicit timezone as 4th argument', () => {
  test('format with UTC timezone', () => {
    const date = new Date(Date.UTC(2024, 5, 15, 12, 30, 45, 123));
    const sql = format(
      'INSERT INTO t (created) VALUES (?)',
      [date],
      false,
      'Z'
    );
    assert.equal(
      sql,
      "INSERT INTO t (created) VALUES ('2024-06-15 12:30:45.123')"
    );
  });

  test('format with +05:30 timezone', () => {
    const date = new Date(Date.UTC(2024, 5, 15, 12, 0, 0, 0));
    const sql = format(
      'INSERT INTO t (created) VALUES (?)',
      [date],
      false,
      '+05:30'
    );
    assert.equal(
      sql,
      "INSERT INTO t (created) VALUES ('2024-06-15 17:30:00.000')"
    );
  });

  test('format with -08:00 timezone', () => {
    const date = new Date(Date.UTC(2024, 5, 15, 12, 0, 0, 0));
    const sql = format(
      'INSERT INTO t (created) VALUES (?)',
      [date],
      false,
      '-08:00'
    );
    assert.equal(
      sql,
      "INSERT INTO t (created) VALUES ('2024-06-15 04:00:00.000')"
    );
  });
});

describe('Nice to have: Edge case values', () => {
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

describe('Nice to have: Unicode handling', () => {
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

describe('Nice to have: LIKE with special characters', () => {
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

describe('Nice to have: CALL procedure', () => {
  test('CALL with parameters', () => {
    const sql = format('CALL my_procedure(?, ?, ?)', [1, 'test', true]);
    assert.equal(sql, "CALL my_procedure(1, 'test', true)");
  });

  test('CALL with null parameter', () => {
    const sql = format('CALL process_data(?, ?)', [null, 'value']);
    assert.equal(sql, "CALL process_data(NULL, 'value')");
  });
});

describe('Nice to have: Empty array', () => {
  test('escape empty array', () => {
    assert.equal(escape([]), '');
  });

  test('IN clause with empty array produces empty list', () => {
    const sql = format('SELECT * FROM t WHERE id IN (?)', [[]]);
    assert.equal(sql, 'SELECT * FROM t WHERE id IN ()');
  });
});

describe('Nice to have: Object with null values', () => {
  test('SET with null value in object', () => {
    const sql = format('UPDATE t SET ?', [{ name: 'test', deleted_at: null }]);
    assert.equal(sql, "UPDATE t SET `name` = 'test', `deleted_at` = NULL");
  });

  test('INSERT ... ON DUPLICATE KEY UPDATE with null', () => {
    const sql = format(
      'INSERT INTO t (id) VALUES (?) ON DUPLICATE KEY UPDATE ?',
      [1, { value: null, name: 'x' }]
    );
    assert.equal(
      sql,
      "INSERT INTO t (id) VALUES (1) ON DUPLICATE KEY UPDATE `value` = NULL, `name` = 'x'"
    );
  });
});

describe('Nice to have: escapeId edge cases', () => {
  test('escapeId with empty string', () => {
    assert.equal(escapeId(''), '``');
  });

  test('escapeId with number zero', () => {
    assert.equal(escapeId(0), '`0`');
  });

  test('escapeId with reserved word', () => {
    assert.equal(escapeId('select'), '`select`');
    assert.equal(escapeId('table'), '`table`');
  });
});

describe('JSON path expressions with ?? placeholder', () => {
  test('should handle JSON arrow operator with path expression', () => {
    const query = format('SELECT * FROM ?? WHERE (?? = ?) LIMIT ?, ?', [
      'certification',
      "cert->>'$.name'",
      'myname',
      0,
      20,
    ]);

    assert.equal(
      query,
      "SELECT * FROM `certification` WHERE (`cert->>'$.name'` = 'myname') LIMIT 0, 20"
    );
  });

  test('escapeId should not break JSON path expressions', () => {
    const escaped = escapeId("cert->>'$.name'");

    assert.equal(escaped, "`cert->>'$.name'`");
  });

  test('escapeId with JSON double arrow operator', () => {
    const escaped = escapeId("data->'$.user.address.city'");

    assert.equal(escaped, "`data->'$.user.address.city'`");
  });
});

describe('Nice to have: Deeply nested arrays', () => {
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
  test('boolean in WHERE clause', () => {
    const sql = format('SELECT * FROM t WHERE active = ? AND deleted = ?', [
      true,
      false,
    ]);
    assert.equal(
      sql,
      'SELECT * FROM t WHERE active = true AND deleted = false'
    );
  });

  test('boolean in INSERT', () => {
    const sql = format('INSERT INTO t (active) VALUES (?)', [false]);
    assert.equal(sql, 'INSERT INTO t (active) VALUES (false)');
  });

  test('boolean in object for SET', () => {
    const sql = format('UPDATE t SET ?', [{ active: true, archived: false }]);
    assert.equal(sql, 'UPDATE t SET `active` = true, `archived` = false');
  });
});

describe('Critical: Backtick-quoted identifiers with comment-like sequences', () => {
  test('database/table names with double dashes', () => {
    const sql = format(
      'INSERT INTO `db--name`.`table`(`a`, `b`) VALUES (?, ?)',
      [1, 'hello']
    );
    assert.equal(
      sql,
      "INSERT INTO `db--name`.`table`(`a`, `b`) VALUES (1, 'hello')"
    );
  });

  test('column names with double dashes', () => {
    const sql = format(
      'INSERT INTO t (`col--1`, `col--2`) VALUES (?, ?)',
      [1, 2]
    );
    assert.equal(sql, 'INSERT INTO t (`col--1`, `col--2`) VALUES (1, 2)');
  });

  test('backticks with block comment markers', () => {
    const sql = format('INSERT INTO `table/*name*/` VALUES (?)', [1]);
    assert.equal(sql, 'INSERT INTO `table/*name*/` VALUES (1)');
  });

  test('escaped backticks inside identifiers', () => {
    const sql = format('INSERT INTO `table``name` VALUES (?)', [1]);
    assert.equal(sql, 'INSERT INTO `table``name` VALUES (1)');
  });

  test('multiple backtick identifiers with mixed comment markers', () => {
    const sql = format(
      'SELECT * FROM `db--1`.`table/*test*/` WHERE `col--id` = ?',
      [42]
    );
    assert.equal(
      sql,
      'SELECT * FROM `db--1`.`table/*test*/` WHERE `col--id` = 42'
    );
  });

  test('UPDATE with backtick identifiers containing dashes', () => {
    const sql = format('UPDATE `table--name` SET `col--1` = ? WHERE id = ?', [
      'value',
      1,
    ]);
    assert.equal(
      sql,
      "UPDATE `table--name` SET `col--1` = 'value' WHERE id = 1"
    );
  });

  test('SELECT with ?? and backtick-quoted values with dashes', () => {
    const sql = format('SELECT ?? FROM `users--table` WHERE id = ?', [
      ['col--1', 'col--2'],
      1,
    ]);
    assert.equal(
      sql,
      'SELECT `col--1`, `col--2` FROM `users--table` WHERE id = 1'
    );
  });
});
