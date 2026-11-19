import type { Expand } from '../src/index.ts';
import { Buffer } from 'node:buffer';
import { assert, describe, it } from 'poku';
import { escape, expand, format, raw } from '../src/index.ts';
import { noColumnToSet } from './__utils__/noColumnToSet.ts';

const MARK = Symbol.for('sql-escaper.expand');

describe('expand: a marked object expands wherever it is bound', () => {
  const positions = [
    {
      name: 'a statement made of a single placeholder',
      sql: '?',
      expected: '`id` = 1',
    },
    {
      name: 'a WHERE clause',
      sql: 'SELECT * FROM users WHERE ?',
      expected: 'SELECT * FROM users WHERE `id` = 1',
    },
    {
      name: 'a condition after AND',
      sql: 'SELECT * FROM users WHERE active = 1 AND ?',
      expected: 'SELECT * FROM users WHERE active = 1 AND `id` = 1',
    },
    {
      name: 'a parenthesized condition',
      sql: 'SELECT * FROM users WHERE (?)',
      expected: 'SELECT * FROM users WHERE (`id` = 1)',
    },
    {
      name: 'a JOIN condition',
      sql: 'SELECT * FROM users JOIN posts ON ?',
      expected: 'SELECT * FROM users JOIN posts ON `id` = 1',
    },
    {
      name: 'a later statement',
      sql: 'SELECT 1; DELETE FROM users WHERE ?',
      expected: 'SELECT 1; DELETE FROM users WHERE `id` = 1',
    },
    {
      name: 'a SET clause',
      sql: 'UPDATE users SET ?',
      expected: 'UPDATE users SET `id` = 1',
    },
    {
      name: 'an ON DUPLICATE KEY UPDATE clause',
      sql: 'INSERT INTO users (id) VALUES (1) ON DUPLICATE KEY UPDATE ?',
      expected:
        'INSERT INTO users (id) VALUES (1) ON DUPLICATE KEY UPDATE `id` = 1',
    },
  ];

  for (const { name, sql, expected } of positions)
    it(`should expand a marked object bound in ${name}`, () => {
      assert.strictEqual(format(sql, [expand({ id: 1 })]), expected);
    });

  it('should expand a marked Map', () => {
    assert.strictEqual(
      format('SELECT * FROM users WHERE ?', [expand(new Map([['id', 1]]))]),
      'SELECT * FROM users WHERE `id` = 1'
    );
  });

  it('should expand only the marked value and keep every other object inert', () => {
    assert.strictEqual(
      format('UPDATE t SET ?, updated_by = ? WHERE id = ?', [
        expand({ name: 'foo' }),
        { name: true },
        { id: true },
      ]),
      "UPDATE t SET `name` = 'foo', updated_by = '[object Object]' WHERE id = '[object Object]'"
    );
  });

  it('should expand a marked object passed directly as the values of format', () => {
    assert.strictEqual(
      format('SELECT * FROM users WHERE ?', expand({ id: 1 })),
      'SELECT * FROM users WHERE `id` = 1'
    );
  });

  it('should expand a mark passed at the top level of escape', () => {
    assert.strictEqual(escape(expand({ a: 1 })), '`a` = 1');
  });
});

describe('expand: the mark wins over stringifyObjects', () => {
  it('should expand a marked object while format stringifies every other object', () => {
    assert.strictEqual(
      format(
        'UPDATE t SET ? WHERE id = ?',
        [expand({ name: 'foo' }), { id: true }],
        true
      ),
      "UPDATE t SET `name` = 'foo' WHERE id = '[object Object]'"
    );
  });

  it('should expand a marked object when escape is told to stringify objects', () => {
    assert.strictEqual(escape(expand({ a: 1 }), true), '`a` = 1');
  });

  it('should expand a marked object when escape receives false, which stringifies an ordinary object', () => {
    assert.strictEqual(escape(expand({ a: 1 }), false), '`a` = 1');
  });
});

