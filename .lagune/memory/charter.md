# SQL Escaper Security Charter

## Principles

### I. Every value is escaped before it becomes SQL

Never place a caller-supplied value into SQL without escaping it first. Every kind of value the library accepts MUST have its own escaping rule before it is allowed through, and a value the library does not recognize MUST be escaped as a quoted string, never emitted as it is.

- Why: this library is the boundary between untrusted data and the database. A single value that slips through unescaped lets an attacker break out of it and rewrite the query, which is the SQL injection the project exists to stop.

### II. Identifiers are quoted so a name can never break out or silently reach another table

Always quote an identifier (a database, table, or column name) so a caller-supplied name cannot close its quoting and inject SQL. When the caller asks for a single whole name, a dot inside it MUST stay part of the name, never a separator that reaches another table or schema.

- Why: a name that breaks out of its quoting injects SQL just as a broken-out value does, and an unintended dot can silently point a query at data the caller was never meant to touch.

### III. Raw SQL is an unescaped trapdoor that MUST stay narrow

Never widen what bypasses escaping. A value the developer declares as raw SQL is emitted verbatim, so it MUST only ever carry query text the developer wrote, never data that originated from a user. Any change that lets more input reach the output unescaped MUST be treated as a security change.

- Why: the trapdoor exists for trusted fragments such as `NOW()`. If untrusted input reaches it, or the set of values treated as raw quietly grows, escaping is silently switched off for that value and injection returns.

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

- This charter guides every security decision in each Lagune phase, and every change to it is reviewed and approved by the maintainer.
- It holds only what a deterministic check cannot capture, so it never repeats a control that linters or automated tools already enforce.

Version: 3.0.0 | Ratified: 2026-07-07
