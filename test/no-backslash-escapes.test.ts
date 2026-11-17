import type { Raw, SqlMode, SqlValue, TemporalValue } from '../src/index.ts';
import { Buffer } from 'node:buffer';
import { assert, describe, it } from 'poku';
import {
  arrayToList,
  dateToString,
  escape,
  expand,
  format,
  objectToValues,
  raw,
  temporalToString,
} from '../src/index.ts';

const noBackslashEscapes: SqlMode = { noBackslashEscapes: true };

const hostileTemporal: TemporalValue = {
  [Symbol.toStringTag]: 'Temporal.PlainDate',
  toString: () => "x\\' OR 1=1 -- ",
};

const hostilePlainDateTime: TemporalValue = {
  [Symbol.toStringTag]: 'Temporal.PlainDateTime',
  toString: () => "2024-01-01T00:00:00' OR 1=1 -- ",
};

const formatUnderNoBackslashEscapes = (sql: string, values: SqlValue[]) =>
  format(sql, values, false, 'local', noBackslashEscapes);

describe('No backslash escapes: a string escapes its quotes by doubling them', () => {
  const strings = [
    { name: 'a quote', value: "it's", expected: "'it''s'" },
    { name: 'a backslash', value: 'C:\\dir\\', expected: "'C:\\dir\\'" },
    {
      name: 'a backslash before a quote',
      value: "x\\' OR 1=1 -- ",
      expected: "'x\\'' OR 1=1 -- '",
    },
    {
      name: 'control characters and a double quote',
      value: '\0\b\t\n\r\x1a"',
      expected: "'\0\b\t\n\r\x1a\"'",
    },
    { name: 'no special character', value: 'plain', expected: "'plain'" },
  ];

  for (const { name, value, expected } of strings) {
    it(`should escape ${name} in escape()`, () => {
      const actual = escape(value, false, 'local', noBackslashEscapes);

      assert.strictEqual(actual, expected);
    });

    it(`should escape ${name} in format()`, () => {
      const actual = formatUnderNoBackslashEscapes('SELECT ?', [value]);

      assert.strictEqual(actual, `SELECT ${expected}`);
    });
  }

  it('should escape with backslashes when the mode is off', () => {
    const actual = escape("it's C:\\", false, 'local', {
      noBackslashEscapes: false,
    });

    assert.strictEqual(actual, "'it\\'s C:\\\\'");
  });
});

describe('No backslash escapes: nested values escape by the same rules', () => {
  const placements = [
    {
      name: 'an array',
      sql: 'SELECT * FROM t WHERE name IN (?)',
      values: [["it's", 'C:\\']],
      expected: "SELECT * FROM t WHERE name IN ('it''s', 'C:\\')",
    },
    {
      name: 'a nested array',
      sql: 'INSERT INTO t (a, b) VALUES ?',
      values: [[["it's", 1]]],
      expected: "INSERT INTO t (a, b) VALUES ('it''s', 1)",
    },
    {
      name: 'a Set',
      sql: 'SELECT * FROM t WHERE name IN (?)',
      values: [new Set(["it's"])],
      expected: "SELECT * FROM t WHERE name IN ('it''s')",
    },
    {
      name: 'an object in a SET clause',
      sql: 'UPDATE t SET ?',
      values: [{ name: "it's\\" }],
      expected: "UPDATE t SET `name` = 'it''s\\'",
    },
    {
      name: 'a Map in a SET clause',
      sql: 'UPDATE t SET ?',
      values: [new Map([['name', "it's"]])],
      expected: "UPDATE t SET `name` = 'it''s'",
    },
    {
      name: 'a Set inside an array',
      sql: 'INSERT INTO t (a) VALUES ?',
      values: [[new Set(["it's"])]],
      expected: "INSERT INTO t (a) VALUES ('it''s')",
    },
    {
      name: 'a marked object',
      sql: 'SELECT * FROM t WHERE ?',
      values: [expand({ name: "it's" })],
      expected: "SELECT * FROM t WHERE `name` = 'it''s'",
    },
    {
      name: 'an object outside a SET clause',
      sql: 'SELECT * FROM t WHERE name = ?',
      values: [{ toString: () => "it's" }],
      expected: "SELECT * FROM t WHERE name = 'it''s'",
    },
  ];

  const nestedSelect: Raw = {
    toSqlString: (sqlMode) =>
      format(
        'SELECT id FROM u WHERE name = ?',
        ["x\\' OR 1=1 -- "],
        false,
        'local',
        sqlMode
      ),
  };

  for (const { name, sql, values, expected } of placements)
    it(`should double the quotes in ${name}`, () => {
      const actual = formatUnderNoBackslashEscapes(sql, values);

      assert.strictEqual(actual, expected);
    });

  it('should double the quotes in arrayToList()', () => {
    const actual = arrayToList(["it's"], 'local', noBackslashEscapes);

    assert.strictEqual(actual, "'it''s'");
  });

  it('should double the quotes in objectToValues()', () => {
    const actual = objectToValues(
      { name: "it's" },
      'local',
      noBackslashEscapes
    );

    assert.strictEqual(actual, "`name` = 'it''s'");
  });

  it('should double the quotes in an object expanded by escape()', () => {
    const actual = escape(
      { name: "it's" },
      undefined,
      'local',
      noBackslashEscapes
    );

    assert.strictEqual(actual, "`name` = 'it''s'");
  });

  it('should double the quotes in an object stringified as a string', () => {
    const actual = format(
      'SELECT ?',
      [{ toString: () => "it's" }],
      true,
      'local',
      noBackslashEscapes
    );

    assert.strictEqual(actual, "SELECT 'it''s'");
  });

  it('should pass the mode to a nested value that builds its own query', () => {
    const actual = formatUnderNoBackslashEscapes(
      'SELECT * FROM t WHERE id IN (?)',
      [nestedSelect]
    );

    assert.strictEqual(
      actual,
      "SELECT * FROM t WHERE id IN (SELECT id FROM u WHERE name = 'x\\'' OR 1=1 -- ')"
    );
  });

  it('should keep a nested value from changing the mode later values receive', () => {
    const tampering: Raw = {
      toSqlString: (sqlMode) => {
        if (sqlMode) Reflect.set(sqlMode, 'noBackslashEscapes', false);

        return 'NULL';
      },
    };

    formatUnderNoBackslashEscapes('SELECT ?', [tampering]);

    const actual = formatUnderNoBackslashEscapes(
      'SELECT * FROM t WHERE id IN (?)',
      [nestedSelect]
    );

    assert.strictEqual(
      actual,
      "SELECT * FROM t WHERE id IN (SELECT id FROM u WHERE name = 'x\\'' OR 1=1 -- ')"
    );
  });
});

