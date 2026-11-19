import type { PositionalQuery, SqlMode } from '../src/index.ts';
import { assert, describe, it } from 'poku';
import { format, toPositional } from '../src/index.ts';
import { ambiguousQuoteAt } from './__utils__/ambiguousQuoteAt.ts';

type Conversion = {
  name: string;
  sql: string;
  expected: PositionalQuery;
};

const values = {
  id: 7,
  name: 'Ana',
  column: 'email',
  user_id: 3,
  1: 'one',
  12: 'twelve',
};
const positionalValues = { 0: 'first', 1: 'second', id: 7 };

describe('Named placeholders: each name turns into a placeholder that takes its value in order', () => {
  const queries: Conversion[] = [
    {
      name: 'a name',
      sql: 'SELECT * FROM users WHERE id = :id',
      expected: { sql: 'SELECT * FROM users WHERE id = ?', values: [7] },
    },
    {
      name: 'a name with digits and underscores',
      sql: 'SELECT * FROM posts WHERE user_id = :user_id',
      expected: { sql: 'SELECT * FROM posts WHERE user_id = ?', values: [3] },
    },
    {
      name: 'a name made of digits',
      sql: 'SELECT :12',
      expected: { sql: 'SELECT ?', values: ['twelve'] },
    },
    {
      name: 'a name made of digits that ends at the first letter',
      sql: 'SELECT :1abc',
      expected: { sql: 'SELECT ?abc', values: ['one'] },
    },
    {
      name: 'several names',
      sql: 'UPDATE users SET name = :name WHERE id = :id',
      expected: {
        sql: 'UPDATE users SET name = ? WHERE id = ?',
        values: ['Ana', 7],
      },
    },
    {
      name: 'a repeated name',
      sql: 'SELECT * FROM t WHERE a = :id OR b = :id',
      expected: { sql: 'SELECT * FROM t WHERE a = ? OR b = ?', values: [7, 7] },
    },
    {
      name: 'a missing name',
      sql: 'SELECT :missing',
      expected: { sql: 'SELECT ?', values: [undefined] },
    },
    {
      name: 'an identifier name',
      sql: 'SELECT ::column FROM users WHERE id = :id',
      expected: {
        sql: 'SELECT ?? FROM users WHERE id = ?',
        values: ['email', 7],
      },
    },
    {
      name: 'a name right after another',
      sql: 'SELECT :id:name',
      expected: { sql: 'SELECT ??', values: [7, 'Ana'] },
    },
  ];

  for (const { name, sql, expected } of queries)
    it(`should convert ${name}`, () => {
      const actual = toPositional(sql, values);

      assert.deepStrictEqual(actual, expected);
    });
});

describe('Named placeholders: a colon that starts no name is left as written', () => {
  const queries = [
    { name: 'a colon before an underscore', sql: 'SELECT :_id' },
    { name: 'a colon before a non-ASCII letter', sql: 'SELECT :é' },
    { name: 'an assignment', sql: 'SET @total := 1' },
    { name: 'a label', sql: 'outer: LOOP LEAVE outer; END LOOP outer' },
  ];

  for (const { name, sql } of queries)
    it(`should keep ${name}`, () => {
      const actual = toPositional(sql, values);

      assert.deepStrictEqual(actual, { sql, values: [] });
    });
});

describe('Named placeholders: positional and colon forms behave as in named-placeholders', () => {
  const queries: Conversion[] = [
    {
      name: 'question marks mixed with names, each taking the next numbered value',
      sql: 'SELECT ?, :id, ?',
      expected: { sql: 'SELECT ?, ?, ?', values: ['first', 7, 'second'] },
    },
    {
      name: 'a double question mark, which takes two numbered values',
      sql: 'SELECT ?? FROM t WHERE id = :id',
      expected: {
        sql: 'SELECT ?? FROM t WHERE id = ?',
        values: ['first', 'second', 7],
      },
    },
    {
      name: 'a name made of digits and a question mark that read the same value',
      sql: 'SELECT :0, ?',
      expected: { sql: 'SELECT ?, ?', values: ['first', 'first'] },
    },
    {
      name: 'a colon right before a question mark',
      sql: 'SELECT x:?',
      expected: { sql: 'SELECT x??', values: ['first'] },
    },
    {
      name: 'a colon that ends the query',
      sql: 'SELECT :id, @total := total:',
      expected: { sql: 'SELECT ?, @total := total', values: [7] },
    },
  ];

  for (const { name, sql, expected } of queries)
    it(`should convert ${name}`, () => {
      const actual = toPositional(sql, positionalValues);

      assert.deepStrictEqual(actual, expected);
    });
});

