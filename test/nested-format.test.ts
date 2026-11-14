import { assert, describe, it } from 'poku';
import { format } from '../src/index.ts';

describe('Nested format: each call finds its own SET clause', () => {
  it('should keep expanding the outer SET list after a value formats a statement without SET', () => {
    const subquery = {
      toSqlString: () =>
        format('SELECT ? FROM s WHERE k IN ?', ['x', { c: 3 }]),
    };

    assert.strictEqual(
      format('UPDATE t SET ?, note = (?), ?', [{ a: 1 }, subquery, { b: 2 }]),
      "UPDATE t SET `a` = 1, note = (SELECT 'x' FROM s WHERE k IN '[object Object]'), `b` = 2"
    );
  });

  it('should keep an outer object inert after a value formats a statement with SET', () => {
    const assignment = {
      toSqlString: () => format('UPDATE u SET ?', [{ c: 3 }]),
    };

    assert.strictEqual(
      format('SELECT (?), ?', [assignment, { id: true }]),
      "SELECT (UPDATE u SET `c` = 3), '[object Object]'"
    );
  });
});