describe('expand: dates inside a marked object follow the timezone of the call', () => {
  const created = new Date(Date.UTC(2024, 5, 15, 12, 30, 45, 123));

  it('should render the date in the timezone given to format', () => {
    assert.strictEqual(
      format('SELECT * FROM t WHERE ?', [expand({ created })], false, '+05:00'),
      "SELECT * FROM t WHERE `created` = '2024-06-15 17:30:45.123'"
    );
  });

  it('should render the date in the timezone given to format while it stringifies objects', () => {
    assert.strictEqual(
      format('SELECT * FROM t WHERE ?', [expand({ created })], true, 'Z'),
      "SELECT * FROM t WHERE `created` = '2024-06-15 12:30:45.123'"
    );
  });

  it('should render the date in the timezone given to escape', () => {
    assert.strictEqual(
      escape(expand({ created }), true, '-03:00'),
      "`created` = '2024-06-15 09:30:45.123'"
    );
  });
});

describe('expand: marking an object never changes the text a SET clause produces', () => {
  const objects = [
    {
      name: 'a raw value',
      value: { at: raw('NOW()') },
      expected: 'UPDATE t SET `at` = NOW()',
    },
    {
      name: 'a dotted key',
      value: { 'a.b': 1 },
      expected: 'UPDATE t SET `a`.`b` = 1',
    },
    {
      name: 'a nested object',
      value: { profile: { admin: true } },
      expected: "UPDATE t SET `profile` = '[object Object]'",
    },
    {
      name: 'a function',
      value: { a: 1, b: () => {} },
      expected: 'UPDATE t SET `a` = 1',
    },
    {
      name: 'a hostile key and value',
      value: { 'a`b': "x' OR 1=1 -- " },
      expected: "UPDATE t SET `a``b` = 'x\\' OR 1=1 -- '",
    },
    {
      name: 'null and undefined',
      value: { a: null, b: undefined },
      expected: 'UPDATE t SET `a` = NULL, `b` = NULL',
    },
    {
      name: 'an array, a Set, and a Buffer',
      value: {
        ids: [1, 2],
        tags: new Set(['x']),
        data: Buffer.from([1, 2]),
      },
      expected: "UPDATE t SET `ids` = 1, 2, `tags` = 'x', `data` = X'0102'",
    },
  ];

  for (const { name, value, expected } of objects) {
    it(`should render ${name} the same whether the object is marked, limited to its own keys, or not`, () => {
      const marked = format('UPDATE t SET ?', [expand(value)]);
      const limited = format('UPDATE t SET ?', [
        expand(value, Object.keys(value)),
      ]);
      const unmarked = format('UPDATE t SET ?', [value]);

      assert.strictEqual(marked, expected);
      assert.strictEqual(limited, expected);
      assert.strictEqual(unmarked, expected);
    });
  }
});

describe('expand: nothing in a marked object reaches the output unescaped', () => {
  it('should quote a hostile key as one identifier and escape a hostile value', () => {
    assert.strictEqual(
      format('SELECT * FROM users WHERE ?', [
        expand({ 'id` = 1 OR `1': "x' OR '1'='1" }),
      ]),
      "SELECT * FROM users WHERE `id`` = 1 OR ``1` = 'x\\' OR \\'1\\'=\\'1'"
    );
  });
});

describe('expand: a mark counts only at the top level', () => {
  const mark = expand({ id: 1 });
  const nested = [
    {
      name: 'an array bound to format',
      output: () => format('SELECT * FROM t WHERE id IN (?)', [[mark]]),
      expected: "SELECT * FROM t WHERE id IN ('[object Object]')",
    },
    {
      name: 'a nested array bound to format',
      output: () => format('SELECT * FROM t WHERE (a, b) IN (?)', [[[mark]]]),
      expected: "SELECT * FROM t WHERE (a, b) IN (('[object Object]'))",
    },
    {
      name: 'a Set bound to format',
      output: () =>
        format('SELECT * FROM t WHERE id IN (?)', [new Set([mark])]),
      expected: "SELECT * FROM t WHERE id IN ('[object Object]')",
    },
    {
      name: 'an object expanded in a SET clause',
      output: () => format('UPDATE t SET ?', [{ data: mark }]),
      expected: "UPDATE t SET `data` = '[object Object]'",
    },
    {
      name: 'a Map expanded in a SET clause',
      output: () => format('UPDATE t SET ?', [new Map([['data', mark]])]),
      expected: "UPDATE t SET `data` = '[object Object]'",
    },
    {
      name: 'another marked value bound to format',
      output: () => format('SELECT * FROM t WHERE ?', [expand({ data: mark })]),
      expected: "SELECT * FROM t WHERE `data` = '[object Object]'",
    },
    {
      name: 'an array passed to escape',
      output: () => escape([mark]),
      expected: "'[object Object]'",
    },
    {
      name: 'an object passed to escape',
      output: () => escape({ data: mark }),
      expected: "`data` = '[object Object]'",
    },
    {
      name: 'another marked value passed to escape',
      output: () => escape(expand({ data: mark }), true),
      expected: "`data` = '[object Object]'",
    },
  ];

  for (const { name, output, expected } of nested)
    it(`should keep a mark nested in ${name} as one inert quoted value`, () => {
      assert.strictEqual(output(), expected);
    });

  it('should read a mark bound to an identifier placeholder as an identifier', () => {
    assert.strictEqual(
      format('SELECT ?? FROM t', [mark]),
      'SELECT `[object Object]` FROM t'
    );
  });
});

