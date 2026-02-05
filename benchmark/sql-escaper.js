import { format } from '../lib/index.mjs';
import { cases } from './cases.js';

const { sql, values } = cases[Number(process.env.CASE)];

for (let i = 0; i < 15_000; i++) format(sql, values, false);
