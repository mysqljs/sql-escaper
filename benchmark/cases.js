const mixed = (i) => [i + 1, `str${i}`, null, new Date(2025, 0, i + 1)][i % 4];

const mixedObject = (length) =>
  Object.fromEntries(Array.from({ length }, (_, i) => [`field${i}`, mixed(i)]));

export const cases = [
  {
    label: 'Select 100 values',
    sql: `SELECT * FROM users WHERE id IN (${Array(100).fill('?').join(',')})`,
    values: Array.from({ length: 100 }, (_, i) => mixed(i)),
  },
  {
    label: 'Insert 100 values',
    sql: `INSERT INTO t (${Array.from({ length: 100 }, (_, i) => String.fromCharCode(97 + (i % 26)) + Math.floor(i / 26)).join(',')}) VALUES (${Array(100).fill('?').join(',')})`,
    values: Array.from({ length: 100 }, (_, i) => mixed(i)),
  },
  {
    label: 'Insert 100 strings requiring escape',
    sql: `INSERT INTO t VALUES (${Array(100).fill('?').join(',')})`,
    values: Array.from({ length: 100 }, (_, i) => `it's row "${i}"\n\\path`),
  },
  {
    label: 'Insert 100 dates',
    sql: `INSERT INTO t VALUES (${Array(100).fill('?').join(',')})`,
    values: Array.from(
      { length: 100 },
      (_, i) => new Date(2025, i % 12, (i % 27) + 1, i % 24, i % 60, i % 60)
    ),
  },
  {
    label: 'SET with 100 values',
    sql: `UPDATE users SET ${Array.from({ length: 100 }, (_, i) => `field${i} = ?`).join(',')} WHERE id = ?`,
    values: [...Array.from({ length: 100 }, (_, i) => mixed(i)), 1],
  },
  {
    label: 'SET with 100 objects',
    sql: 'UPDATE users SET ? WHERE id = ?',
    values: [mixedObject(100), 1],
  },
  {
    label: 'ON DUPLICATE KEY UPDATE with 100 values',
    sql: `INSERT INTO users (${Array.from({ length: 100 }, (_, i) => `field${i}`).join(',')}) VALUES (${Array(100).fill('?').join(',')}) ON DUPLICATE KEY UPDATE ${Array.from({ length: 100 }, (_, i) => `field${i} = ?`).join(',')}`,
    values: [
      ...Array.from({ length: 100 }, (_, i) => mixed(i)),
      ...Array.from({ length: 100 }, (_, i) => mixed(i)),
    ],
  },
  {
    label: 'ON DUPLICATE KEY UPDATE with 100 objects',
    sql: `INSERT INTO users (${Array.from({ length: 100 }, (_, i) => `field${i}`).join(',')}) VALUES (${Array(100).fill('?').join(',')}) ON DUPLICATE KEY UPDATE ?`,
    values: [
      ...Array.from({ length: 100 }, (_, i) => mixed(i)),
      mixedObject(100),
    ],
  },
  {
    label: 'Multi-statement SET with 100 objects',
    sql: 'SET @locale = ?; UPDATE users SET ? WHERE id = ?',
    values: ['en', mixedObject(100), 1],
  },
];
