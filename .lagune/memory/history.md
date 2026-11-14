# Lagune History

## Closed findings

### Double-quoted strings and hash comments scanned as SQL code

- **Classification:** Critical
- **Category:** SQL injection (CWE-89) through improper encoding for the output context (CWE-116)
- **What it is:** When `format()` looks for `?` and `??` placeholders and for `SET` or `ON DUPLICATE KEY UPDATE` clauses, it skips the text MySQL never runs as code (single-quoted strings, backtick identifiers, `--` and `/* */` comments), but it does not recognize double-quoted strings or `#` comments, so it reads their content as if it were code.
- **Closed:** 2026-11-14

### Double-quoted identifiers read with string rules under ANSI_QUOTES

- **Classification:** Critical
- **Category:** SQL injection (CWE-89) through an interpretation conflict with the server's SQL mode (CWE-436)
- **What it is:** The query scanner reads double-quoted text as a string, where a backslash escapes the next character. Under the `ANSI_QUOTES` SQL mode, MySQL reads double quotes as identifier quotes, where a backslash is an ordinary character and only a doubled quote escapes one. The values and identifiers the library writes are not affected, since it always uses single quotes for values and backticks for identifiers.
- **Closed:** 2026-11-14
