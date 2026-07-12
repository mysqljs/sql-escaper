# SQL Escaper Security Charter

## Principles

### I. Every value is escaped before it becomes SQL

Never place a caller-supplied value into a SQL string without first passing it through this library's value-escaping routines. Every value type the library accepts (strings, numbers, bigints, booleans, dates, buffers, byte arrays, arrays, and sets) MUST be handled by a dedicated escaper, and any new type MUST get one before it is allowed through. The fallback for an unrecognized value MUST be to escape it as a quoted string, never to emit it as-is. A value that reaches the output unescaped is a bug of the highest severity.

- Why: this library exists to be the safe boundary between untrusted data and a database. If even one value slips through unescaped, an attacker can break out of the intended value and rewrite the query, which is exactly the SQL injection the whole project is meant to stop.

### II. Identifiers are quoted so a name can never break out or silently reach another table

Always wrap an identifier (a database, table, or column name) in backticks, and double any backtick inside it, so a caller-supplied name cannot close the quoting and inject SQL. When the caller asks for a single whole name, a dot inside that name MUST be treated as part of the name, never as a separator that reaches into another table or schema.

- Why: identifiers flow in through `??` placeholders and through the keys of expanded objects, and they are quoted with backticks rather than the quotes used for values. A name that escapes its backticks injects SQL just as a broken-out value would, and an unintended dot can silently redirect a query to data the caller was never meant to touch.

### III. Objects expand into SQL only inside a SET assignment, and fail closed everywhere else

Always stringify a plain object or Map to a single quoted value (`'[object Object]'`, `'[object Map]'`) whenever it is used anywhere other than a `SET` or `ON DUPLICATE KEY UPDATE` assignment list. Never expand a caller-supplied object into `` `key` = value `` fragments in any other position, regardless of the `stringifyObjects` setting. When the library cannot be certain a placeholder sits inside a SET assignment list, it MUST stringify the object rather than expand it.

- Why: this is the exact flaw the project was created to fix. When an object passed as an ordinary parameter is expanded into column-and-value fragments, an attacker who controls that object controls part of the query structure, turning `WHERE password = ?` into an authentication bypass. Expansion is safe only where the query author clearly asked for it, so any doubt about the position MUST resolve to the safe, stringified form.

### IV. `raw()` and `toSqlString` are an unescaped trapdoor that MUST stay narrow

Never widen what bypasses escaping. A value from `raw()`, or any object exposing a `toSqlString` method, is emitted verbatim with no escaping, so it MUST only ever carry query text the developer wrote, never data that originated from a user. Any change that lets more input reach the output unescaped MUST be treated as a security change, not a convenience.

- Why: `raw()` is a deliberate escape hatch for trusted SQL fragments like `NOW()`. If untrusted input can reach it, or if the set of values treated as raw quietly grows, the library's core protection is silently switched off for that value and injection returns.

### V. Escaping behavior only changes on purpose, proven by tests

Never alter how any value is escaped, how an identifier is quoted, or when an object expands without a test that pins the new behavior and keeps the existing regression tests green. Always treat a change to escaping, quoting, or object-expansion logic as a security change, not a refactor. The behavior parity that makes this a safe drop-in replacement for sqlstring MUST be preserved unless a deviation is deliberate and documented.

- Why: this code is a security primitive that database drivers depend on by default. A quiet change to the escaping rules, even one that looks like a harmless cleanup, can reopen an injection path that no one notices until it is exploited. Tests are what tell a safe change from a dangerous one.

### VI. No runtime dependencies

Never add a runtime dependency to this package. The library MUST ship as self-contained code with only development tooling as dependencies. A runtime dependency is added only if it is genuinely unavoidable and reviewed as attack surface first.

- Why: this package is installed beneath MySQL drivers in countless applications, so anything it pulls in at runtime inherits that reach. A single compromised or malicious dependency would sit directly in the query path of every consumer, which is the worst possible place for supply-chain risk.

## Baseline discipline

Lagune holds this charter, every principle, every time. A principle is not suspended because a control looks small, familiar, or unlikely to be hit. This is not a judgement call.

### Only the controls the project needs

Lagune recommends and applies only the controls this project's context calls for. A control the project does not need is never added for completeness, and a generic checklist is not thoroughness. Every later phase acts on what the system actually does, never on what it might hypothetically do.

- Why: effort spent on risks the project does not have buries the risks it does have. Fewer, right-sized controls are easier to apply, prove, and keep true than a checklist no one finishes.

### Prefer the simplest vetted control

When a control is needed, reach for the safest option already proven, in order: a control this project already has, then a platform or framework built-in, then a well-maintained vetted library, and only then custom code. Never hand-roll a security primitive (cryptography, escaping, authentication, sessions) that a vetted standard already provides. A new dependency is new attack surface, justified and not assumed. Code, an endpoint, or a feature the project does not use is attack surface too, so removing it is itself a control.

- Why: hand-rolled security is where subtle, unaudited bugs live, and a second control duplicating an existing one is the one that gets forgotten and drifts. Boring, standard controls are easier to audit and harder to get wrong, and less surface is less to defend.

### When a control seems skippable

A control is held even when a reason to skip it feels reasonable:

- "Too small to need a control": small gaps are where breaches start.
- "Already handled elsewhere": assumed coverage is exactly how gaps hide.
- "Unlikely to be hit": attackers target the path no one is watching.
- "It works, ship it": working and safe are different claims, and the charter requires both.

## Governance

This charter supersedes ad hoc decisions about how values are escaped, how identifiers are quoted, or how objects are expanded. Because this library is itself a security primitive, that logic is its security-critical core: changes there are reviewed against these principles and backed by the regression test suite, the coverage checks, and the CodeQL analysis already in CI. Vulnerabilities are handled through the process in SECURITY.md. Amendments to this charter are made by pull request with a version bump, and the reasoning is recorded in the change.

Version: 1.1.0 | Ratified: 2026-07-07
