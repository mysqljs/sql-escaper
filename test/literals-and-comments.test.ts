import { assert, describe, it } from 'poku';
import { format } from '../src/index.ts';

describe('Literals and comments: a placeholder inside them is never bound', () => {
  const values = [7, 'bob'];
  const contexts = [
    {
      name: 'single-quoted string',
      sql: "SELECT * FROM t WHERE note = 'why?' AND id = ? AND owner = ?",
      expected:
        "SELECT * FROM t WHERE note = 'why?' AND id = 7 AND owner = 'bob'",
    },
    {
      name: 'double-quoted string',
      sql: 'SELECT * FROM t WHERE note = "why?" AND id = ? AND owner = ?',
      expected:
        'SELECT * FROM t WHERE note = "why?" AND id = 7 AND owner = \'bob\'',
    },
    {
      name: 'backtick identifier',
      sql: 'SELECT `why?` FROM t WHERE id = ? AND owner = ?',
      expected: "SELECT `why?` FROM t WHERE id = 7 AND owner = 'bob'",
    },
    {
      name: 'double-dash comment',
      sql: 'SELECT * FROM t WHERE id = ? -- why?\nAND owner = ?',
      expected: "SELECT * FROM t WHERE id = 7 -- why?\nAND owner = 'bob'",
    },
    {
      name: 'hash comment',
      sql: 'SELECT * FROM t WHERE id = ? # why?\nAND owner = ?',
      expected: "SELECT * FROM t WHERE id = 7 # why?\nAND owner = 'bob'",
    },
    {
      name: 'block comment',
      sql: 'SELECT * FROM t WHERE id = ? /* why? */ AND owner = ?',
      expected: "SELECT * FROM t WHERE id = 7 /* why? */ AND owner = 'bob'",
    },
    {
      name: 'double-dash comment that runs to the end of the query',
      sql: 'SELECT * FROM t WHERE id = ? -- owner = ?',
      expected: 'SELECT * FROM t WHERE id = 7 -- owner = ?',
    },
    {
      name: 'hash comment that runs to the end of the query',
      sql: 'SELECT * FROM t WHERE id = ? # owner = ?',
      expected: 'SELECT * FROM t WHERE id = 7 # owner = ?',
    },
  ];

  for (const { name, sql, expected } of contexts)
    it(`should leave the placeholder in a ${name} and bind the values in order`, () => {
      const actual = format(sql, values);

      assert.strictEqual(actual, expected);
    });
});

describe('Literals and comments: a quote or comment marker inside them opens nothing', () => {
  const values = [1];
  const markers = [
    {
      name: 'an apostrophe inside a double-quoted string',
      sql: 'SELECT * FROM users WHERE name = "O\'Brien" AND id = ?',
      expected: 'SELECT * FROM users WHERE name = "O\'Brien" AND id = 1',
    },
    {
      name: 'an apostrophe inside a hash comment',
      sql: "SELECT * FROM users # don't cache\nWHERE id = ?",
      expected: "SELECT * FROM users # don't cache\nWHERE id = 1",
    },
    {
      name: 'an apostrophe inside a double-dash comment',
      sql: "SELECT * FROM users -- don't cache\nWHERE id = ?",
      expected: "SELECT * FROM users -- don't cache\nWHERE id = 1",
    },
    {
      name: 'an apostrophe inside a block comment',
      sql: "SELECT * FROM users /* don't cache */ WHERE id = ?",
      expected: "SELECT * FROM users /* don't cache */ WHERE id = 1",
    },
    {
      name: 'a double quote inside a single-quoted string',
      sql: "SELECT * FROM users WHERE note = 'say \"hi' AND id = ?",
      expected: "SELECT * FROM users WHERE note = 'say \"hi' AND id = 1",
    },
    {
      name: 'a hash inside a single-quoted string',
      sql: "SELECT * FROM users WHERE tag = '#1' AND id = ?",
      expected: "SELECT * FROM users WHERE tag = '#1' AND id = 1",
    },
    {
      name: 'a hash inside a double-quoted string',
      sql: 'SELECT * FROM users WHERE tag = "#1" AND id = ?',
      expected: 'SELECT * FROM users WHERE tag = "#1" AND id = 1',
    },
    {
      name: 'a hash inside a backtick identifier',
      sql: 'SELECT `#tag` FROM users WHERE id = ?',
      expected: 'SELECT `#tag` FROM users WHERE id = 1',
    },
  ];

  for (const { name, sql, expected } of markers)
    it(`should bind the placeholder after ${name}`, () => {
      const actual = format(sql, values);

      assert.strictEqual(actual, expected);
    });
});

describe('Literals and comments: a double-quoted string ends only at an unescaped quote', () => {
  const values = [1];
  const escapes = [
    {
      name: 'a backslash-escaped quote',
      sql: 'SELECT * FROM t WHERE note = "say \\"why?\\"" AND id = ?',
      expected: 'SELECT * FROM t WHERE note = "say \\"why?\\"" AND id = 1',
    },
    {
      name: 'a doubled quote',
      sql: 'SELECT * FROM t WHERE note = "say ""why?""" AND id = ?',
      expected: 'SELECT * FROM t WHERE note = "say ""why?""" AND id = 1',
    },
    {
      name: 'an escaped backslash before the closing quote',
      sql: 'SELECT * FROM t WHERE path = "C:\\\\" AND id = ?',
      expected: 'SELECT * FROM t WHERE path = "C:\\\\" AND id = 1',
    },
  ];

  for (const { name, sql, expected } of escapes)
    it(`should bind the placeholder after a double-quoted string with ${name}`, () => {
      const actual = format(sql, values);

      assert.strictEqual(actual, expected);
    });
});

describe('Literals and comments: a keyword inside them does not end a SET list', () => {
  const values = [{ b: 2 }];
  const contexts = [
    {
      name: 'single-quoted string',
      sql: "UPDATE t SET a = 'where id = 1', ?",
      expected: "UPDATE t SET a = 'where id = 1', `b` = 2",
    },
    {
      name: 'double-quoted string',
      sql: 'UPDATE t SET a = "where id = 1", ?',
      expected: 'UPDATE t SET a = "where id = 1", `b` = 2',
    },
    {
      name: 'backtick identifier',
      sql: 'UPDATE t SET `where` = 1, ?',
      expected: 'UPDATE t SET `where` = 1, `b` = 2',
    },
    {
      name: 'double-dash comment',
      sql: 'UPDATE t SET a = 1 -- where\n, ?',
      expected: 'UPDATE t SET a = 1 -- where\n, `b` = 2',
    },
    {
      name: 'hash comment',
      sql: 'UPDATE t SET a = 1 # where\n, ?',
      expected: 'UPDATE t SET a = 1 # where\n, `b` = 2',
    },
    {
      name: 'block comment',
      sql: 'UPDATE t SET a = 1 /* where */, ?',
      expected: 'UPDATE t SET a = 1 /* where */, `b` = 2',
    },
  ];

  for (const { name, sql, expected } of contexts)
    it(`should expand an object after a WHERE written inside a ${name}`, () => {
      const actual = format(sql, values);

      assert.strictEqual(actual, expected);
    });
});
