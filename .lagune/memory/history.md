# Lagune History

## Closed findings

### Double-quoted strings and hash comments scanned as SQL code

- **Classification:** Critical
- **Category:** SQL injection (CWE-89) through improper encoding for the output context (CWE-116)
- **What it is:** When `format()` looks for `?` and `??` placeholders and for `SET` or `ON DUPLICATE KEY UPDATE` clauses, it skips the text MySQL never runs as code (single-quoted strings, backtick identifiers, `--` and `/* */` comments), but it does not recognize double-quoted strings or `#` comments, so it reads their content as if it were code.
- **Closed:** 2026-11-14
