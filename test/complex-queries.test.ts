import type { SqlValue } from '../src/index.ts';
import { assert, describe, it } from 'poku';
import { format as _format } from '../src/index.ts';

const format = (sql: string, values?: SqlValue) => _format(sql, values, false);

describe('Multiline SELECT', () => {
  it('should handle string parameters in a multiline query', () => {
    const query = format(
      `SELECT *
       FROM users
       WHERE email = ?
         AND active = ?`,
      ['admin@example.com', true]
    );

    assert.strictEqual(
      query,
      `SELECT *
       FROM users
       WHERE email = 'admin@example.com'
         AND active = true`
    );
  });

  it('should not generate a SQL fragment for object { email: 1 } in multiline query', () => {
    const query = format(
      `SELECT *
       FROM users
       WHERE email = ?`,
      [{ email: 1 }]
    );

    assert.strictEqual(
      query,
      `SELECT *
       FROM users
       WHERE email = '[object Object]'`
    );
  });
});

describe('Multiline UPDATE with SET', () => {
  it('should convert object to key-value pairs in multiline UPDATE', () => {
    const query = format(
      `UPDATE users
       SET ?
       WHERE id = ?`,
      [{ name: 'foo', email: 'bar@test.com' }, 1]
    );

    assert.strictEqual(
      query,
      `UPDATE users
       SET \`name\` = 'foo', \`email\` = 'bar@test.com'
       WHERE id = 1`
    );
  });
});

describe('SELECT with SET inside a single-line comment', () => {
  it('should not generate a SQL fragment for object { email: 1 }', () => {
    const query = format(
      `SELECT * FROM users -- TODO: SET config later
       WHERE email = ?`,
      [{ email: 1 }]
    );

    assert.strictEqual(
      query,
      `SELECT * FROM users -- TODO: SET config later
       WHERE email = '[object Object]'`
    );
  });
});

describe('SELECT with SET inside a block comment', () => {
  it('should not generate a SQL fragment for object { email: 1 }', () => {
    const query = format(
      `/* SET placeholder for future use */
       SELECT * FROM users WHERE email = ?`,
      [{ email: 1 }]
    );

    assert.strictEqual(
      query,
      `/* SET placeholder for future use */
       SELECT * FROM users WHERE email = '[object Object]'`
    );
  });
});

describe('SELECT with SET inside a string literal', () => {
  it('should not generate a SQL fragment for object { user_id: 1 }', () => {
    const query = format(
      `SELECT * FROM logs WHERE message = 'SET value' AND user_id = ?`,
      [{ user_id: 1 }]
    );

    assert.strictEqual(
      query,
      "SELECT * FROM logs WHERE message = 'SET value' AND user_id = '[object Object]'"
    );
  });
});

describe('SELECT with KEY UPDATE inside a block comment', () => {
  it('should not generate a SQL fragment for object { id: 42 }', () => {
    const query = format(
      `/* KEY UPDATE logic pending */
       SELECT * FROM users WHERE id = ?`,
      [{ id: 42 }]
    );

    assert.strictEqual(
      query,
      `/* KEY UPDATE logic pending */
       SELECT * FROM users WHERE id = '[object Object]'`
    );
  });
});

describe('Queries with SET-like words', () => {
  it('should not match OFFSET as SET', () => {
    const query = format(
      'SELECT * FROM items LIMIT 10 OFFSET ? WHERE category = ?',
      [5, { category: 'books' }]
    );

    assert.strictEqual(
      query,
      "SELECT * FROM items LIMIT 10 OFFSET 5 WHERE category = '[object Object]'"
    );
  });

  it('should not match CHARSET as SET', () => {
    const query = format(
      "SELECT * FROM pages WHERE CHARSET = 'utf8' AND meta = ?",
      [{ key: 'value' }]
    );

    assert.strictEqual(
      query,
      "SELECT * FROM pages WHERE CHARSET = 'utf8' AND meta = '[object Object]'"
    );
  });
});

describe('Placeholder ? inside SQL comments', () => {
  it('should not consume ? inside a single-line comment as a placeholder', () => {
    const query = format(
      `SELECT * FROM users -- is this ok?
       WHERE id = ?`,
      [1]
    );

    assert.strictEqual(
      query,
      `SELECT * FROM users -- is this ok?
       WHERE id = 1`
    );
  });

  it('should not consume ? inside a block comment as a placeholder', () => {
    const query = format(
      `SELECT * FROM users /* TODO: why? */
       WHERE id = ?`,
      [1]
    );

    assert.strictEqual(
      query,
      `SELECT * FROM users /* TODO: why? */
       WHERE id = 1`
    );
  });
});

describe('?? (escapeId) in multiline queries', () => {
  it('should escape identifier in a multiline query', () => {
    const query = format(
      `SELECT ??
       FROM users
       WHERE ?? = ?`,
      ['name', 'email', 'test@example.com']
    );

    assert.strictEqual(
      query,
      `SELECT \`name\`
       FROM users
       WHERE \`email\` = 'test@example.com'`
    );
  });
});

describe('Subqueries with placeholders', () => {
  it('should handle placeholders in a nested subquery', () => {
    const query = format(
      `SELECT * FROM users
       WHERE id IN (SELECT user_id FROM orders WHERE total > ?)
         AND status = ?`,
      [100, 'active']
    );

    assert.strictEqual(
      query,
      `SELECT * FROM users
       WHERE id IN (SELECT user_id FROM orders WHERE total > 100)
         AND status = 'active'`
    );
  });
});

describe('UPDATE with SET and surrounding comments', () => {
  it('should convert object to key-value pairs even with comments around SET', () => {
    const query = format(
      `-- Update user profile
       UPDATE users
       SET ? /* apply changes */
       WHERE id = ?`,
      [{ name: 'foo', active: true }, 1]
    );

    assert.strictEqual(
      query,
      `-- Update user profile
       UPDATE users
       SET \`name\` = 'foo', \`active\` = true /* apply changes */
       WHERE id = 1`
    );
  });
});