describe('Named placeholders: each value is read from the object as given', () => {
  it('should read a value the object inherits', () => {
    const withDefaults = Object.assign(Object.create({ status: 'active' }), {
      id: 7,
    });
    const actual = toPositional(
      'SELECT * FROM t WHERE id = :id AND status = :status',
      withDefaults
    );

    assert.deepStrictEqual(actual, {
      sql: 'SELECT * FROM t WHERE id = ? AND status = ?',
      values: [7, 'active'],
    });
  });

  it('should read a value from a class instance and its getter', () => {
    class Account {
      id = 7;
      readonly #status = 'active';

      get status() {
        return this.#status;
      }
    }

    const actual = toPositional(
      'SELECT * FROM t WHERE id = :id AND status = :status',
      new Account()
    );

    assert.deepStrictEqual(actual, {
      sql: 'SELECT * FROM t WHERE id = ? AND status = ?',
      values: [7, 'active'],
    });
  });

  it('should return each value untouched and never write one into the SQL', () => {
    const tags = ['a', 'b'];
    const actual = toPositional(
      'SELECT * FROM t WHERE name = :name AND tag IN (:tags)',
      { name: "' OR 1=1 -- ", tags }
    );

    assert.strictEqual(
      actual.sql,
      'SELECT * FROM t WHERE name = ? AND tag IN (?)'
    );
    assert.strictEqual(actual.values[0], "' OR 1=1 -- ");
    assert.strictEqual(actual.values[1], tags);
  });
});

describe('Named placeholders: without values', () => {
  const missingValuesAt = (position: number, given: string) => ({
    name: 'TypeError',
    message: `argument sql has a placeholder at position ${position}, but argument values is ${given}: pass an object that holds the value of each placeholder`,
  });
  const withoutPlaceholder = [
    { name: 'a query without a placeholder', sql: 'SELECT 1' },
    {
      name: 'a query whose names are all inside strings, identifiers, or comments',
      sql: "SELECT ':id', `a:b` -- :note",
    },
  ];

  for (const { name, sql } of withoutPlaceholder)
    it(`should return ${name} as written`, () => {
      const actual = toPositional(sql);

      assert.deepStrictEqual(actual, { sql, values: [] });
    });

  it('should reject a query with a placeholder when the values are undefined', () => {
    assert.throws(
      () => toPositional('SELECT * FROM t WHERE id = :id'),
      missingValuesAt(27, 'undefined')
    );
  });

  it('should reject a query with a placeholder when the values are null', () => {
    assert.throws(
      // @ts-expect-error: testing values that are not an object
      () => toPositional('SELECT ?', null),
      missingValuesAt(7, 'null')
    );
  });

  it('should reject a query that is not a string', () => {
    assert.throws(
      // @ts-expect-error: testing a query that is not a string
      () => toPositional(undefined, values),
      { name: 'TypeError', message: 'argument sql must be a string' }
    );
  });
});

