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

### SQL mode does not reach toSqlString values

- **Classification:** Critical
- **Category:** SQL injection (CWE-89) through an escaping rule that does not match the output context (CWE-838)
- **What it is:** A value with a `toSqlString()` method (from `raw()` or a custom object, such as a subquery built with `format`) is written into the SQL exactly as it returns it. The method is called with no arguments, so the SQL mode the outer `escape` or `format` call received never reaches any escaping done inside it. The caller must repeat the mode by hand in every nested call.
- **Closed:** 2026-11-16

### Explicit object expansion into column assignments

- **Classification:** Medium
- **Category:** Mass assignment through caller-chosen column names (CWE-915)
- **What it is:** `expand()` marks an object or a `Map` so that it becomes `` `key` = value `` pairs at any `?` placeholder of `format` and at the top level of `escape`, whatever `stringifyObjects` says. `objectToValues()` writes the same pairs directly. Every own enumerable key of an object (every key of a `Map`, turned into a string) becomes a quoted identifier, and only keys whose value is a function are left out. A key with a dot becomes a qualified name split at each dot, so `a.balance` names the `balance` column of whatever table the statement calls `a`. Neither function takes the columns the code allows: a warning in the README is the only control. The mark holds the caller's object itself, and its keys are read only when the statement is written, so a key added after marking still expands. Every installed copy and build of the library honors a mark through the global symbol registry, and each copy checks only the symbol, an own `value`, and that the value can be marked, ignoring any other property the mark carries.
- **Closed:** 2026-11-17

### Default object expansion into column assignments

- **Classification:** Critical
- **Category:** SQL injection (CWE-89) through an object expanded where a value was expected, and mass assignment (CWE-915) through caller-chosen column names in assignment lists
- **What it is:** Without a mark, an object or a `Map` still expands into `` `key` = value `` pairs by default, a behavior kept from **sqlstring**. In `format`, an object bound to a placeholder inside a `SET` or `ON DUPLICATE KEY UPDATE` assignment list expands while `stringifyObjects` is unset or `false`, and only a truthy value turns it into an inert quoted string. In `escape`, which never sees the query around its output, an object expands wherever that output lands while `stringifyObjects` is unset, and any other value, `false` included, turns it into an inert quoted string. Neither path has anywhere to pass the columns the code allows.
- **Closed:** 2026-11-17

### String escaping that is safe in only one SQL mode

- **Classification:** Critical
- **Category:** SQL injection (CWE-89) through escaping written for a different SQL mode than the session's (CWE-116)
- **What it is:** Every text value, including a date, a Temporal value, or an object written as its string form, becomes a quoted literal in one of two forms, chosen by the caller's `noBackslashEscapes` flag. The default form puts a backslash before a quote, a backslash, a double quote, and a few control characters, so only a session that honors backslashes reads it as written. The `noBackslashEscapes` form doubles quotes and writes a value holding a backslash as its UTF-8 bytes in hexadecimal with a `utf8mb4` introducer, and `format` under it rejects a query string whose quote follows an odd run of backslashes, so both modes read the characters it writes the same way. The library cannot check that the flag matches the mode the server session is really in.
- **Closed:** 2026-11-18
