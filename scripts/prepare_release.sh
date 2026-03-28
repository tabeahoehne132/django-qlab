#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: ./scripts/prepare_release.sh <version>"
  echo "Example: ./scripts/prepare_release.sh 0.3.0"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to build the bundled frontend UI."
  exit 1
fi

if ! python - <<'PY' >/dev/null 2>&1
import build  # noqa: F401
import twine  # noqa: F401
PY
then
  echo "Python release tools are missing. Install dev dependencies first:"
  echo "  pip install -e '.[dev]'"
  exit 1
fi

cd "$ROOT_DIR"

PROJECT_VERSION="$(python - <<'PY'
from pathlib import Path
import re

text = Path("pyproject.toml").read_text()
match = re.search(r'^version = "([^"]+)"$', text, re.MULTILINE)
print(match.group(1) if match else "")
PY
)"

if [[ "$PROJECT_VERSION" != "$VERSION" ]]; then
  echo "Version mismatch:"
  echo "  requested: $VERSION"
  echo "  pyproject: $PROJECT_VERSION"
  echo
  echo "Update pyproject.toml and setup.py first."
  exit 1
fi

echo "==> Running pre-commit checks"
pre-commit run --all-files

echo
echo "==> Type-checking frontend"
npm --prefix frontend run typecheck

echo
echo "==> Building packaged frontend"
./scripts/build_package_ui.sh

echo
echo "==> Building Python distribution"
rm -rf dist/
python -m build

echo
echo "==> Verifying distribution metadata"
python -m twine check dist/*

echo
echo "Release artifacts are ready in dist/ for version $VERSION"
echo "Next steps:"
echo "  1. Review git diff"
echo "  2. Commit the versioned release state"
echo "  3. Tag it: git tag v$VERSION"
echo "  4. Push branch + tag to GitHub"
echo "  5. Publish to PyPI with ./scripts/publish_pypi.sh"