describe('Named placeholders: a placeholder inside a string, an identifier, or a comment is left as written', () => {
  const queries: Conversion[] = [
    {
      name: 'a single-quoted string',
      sql: "SELECT * FROM t WHERE note = ':name' AND id = :id",
      expected: {
        sql: "SELECT * FROM t WHERE note = ':name' AND id = ?",
        values: [7],
      },
    },
    {
      name: 'a double-quoted string',
      sql: 'SELECT * FROM t WHERE note = ":name" AND id = :id',
      expected: {
        sql: 'SELECT * FROM t WHERE note = ":name" AND id = ?',
        values: [7],
      },
    },
    {
      name: 'a backtick identifier',
      sql: 'SELECT `a:b` AS x FROM t WHERE id = :id',
      expected: { sql: 'SELECT `a:b` AS x FROM t WHERE id = ?', values: [7] },
    },
    {
      name: 'a double-dash comment',
      sql: 'UPDATE t SET name = :name -- :column\nWHERE id = :id',
      expected: {
        sql: 'UPDATE t SET name = ? -- :column\nWHERE id = ?',
        values: ['Ana', 7],
      },
    },
    {
      name: 'a hash comment',
      sql: 'UPDATE t SET name = :name # :column\nWHERE id = :id',
      expected: {
        sql: 'UPDATE t SET name = ? # :column\nWHERE id = ?',
        values: ['Ana', 7],
      },
    },
    {
      name: 'a block comment',
      sql: 'UPDATE t SET name = :name /* :column */ WHERE id = :id',
      expected: {
        sql: 'UPDATE t SET name = ? /* :column */ WHERE id = ?',
        values: ['Ana', 7],
      },
    },
    {
      name: 'a comment that holds a quote',
      sql: "SELECT :name -- don't\nFROM t WHERE id = :id",
      expected: {
        sql: "SELECT ? -- don't\nFROM t WHERE id = ?",
        values: ['Ana', 7],
      },
    },
    {
      name: 'a backtick identifier that holds a quote',
      sql: "SELECT `it's` FROM t WHERE id = :id",
      expected: { sql: "SELECT `it's` FROM t WHERE id = ?", values: [7] },
    },
    {
      name: 'a string with a backslash before a question mark',
      sql: "SELECT 'why\\?' AS q FROM t WHERE id = :id",
      expected: {
        sql: "SELECT 'why\\?' AS q FROM t WHERE id = ?",
        values: [7],
      },
    },
    {
      name: 'a comment that ends the query with a colon',
      sql: 'SELECT :id -- note:',
      expected: { sql: 'SELECT ? -- note:', values: [7] },
    },
  ];

  for (const { name, sql, expected } of queries)
    it(`should convert only the placeholders outside ${name}`, () => {
      const actual = toPositional(sql, values);

      assert.deepStrictEqual(actual, expected);
    });

  it('should give no value to a question mark inside a comment', () => {
    const actual = toPositional('SELECT ? /* why? */, ?', positionalValues);

    assert.deepStrictEqual(actual, {
      sql: 'SELECT ? /* why? */, ?',
      values: ['first', 'second'],
    });
  });

  it('should convert the placeholders inside executable comments and optimizer hints', () => {
    const actual = toPositional(
      'SELECT /*+ MAX_EXECUTION_TIME(:1) */ /*! :name */ 1',
      values
    );

    assert.deepStrictEqual(actual, {
      sql: 'SELECT /*+ MAX_EXECUTION_TIME(?) */ /*! ? */ 1',
      values: ['one', 'Ana'],
    });
  });
});

describe('Named placeholders: the converted query formats as the named one reads', () => {
  it('should keep the value of a name in a comment out of the query', () => {
    const converted = toPositional(
      'UPDATE docs SET title = :title -- :note\nWHERE owner = :owner',
      { title: 'T', note: 'N', owner: 42 }
    );
    const actual = format(converted.sql, converted.values);

    assert.strictEqual(
      actual,
      "UPDATE docs SET title = 'T' -- :note\nWHERE owner = 42"
    );
  });

  it('should format an identifier name as an identifier', () => {
    const converted = toPositional(
      'SELECT ::column FROM users WHERE id = :id',
      { column: 'email', id: 7 }
    );
    const actual = format(converted.sql, converted.values);

    assert.strictEqual(actual, 'SELECT `email` FROM users WHERE id = 7');
  });
});

describe('Named placeholders: ANSI quotes', () => {
  const ansiQuotes: SqlMode = { ansiQuotes: true };

  it('should read a double-quoted identifier that ends in a backslash', () => {
    const actual = toPositional(
      'SELECT "dir\\" FROM t WHERE id = :id',
      values,
      ansiQuotes
    );

    assert.deepStrictEqual(actual, {
      sql: 'SELECT "dir\\" FROM t WHERE id = ?',
      values: [7],
    });
  });

  it('should leave a name inside a double-quoted identifier as written', () => {
    const actual = toPositional(
      'SELECT "a:b" FROM t WHERE id = :id',
      values,
      ansiQuotes
    );

    assert.deepStrictEqual(actual, {
      sql: 'SELECT "a:b" FROM t WHERE id = ?',
      values: [7],
    });
  });

  it('should read the same double quotes as a string with backslash escapes when the mode is off', () => {
    const actual = toPositional('SELECT "dir\\" FROM t WHERE id = :id', values);

    assert.deepStrictEqual(actual, {
      sql: 'SELECT "dir\\" FROM t WHERE id = :id',
      values: [],
    });
  });
});

