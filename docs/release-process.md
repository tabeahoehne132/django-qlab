# Release Process

This repository ships a packaged Django app and a bundled React UI. Consumers
should install a finished Python package, not build the frontend themselves.

## Recommended order

1. Finish code changes on a release branch.
2. Bump the package version in:
   - `pyproject.toml`
   - `setup.py`
3. Run:

   ```bash
   ./scripts/prepare_release.sh <version>
   ```

4. Review the generated diff and `dist/` artifacts.
5. Commit the release state.
6. Create and push a Git tag:

   ```bash
   git tag v<version>
   git push origin <branch>
   git push origin v<version>
   ```

7. Create the GitHub release from that tag.
8. Publish to PyPI:

   ```bash
   ./scripts/publish_pypi.sh
   ```

## Versioning

`django-qlab` is still pre-1.0, but it should still follow a predictable
versioning policy:

- `0.x.y` patch:
  - bug fixes
  - small UI fixes
  - packaging fixes
  - no meaningful API changes
- `0.x+1.0` minor:
  - new frontend tabs or features
  - new API endpoints
  - changed metadata behavior
  - schema or behavior changes consumers may notice

For the current branch, `0.3.0` is a reasonable next release because the
package now includes a much larger packaged frontend and new persistence/API
surface.

## What to check before tagging

- `pre-commit run --all-files`
- `npm --prefix frontend run typecheck`
- packaged assets updated in `qlab/static/qlab/`
- `python -m build`
- `python -m twine check dist/*`
- install test in a clean consumer project if possible

## GitHub release notes

Use GitHub release notes for:

- user-facing summary
- install/update notes
- highlights
- breaking changes or migration notes

Use PyPI mainly as the package distribution target. The richer release notes
should live on GitHub.
