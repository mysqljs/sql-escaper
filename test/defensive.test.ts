import type { SqlValue } from '../src/index.ts';
import { assert, describe, it } from 'poku';
import { format as _format, escape, escapeId, raw } from '../src/index.ts';

const format = (sql: string, values?: SqlValue) => _format(sql, values, false);

describe('Defensive: an object bound outside SET never becomes query structure', () => {
  it('should keep an object at a WHERE placeholder as one inert quoted value', () => {
    assert.strictEqual(
      format('SELECT * FROM users WHERE password = ?', [{ password: 1 }]),
      "SELECT * FROM users WHERE password = '[object Object]'"
    );
  });

  it('should keep an ownership filter as a value comparison, not a column-to-column one', () => {
    assert.strictEqual(
      format('SELECT * FROM posts WHERE user_id = ?', [
        { status: 'published' },
      ]),
      "SELECT * FROM posts WHERE user_id = '[object Object]'"
    );
  });

  it('should still expand an object where the author wrote SET', () => {
    assert.strictEqual(
      format('UPDATE users SET ? WHERE id = 1', [{ name: 'a', age: 5 }]),
      "UPDATE users SET `name` = 'a', `age` = 5 WHERE id = 1"
    );
  });
});

describe('Defensive: a stray SET keyword cannot open object expansion', () => {
  const contexts = [
    {
      name: 'single-quoted string',
      sql: "INSERT INTO audit (action, detail) VALUES ('SET', ?)",
      expected:
        "INSERT INTO audit (action, detail) VALUES ('SET', '[object Object]')",
    },
    {
      name: 'double-quoted string',
      sql: 'INSERT INTO audit (action, detail) VALUES ("SET", ?)',
      expected:
        'INSERT INTO audit (action, detail) VALUES ("SET", \'[object Object]\')',
    },
    {
      name: 'backtick identifier',
      sql: 'INSERT INTO audit (action, detail) VALUES (`SET`, ?)',
      expected:
        "INSERT INTO audit (action, detail) VALUES (`SET`, '[object Object]')",
    },
    {
      name: 'double-dash comment',
      sql: 'INSERT INTO audit (action, detail) VALUES (-- SET\n1, ?)',
      expected:
        "INSERT INTO audit (action, detail) VALUES (-- SET\n1, '[object Object]')",
    },
    {
      name: 'hash comment',
      sql: 'INSERT INTO audit (action, detail) VALUES (# SET\n1, ?)',
      expected:
        "INSERT INTO audit (action, detail) VALUES (# SET\n1, '[object Object]')",
    },
    {
      name: 'block comment',
      sql: 'INSERT INTO audit (action, detail) VALUES (/* SET */ 1, ?)',
      expected:
        "INSERT INTO audit (action, detail) VALUES (/* SET */ 1, '[object Object]')",
    },
  ];

  it('should stop the assignment list at WHERE so a later object stays inert', () => {
    assert.strictEqual(
      format('UPDATE users SET role = ? WHERE id = ?', ['user', { id: true }]),
      "UPDATE users SET role = 'user' WHERE id = '[object Object]'"
    );
  });

  for (const { name, sql, expected } of contexts)
    it(`should ignore a set written inside a ${name}`, () => {
      assert.strictEqual(format(sql, [{ password: 1 }]), expected);
    });
});

describe('Defensive: a value never lands inside a literal or comment', () => {
  const placements = [
    {
      name: 'an apostrophe in a hash comment',
      sql: "SELECT * FROM users\n# user's filter\nWHERE note = 'what?' AND id = ?",
      values: [' OR 1=1 -- '],
      expected:
        "SELECT * FROM users\n# user's filter\nWHERE note = 'what?' AND id = ' OR 1=1 -- '",
    },
    {
      name: 'an apostrophe in a double-dash comment',
      sql: "SELECT * FROM users\n-- user's filter\nWHERE note = 'what?' AND id = ?",
      values: [' OR 1=1 -- '],
      expected:
        "SELECT * FROM users\n-- user's filter\nWHERE note = 'what?' AND id = ' OR 1=1 -- '",
    },
    {
      name: 'an apostrophe in a double-quoted string',
      sql: "SELECT * FROM users WHERE name = \"O'Brien\" AND note = 'why?' AND id = ?",
      values: [' OR 1=1 -- '],
      expected:
        "SELECT * FROM users WHERE name = \"O'Brien\" AND note = 'why?' AND id = ' OR 1=1 -- '",
    },
    {
      name: 'a double placeholder in a single-quoted string',
      sql: "SELECT * FROM users WHERE note = 'really??' AND id = ?",
      values: ["x' OR 1=1 -- "],
      expected:
        "SELECT * FROM users WHERE note = 'really??' AND id = 'x\\' OR 1=1 -- '",
    },
    {
      name: 'a double placeholder in a double-quoted string',
      sql: 'SELECT * FROM users WHERE note = "really??" AND id = ?',
      values: ['x" OR 1=1 -- '],
      expected:
        'SELECT * FROM users WHERE note = "really??" AND id = \'x\\" OR 1=1 -- \'',
    },
    {
      name: 'a double placeholder in a hash comment',
      sql: 'SELECT * FROM users WHERE id = ? # why??\nAND role = ?',
      values: [1, "x\nOR role = 'admin' -- "],
      expected:
        "SELECT * FROM users WHERE id = 1 # why??\nAND role = 'x\\nOR role = \\'admin\\' -- '",
    },
  ];

  for (const { name, sql, values, expected } of placements)
    it(`should bind a hostile value at the real placeholder after ${name}`, () => {
      assert.strictEqual(format(sql, values), expected);
    });
});

describe('Defensive: an identifier cannot break out of its backticks', () => {
  it('should double a backtick inside an identifier', () => {
    assert.strictEqual(escapeId('a`b'), '`a``b`');
  });

  it('should quote a dotted name per segment', () => {
    assert.strictEqual(escapeId('a.b'), '`a`.`b`');
  });

  it('should double the backtick of an expanded object key inside SET', () => {
    assert.strictEqual(
      format('UPDATE t SET ?', [{ 'a`b': 1 }]),
      'UPDATE t SET `a``b` = 1'
    );
  });

  it('should quote a ?? identifier taken from input', () => {
    assert.strictEqual(
      format('SELECT ?? FROM t', ['a`b']),
      'SELECT `a``b` FROM t'
    );
  });
});

describe('Defensive: the raw passthrough stays narrow', () => {
  it('should emit a developer raw() fragment verbatim', () => {
    assert.strictEqual(escape(raw('NOW()')), 'NOW()');
  });

  it('should emit verbatim only for a real toSqlString function', () => {
    assert.strictEqual(
      format('INSERT INTO logs (created_at) VALUES (?)', [
        { toSqlString: () => 'NOW()' },
      ]),
      'INSERT INTO logs (created_at) VALUES (NOW())'
    );
  });

  it('should stringify an object whose toSqlString is a string, as untrusted JSON delivers it', () => {
    assert.strictEqual(
      format('INSERT INTO logs (created_at) VALUES (?)', [
        { toSqlString: 'NOW()' },
      ]),
      "INSERT INTO logs (created_at) VALUES ('[object Object]')"
    );
  });
});