describe('Named placeholders: a quote that the two modes read differently', () => {
  const noBackslashEscapes: SqlMode = { noBackslashEscapes: true };
  const rejected = [
    {
      name: 'a placeholder after the string that ends in a backslash',
      sql: "SELECT 'C:\\' AS path, :id",
      position: 11,
    },
    {
      name: 'a placeholder that only a reading with backslash escapes finds',
      sql: "SELECT 'a\\' -- ', :id",
      position: 10,
    },
    {
      name: 'a placeholder after a doubled quote that follows a backslash',
      sql: "SELECT 'a\\''b', :id",
      position: 10,
    },
    {
      name: 'a placeholder between two such strings',
      sql: "SELECT 'C:\\', :id, 'D:\\'",
      position: 11,
    },
    {
      name: 'a placeholder after two such strings',
      sql: "SELECT 'C:\\', 'D:\\', :id",
      position: 11,
    },
  ];
  const keptAsWritten = [
    {
      name: 'the string alone',
      sql: "SELECT 'C:\\' AS path",
    },
    {
      name: 'the string before a question mark that both readings leave in a comment or a string',
      sql: "SELECT 'C:\\' AS path -- why?",
    },
  ];

  for (const { name, sql, position } of rejected) {
    it(`should reject ${name}`, () => {
      assert.throws(
        () => toPositional(sql, values, noBackslashEscapes),
        ambiguousQuoteAt(position)
      );
    });

    it(`should reject ${name} when the values are undefined`, () => {
      assert.throws(
        () => toPositional(sql, undefined, noBackslashEscapes),
        ambiguousQuoteAt(position)
      );
    });
  }

  for (const { name, sql } of keptAsWritten)
    it(`should return ${name} as written, even without values`, () => {
      const actual = toPositional(sql, undefined, noBackslashEscapes);

      assert.deepStrictEqual(actual, { sql, values: [] });
    });

  it('should convert the placeholders before the string and keep it as written', () => {
    const actual = toPositional(
      "SELECT :id, 'C:\\' AS path",
      values,
      noBackslashEscapes
    );

    assert.deepStrictEqual(actual, {
      sql: "SELECT ?, 'C:\\' AS path",
      values: [7],
    });
  });

  it('should read a doubled quote and a string that ends in two backslashes the same way in both modes', () => {
    const actual = toPositional(
      "SELECT 'C:\\\\' AS path, 'it''s :name' AS note FROM t WHERE id = :id",
      values,
      noBackslashEscapes
    );

    assert.deepStrictEqual(actual, {
      sql: "SELECT 'C:\\\\' AS path, 'it''s :name' AS note FROM t WHERE id = ?",
      values: [7],
    });
  });

  it('should keep reading a backslash before a quote as an escape when the mode is off', () => {
    const actual = toPositional("SELECT 'C:\\' AS path, :id", values);

    assert.deepStrictEqual(actual, {
      sql: "SELECT 'C:\\' AS path, :id",
      values: [],
    });
  });
});

describe('Named placeholders: the noBackslashEscapes option is a boolean of its own', () => {
  it('should reject a mode that is not a boolean in a query with a placeholder', () => {
    assert.throws(
      // @ts-expect-error: testing a mode that is not a boolean
      () => toPositional('SELECT :id', values, { noBackslashEscapes: 'yes' }),
      {
        name: 'TypeError',
        message:
          'sqlMode.noBackslashEscapes must be a boolean, received string',
      }
    );
  });

  it('should ignore a mode that is not a boolean given a query with no question mark or colon', () => {
    const invalidMode = { noBackslashEscapes: 'yes' };
    // @ts-expect-error: testing a mode that is not a boolean
    const actual = toPositional('SELECT 1', undefined, invalidMode);

    assert.deepStrictEqual(actual, { sql: 'SELECT 1', values: [] });
  });
});
