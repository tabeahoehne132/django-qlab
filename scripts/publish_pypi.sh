#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-pypi}"

cd "$ROOT_DIR"

if ! python - <<'PY' >/dev/null 2>&1
import twine  # noqa: F401
PY
then
  echo "twine is required. Install dev dependencies first:"
  echo "  pip install -e '.[dev]'"
  exit 1
fi

if ! ls dist/* >/dev/null 2>&1; then
  echo "No build artifacts found in dist/."
  echo "Run ./scripts/prepare_release.sh <version> first."
  exit 1
fi

case "$TARGET" in
  pypi)
    echo "Uploading to PyPI..."
    python -m twine upload dist/*
    ;;
  testpypi)
    echo "Uploading to TestPyPI..."
    python -m twine upload --repository testpypi dist/*
    ;;
  *)
    echo "Unknown target '$TARGET'. Use 'pypi' or 'testpypi'."
    exit 1
    ;;
esac