describe('expand: only the mark itself counts, never a lookalike', () => {
  const inheritedMark: Record<string, unknown> = Object.create(
    expand({ id: 1 })
  );
  const inheritedContent: Record<string, unknown> = Object.assign(
    Object.create({ value: { id: 1 } }),
    { [MARK]: true }
  );
  const lookalikes = [
    {
      name: 'the same shape without the symbol',
      value: { value: { id: 1 } },
      inSet: "UPDATE t SET `value` = '[object Object]'",
    },
    {
      name: 'the description of the symbol used as a string key',
      value: { 'sql-escaper.expand': true, value: { id: 1 } },
      inSet:
        "UPDATE t SET `sql-escaper`.`expand` = true, `value` = '[object Object]'",
    },
    {
      name: 'the symbol set to something other than true',
      value: { [MARK]: 1, value: { id: 1 } },
      inSet: "UPDATE t SET `value` = '[object Object]'",
    },
    {
      name: 'a mark around a string',
      value: { [MARK]: true, value: 'id = 1' },
      inSet: "UPDATE t SET `value` = 'id = 1'",
    },
    {
      name: 'a mark around a raw value',
      value: { [MARK]: true, value: raw('NOW()') },
      inSet: 'UPDATE t SET `value` = NOW()',
    },
    {
      name: 'a mark around an array',
      value: { [MARK]: true, value: [1, 2] },
      inSet: 'UPDATE t SET `value` = 1, 2',
    },
    {
      name: 'a mark around null',
      value: { [MARK]: true, value: null },
      inSet: 'UPDATE t SET `value` = NULL',
    },
    {
      name: 'a mark around another mark',
      value: { [MARK]: true, value: expand({ id: 1 }) },
      inSet: "UPDATE t SET `value` = '[object Object]'",
    },
  ];
  const lookalikesWithoutColumns = [
    {
      name: 'a mark inherited through the prototype chain',
      value: inheritedMark,
    },
    { name: 'a mark whose content is inherited', value: inheritedContent },
  ];

  for (const { name, value, inSet } of lookalikes) {
    it(`should handle ${name} as the ordinary object it is`, () => {
      const inWhere = format('SELECT * FROM t WHERE ?', [value]);
      const inSetClause = format('UPDATE t SET ?', [value]);
      const stringified = escape(value, true);

      assert.strictEqual(inWhere, "SELECT * FROM t WHERE '[object Object]'");
      assert.strictEqual(inSetClause, inSet);
      assert.strictEqual(stringified, "'[object Object]'");
    });
  }

  for (const { name, value } of lookalikesWithoutColumns) {
    it(`should handle ${name} as the ordinary object it is, which has no column to set`, () => {
      const inWhere = format('SELECT * FROM t WHERE ?', [value]);
      const stringified = escape(value, true);

      assert.strictEqual(inWhere, "SELECT * FROM t WHERE '[object Object]'");
      assert.strictEqual(stringified, "'[object Object]'");
      assert.throws(() => format('UPDATE t SET ?', [value]), noColumnToSet);
    });
  }

  it('should keep an object that only looks expandable inert outside SET', () => {
    assert.strictEqual(
      format('DELETE FROM entries WHERE id = ?', [{ value: { id: true } }]),
      "DELETE FROM entries WHERE id = '[object Object]'"
    );
  });
});

