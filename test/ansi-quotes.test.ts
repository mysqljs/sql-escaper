import type { Raw, SqlMode, SqlValue } from '../src/index.ts';
import { assert, describe, it } from 'poku';
import { format } from '../src/index.ts';

const ansiQuotes: SqlMode = { ansiQuotes: true };

const formatUnderAnsiQuotes = (sql: string, values: SqlValue[]) =>
  format(sql, values, false, 'local', ansiQuotes);

describe('ANSI quotes: a double-quoted identifier ends only at its closing quote', () => {
  const values = [7, 'bob'];
  const identifiers = [
    {
      name: 'an identifier that ends in a backslash',
      sql: 'SELECT "dir\\" FROM t WHERE id = ? AND owner = ?',
      expected: 'SELECT "dir\\" FROM t WHERE id = 7 AND owner = \'bob\'',
    },
    {
      name: 'a doubled quote after a backslash',
      sql: 'SELECT "a\\""?" FROM t WHERE id = ? AND owner = ?',
      expected: 'SELECT "a\\""?" FROM t WHERE id = 7 AND owner = \'bob\'',
    },
    {
      name: 'a single-quoted string that keeps its backslash escapes',
      sql: "SELECT 'it\\'s ?', \"dir\\\" FROM t WHERE id = ? AND owner = ?",
      expected:
        "SELECT 'it\\'s ?', \"dir\\\" FROM t WHERE id = 7 AND owner = 'bob'",
    },
  ];

  for (const { name, sql, expected } of identifiers)
    it(`should bind the values in order after ${name}`, () => {
      const actual = formatUnderAnsiQuotes(sql, values);

      assert.strictEqual(actual, expected);
    });
});

describe('ANSI quotes: a hostile value never lands inside an identifier', () => {
  it('should bind a string that tries to close the identifier at the real placeholder after an identifier that ends in a backslash', () => {
    const actual = formatUnderAnsiQuotes(
      'SELECT "a\\", "b?" FROM t WHERE id = ?',
      ['" OR 1=1 -- ']
    );

    assert.strictEqual(
      actual,
      'SELECT "a\\", "b?" FROM t WHERE id = \'\\" OR 1=1 -- \''
    );
  });
});

describe('ANSI quotes: a SET list reads double-quoted identifiers by the same rules', () => {
  const values = [{ b: 2 }];
  const assignments = [
    {
      name: 'after a table name that ends in a backslash',
      sql: 'UPDATE "dir\\" SET ?',
      expected: 'UPDATE "dir\\" SET `b` = 2',
    },
    {
      name: 'after an assigned column that ends in a backslash',
      sql: 'UPDATE t SET "dir\\" = 1, ?',
      expected: 'UPDATE t SET "dir\\" = 1, `b` = 2',
    },
  ];

  for (const { name, sql, expected } of assignments)
    it(`should expand an object ${name}`, () => {
      const actual = formatUnderAnsiQuotes(sql, values);

      assert.strictEqual(actual, expected);
    });
});

describe('ANSI quotes: a nested value builds its SQL under the same setting', () => {
  it('should pass the mode to a nested value that builds its own query', () => {
    const nestedSelect: Raw = {
      toSqlString: (sqlMode) =>
        format(
          'SELECT id FROM u WHERE "dir\\" = ?',
          [7],
          false,
          'local',
          sqlMode
        ),
    };
    const actual = formatUnderAnsiQuotes('SELECT * FROM t WHERE id IN (?)', [
      nestedSelect,
    ]);

    assert.strictEqual(
      actual,
      'SELECT * FROM t WHERE id IN (SELECT id FROM u WHERE "dir\\" = 7)'
    );
  });
});

describe('ANSI quotes: double-quoted text stays a string unless the setting is on', () => {
  const sql = 'SELECT * FROM t WHERE note = "say \\"why?\\"" AND id = ?';
  const expected = 'SELECT * FROM t WHERE note = "say \\"why?\\"" AND id = 1';
  const modes: { label: string; sqlMode?: SqlMode }[] = [
    { label: 'empty', sqlMode: {} },
    { label: 'false', sqlMode: { ansiQuotes: false } },
  ];

  for (const { label, sqlMode } of modes)
    it(`should keep a backslash-escaped quote inside the string when the setting is ${label}`, () => {
      const actual = format(sql, [1], false, 'local', sqlMode);

      assert.strictEqual(actual, expected);
    });
});