describe('No backslash escapes: a string ends at its first unpaired quote', () => {
  const values = [7, 'bob'];
  const literals = [
    {
      name: 'a single-quoted string that ends in a backslash',
      sql: "SELECT 'C:\\' FROM t WHERE id = ? AND owner = ?",
      expected: "SELECT 'C:\\' FROM t WHERE id = 7 AND owner = 'bob'",
    },
    {
      name: 'a double-quoted string that ends in a backslash',
      sql: 'SELECT "C:\\" FROM t WHERE id = ? AND owner = ?',
      expected: 'SELECT "C:\\" FROM t WHERE id = 7 AND owner = \'bob\'',
    },
    {
      name: 'a doubled quote after a backslash',
      sql: "SELECT 'a\\''?' FROM t WHERE id = ? AND owner = ?",
      expected: "SELECT 'a\\''?' FROM t WHERE id = 7 AND owner = 'bob'",
    },
    {
      name: 'a string that ends in a backslash between two placeholders',
      sql: "SELECT * FROM t WHERE id = ? AND path = 'C:\\' AND owner = ?",
      expected:
        "SELECT * FROM t WHERE id = 7 AND path = 'C:\\' AND owner = 'bob'",
    },
    {
      name: 'a string that ends in a backslash after an ignored ???',
      sql: "SELECT ??? FROM t WHERE path = 'C:\\' AND id = ? AND owner = ?",
      expected:
        "SELECT ??? FROM t WHERE path = 'C:\\' AND id = 7 AND owner = 'bob'",
    },
  ];
  const setWordsInStrings = [
    {
      name: 'the first statement',
      sql: "UPDATE t SET path = 'C:\\' WHERE tag IN ('SET #'\n, ?)",
      expected:
        "UPDATE t SET path = 'C:\\' WHERE tag IN ('SET #'\n, '[object Object]')",
    },
    {
      name: 'a later statement',
      sql: "UPDATE t SET a = 1; UPDATE u SET path = 'C:\\' WHERE tag IN ('SET #'\n, ?)",
      expected:
        "UPDATE t SET a = 1; UPDATE u SET path = 'C:\\' WHERE tag IN ('SET #'\n, '[object Object]')",
    },
  ];

  for (const { name, sql, expected } of literals)
    it(`should bind the values in order after ${name}`, () => {
      const actual = formatUnderNoBackslashEscapes(sql, values);

      assert.strictEqual(actual, expected);
    });

  it('should expand an object after an assigned string that ends in a backslash', () => {
    const actual = formatUnderNoBackslashEscapes("UPDATE t SET a = 'C:\\', ?", [
      { b: 2 },
    ]);

    assert.strictEqual(actual, "UPDATE t SET a = 'C:\\', `b` = 2");
  });

  for (const { name, sql, expected } of setWordsInStrings)
    it(`should keep an object inert after a SET inside a string in ${name}`, () => {
      const actual = formatUnderNoBackslashEscapes(sql, [{ admin: true }]);

      assert.strictEqual(actual, expected);
    });

  it('should leave a placeholder inside an unterminated string', () => {
    const actual = formatUnderNoBackslashEscapes("SELECT 'C:\\ ?", [1]);

    assert.strictEqual(actual, "SELECT 'C:\\ ?");
  });

  it('should read double-quoted text as an identifier with ANSI quotes too', () => {
    const actual = format(
      'SELECT "dir\\", \'C:\\\' FROM t WHERE id = ? AND owner = ?',
      values,
      false,
      'local',
      { ansiQuotes: true, noBackslashEscapes: true }
    );

    assert.strictEqual(
      actual,
      "SELECT \"dir\\\", 'C:\\' FROM t WHERE id = 7 AND owner = 'bob'"
    );
  });
});