describe('expand: a mark made by another copy or build of the package', () => {
  it('should expand a mark built by hand in the shape expand() returns', () => {
    const mark = { [MARK]: true, value: { id: 1 } };

    assert.strictEqual(
      format('SELECT * FROM users WHERE ?', [mark]),
      'SELECT * FROM users WHERE `id` = 1'
    );
    assert.strictEqual(escape(mark, true), '`id` = 1');
  });

  it('should carry the mark as the registered symbol and the wrapped object itself', () => {
    const value = { id: 1 };
    const mark = expand(value);

    assert.deepStrictEqual(Reflect.ownKeys(mark), ['value', MARK]);
    assert.strictEqual(Reflect.get(mark, MARK), true);
    assert.strictEqual(mark.value, value);
  });

  it('should hand another copy a mark that already holds only the allowed columns', () => {
    const mark = expand({ name: 'Ana', role: 'admin' }, ['name']);
    const asAnotherCopyReadsIt = { [MARK]: true, value: mark.value };
    const statement = format('UPDATE users SET ?', [asAnotherCopyReadsIt]);

    assert.strictEqual(statement, "UPDATE users SET `name` = 'Ana'");
  });
});

describe('expand: only what a SET clause expands can be marked', () => {
  class Row {
    id = 1;
  }

  const withoutPrototype: Record<string, unknown> = Object.assign(
    Object.create(null),
    { id: 1 }
  );
  const refusal = {
    name: 'TypeError',
    message: 'argument value must be an object or a Map',
  };
  const accepted = [
    { name: 'a plain object', value: { id: 1 } },
    { name: 'a Map', value: new Map([['id', 1]]) },
    { name: 'an object without a prototype', value: withoutPrototype },
    { name: 'a class instance', value: new Row() },
  ];
  const refused = [
    { name: 'a string', value: 'id = 1' },
    { name: 'a number', value: 1 },
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
    { name: 'an array', value: [{ id: 1 }] },
    { name: 'a Set', value: new Set([1]) },
    { name: 'a Date', value: new Date(0) },
    { name: 'a Buffer', value: Buffer.from('id') },
    { name: 'a Uint8Array', value: new Uint8Array([1]) },
    { name: 'a raw value', value: raw('NOW()') },
    { name: 'a marked value', value: expand({ id: 1 }) },
    {
      name: 'an object owning the mark',
      value: { [MARK]: true, value: 'id = 1' },
    },
  ];

  for (const { name, value } of accepted) {
    it(`should mark ${name}, which a SET clause expands`, () => {
      const unmarked = format('UPDATE t SET ?', [value]);
      const marked = format('SELECT * FROM t WHERE ?', [expand(value)]);

      assert.strictEqual(unmarked, 'UPDATE t SET `id` = 1');
      assert.strictEqual(marked, 'SELECT * FROM t WHERE `id` = 1');
    });
  }

  for (const { name, value } of refused)
    it(`should refuse to mark ${name}, whatever columns it allows`, () => {
      // @ts-expect-error: testing a value expand() does not accept
      assert.throws(() => expand(value), refusal);
      // @ts-expect-error: testing a value expand() does not accept
      assert.throws(() => expand(value, ['id']), refusal);
    });
});

