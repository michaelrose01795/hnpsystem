# UK English Standard

This repository uses UK English spelling for user-facing text, documentation, and schema labels.

## Required conventions

- Use `authorise`, `authorised`, `authorisation`
- Use `colour`
- Use `catalogue`
- Use `organisation`
- Use `behaviour`
- Use `centre`

## Enforcement

- Run `npm run uk:check` to detect non-UK spellings in natural-language files.
- Run `npm run uk:check:all` for a deeper scan across code files as well.
- Run `npm run uk:fix` to auto-fix safe text files (`.md`, `.txt`, `.sql`, `.yml`, `.yaml`).

## Notes

- Auto-fix does not rewrite application code tokens to avoid breaking identifiers.
- For code and API fields, update names deliberately in migrations and code refactors.
