import SqlString from 'sqlstring';
import { cases } from './cases.js';

const { sql, values } = cases[Number(process.env.CASE)];

for (let i = 0; i < 10_000; i++) SqlString.format(sql, values, false);
