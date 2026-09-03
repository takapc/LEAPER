# LEAPER release rules

- Treat the `version` in `package.json` as the single source of truth and keep `package-lock.json` synchronized.
- Display the current version in the application footer as `LEAPER verX.Y.Z`.
- Follow semantic versioning:
  - PATCH (`X.Y.Z`): backward-compatible bug fixes and small corrections.
  - MINOR (`X.Y.0`): backward-compatible features and meaningful UI improvements.
  - MAJOR (`X.0.0`): breaking changes, major redesigns, or incompatible data changes.
- Increment the appropriate version before every product update commit.
- Begin every product update commit subject with `verX.Y.Z: ` using the new version.