describe('No backslash escapes: every kind of value', () => {
  const kinds = [
    { name: 'a number', value: 5, expected: '5' },
    { name: 'a boolean', value: true, expected: 'true' },
    { name: 'null', value: null, expected: 'NULL' },
    { name: 'a Buffer', value: Buffer.from([0x27, 0x5c]), expected: "X'275c'" },
    {
      name: 'a Date',
      value: new Date(Date.UTC(2012, 4, 7, 11, 42, 3, 2)),
      expected: "'2012-05-07 11:42:03.002'",
    },
    {
      name: 'a value tagged as Temporal',
      value: hostileTemporal,
      expected: "'x\\'' OR 1=1 -- '",
    },
    { name: 'a raw value', value: raw("'a\\'"), expected: "'a\\'" },
    {
      name: 'a value tagged as Temporal.PlainDateTime',
      value: hostilePlainDateTime,
      expected: "'2024-01-01 00:00:00'' OR 1=1 -- '",
    },
    {
      name: 'a marked object',
      value: expand({ name: "it's" }),
      expected: "`name` = 'it''s'",
    },
  ];

  for (const { name, value, expected } of kinds)
    it(`should escape ${name}`, () => {
      const actual = escape(value, false, 'Z', noBackslashEscapes);

      assert.strictEqual(actual, expected);
    });

  it('should double the quotes in dateToString() and temporalToString()', () => {
    const date = dateToString(new Date(0), 'Z', noBackslashEscapes);
    const temporal = temporalToString(hostileTemporal, 'Z', noBackslashEscapes);

    assert.strictEqual(date, "'1970-01-01 00:00:00.000'");
    assert.strictEqual(temporal, "'x\\'' OR 1=1 -- '");
  });

  it('should double the quotes in a value of an unrecognized type', () => {
    const values: SqlValue[] = [];

    Reflect.set(values, 0, Symbol("it's"));

    const actual = formatUnderNoBackslashEscapes('SELECT ?', values);

    assert.strictEqual(actual, "SELECT 'Symbol(it''s)'");
  });

  it('should escape an identifier placeholder after a string that ends in a backslash', () => {
    const actual = formatUnderNoBackslashEscapes("SELECT 'C:\\', ?? FROM t", [
      'name',
    ]);

    assert.strictEqual(actual, "SELECT 'C:\\', `name` FROM t");
  });

  it('should skip a comment after a string that ends in a backslash', () => {
    const actual = formatUnderNoBackslashEscapes(
      "SELECT 'C:\\' -- ?\n, ?",
      [1]
    );

    assert.strictEqual(actual, "SELECT 'C:\\' -- ?\n, 1");
  });
});

describe('No backslash escapes: the option is a boolean of its own', () => {
  const invalid: unknown[] = [512, 1, 'true', null];

  for (const flag of invalid)
    it(`should throw for ${JSON.stringify(flag)}`, () => {
      const sqlMode: SqlMode = {};

      Reflect.set(sqlMode, 'noBackslashEscapes', flag);

      assert.throws(() => escape("it's", false, 'local', sqlMode), TypeError);
      assert.throws(
        () => format('SELECT ?', ["it's"], false, 'local', sqlMode),
        TypeError
      );
    });

  it('should ignore an inherited flag', () => {
    const sqlMode: SqlMode = Object.create({ noBackslashEscapes: true });

    const actual = escape("it's", false, 'local', sqlMode);

    assert.strictEqual(actual, "'it\\'s'");
  });

  it('should treat an undefined flag as off', () => {
    const actual = escape("it's", false, 'local', {
      noBackslashEscapes: undefined,
    });

    assert.strictEqual(actual, "'it\\'s'");
  });
});