describe('expand: only the allowed columns of a value expand', () => {
  const inheritsRole: Record<string, unknown> = Object.assign(
    Object.create({
      get role(): string {
        throw new Error('an inherited key must never be read');
      },
    }),
    { name: 'Ana' }
  );
  const leftOut = [
    {
      name: 'a key outside the allowed columns',
      sql: 'UPDATE users SET ? WHERE id = 1',
      value: { name: 'Ana', role: 'admin', is_admin: 1 },
      columns: ['name'],
      expected: "UPDATE users SET `name` = 'Ana' WHERE id = 1",
    },
    {
      name: 'a dotted key that reaches a joined table',
      sql: 'UPDATE users u JOIN accounts a ON a.user_id = u.id SET ? WHERE u.id = 1',
      value: { name: 'Ana', 'a.balance': 9999 },
      columns: ['name'],
      expected:
        "UPDATE users u JOIN accounts a ON a.user_id = u.id SET `name` = 'Ana' WHERE u.id = 1",
    },
    {
      name: 'a filter on a column outside the allowed columns',
      sql: 'SELECT id FROM users WHERE ?',
      value: { email: 'ana@example.com', password_hash: 'x' },
      columns: ['email'],
      expected: "SELECT id FROM users WHERE `email` = 'ana@example.com'",
    },
    {
      name: 'an allowed column the value lacks',
      sql: 'UPDATE users SET ? WHERE id = 1',
      value: { name: 'Ana' },
      columns: ['name', 'email'],
      expected: "UPDATE users SET `name` = 'Ana' WHERE id = 1",
    },
    {
      name: 'an allowed key the value only inherits',
      sql: 'UPDATE users SET ? WHERE id = 1',
      value: inheritsRole,
      columns: ['name', 'role'],
      expected: "UPDATE users SET `name` = 'Ana' WHERE id = 1",
    },
    {
      name: 'a key of a Map outside the allowed columns',
      sql: 'UPDATE users SET ? WHERE id = 1',
      value: new Map([
        ['name', 'Ana'],
        ['role', 'admin'],
      ]),
      columns: ['name'],
      expected: "UPDATE users SET `name` = 'Ana' WHERE id = 1",
    },
  ];
  const withHole: string[] = [];
  const invalidColumns = [
    { name: 'a string', columns: 'name' },
    { name: 'an array holding a number', columns: [1] },
    { name: 'an array with a hole', columns: withHole },
    { name: 'null', columns: null },
    { name: 'a Set', columns: new Set(['name']) },
  ];

  withHole[1] = 'name';

  for (const { name, sql, value, columns, expected } of leftOut)
    it(`should leave ${name} out of the statement`, () => {
      assert.strictEqual(format(sql, [expand(value, columns)]), expected);
    });

  it('should leave a key outside the allowed columns out of what escape writes', () => {
    const body = { name: 'Ana', role: 'admin' };

    assert.strictEqual(escape(expand(body, ['name']), true), "`name` = 'Ana'");
  });

  it('should expand the allowed columns in the order the code lists them', () => {
    const mark = expand({ email: 'ana@example.com', name: 'Ana' }, [
      'name',
      'email',
    ]);

    assert.strictEqual(
      format('UPDATE users SET ?', [mark]),
      "UPDATE users SET `name` = 'Ana', `email` = 'ana@example.com'"
    );
  });

  it('should never read a key outside the allowed columns', () => {
    const body = {
      name: 'Ana',
      get role(): string {
        throw new Error('a key outside the allowed columns must never be read');
      },
    };
    const statement = format('UPDATE users SET ?', [expand(body, ['name'])]);

    assert.strictEqual(statement, "UPDATE users SET `name` = 'Ana'");
  });

  for (const { name, columns } of invalidColumns)
    it(`should refuse ${name} as the allowed columns`, () => {
      assert.throws(
        // @ts-expect-error: testing allowed columns that are not an array of strings
        () => expand({ name: 'Ana' }, columns),
        {
          name: 'TypeError',
          message: 'argument columns must be an array of strings',
        }
      );
    });
});

describe('expand: a mark with no column to set is refused instead of expanding to nothing', () => {
  const marks = [
    { name: 'an empty object', mark: expand({}) },
    { name: 'an empty Map', mark: expand(new Map()) },
    {
      name: 'an object holding only functions',
      mark: expand({ fn: () => {} }),
    },
    {
      name: 'a value holding none of the allowed columns',
      mark: expand({ role: 'admin' }, ['name']),
    },
    {
      name: 'a Map holding none of the allowed columns',
      mark: expand(new Map([['role', 'admin']]), ['name']),
    },
    {
      name: 'a value with no allowed column',
      mark: expand({ name: 'Ana' }, []),
    },
  ];
  const writers = [
    {
      name: 'format',
      write: (mark: Expand) =>
        format('UPDATE users SET ? WHERE id = 1', [mark]),
    },
    {
      name: 'format while it stringifies objects',
      write: (mark: Expand) =>
        format('UPDATE users SET ? WHERE id = 1', [mark], true),
    },
    { name: 'escape', write: (mark: Expand) => escape(mark) },
    {
      name: 'escape told to stringify objects',
      write: (mark: Expand) => escape(mark, true),
    },
  ];

  for (const { name, mark } of marks)
    for (const writer of writers)
      it(`should refuse ${name} written by ${writer.name}`, () => {
        assert.throws(() => writer.write(mark), noColumnToSet);
      });

  it('should expand a column the marked object gains after it was marked', () => {
    const body: Record<string, unknown> = {};
    const mark = expand(body);

    body.name = 'Ana';

    const statement = format('UPDATE users SET ?', [mark]);

    assert.strictEqual(statement, "UPDATE users SET `name` = 'Ana'");
  });
});
