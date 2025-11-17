# Pre-commit Secret Scanning Setup

This project uses `pre-commit` with `detect-secrets` to scan for secrets before commits.

## Installation

1. Install `pre-commit`:
   ```bash
   pip install pre-commit
   ```
   Or using Homebrew on macOS:
   ```bash
   brew install pre-commit
   ```

2. Install the git hooks:
   ```bash
   npm run pre-commit:install
   ```
   Or directly:
   ```bash
   pre-commit install
   ```

## Initial Setup

1. Generate the secrets baseline (if not already created):
   ```bash
   detect-secrets scan --baseline .secrets.baseline
   ```

2. Review any detected secrets:
   ```bash
   npm run secrets:audit
   ```

3. Commit the baseline file:
   ```bash
   git add .secrets.baseline
   git commit -m "Add secrets baseline"
   ```

## Usage

The pre-commit hook will automatically run on every commit. If it detects potential secrets, the commit will be blocked.

To manually run the secret scanner:
```bash
npm run secrets:scan
```

To audit the baseline (review known secrets):
```bash
npm run secrets:audit
```

## Updating Pre-commit Hooks

To update to the latest versions of the hooks:
```bash
npm run pre-commit:update
```

## How It Works

- The `.secrets.baseline` file tracks known secrets (test data, example values, etc.)
- New secrets detected in commits will block the commit
- Review and update the baseline when legitimate secrets are detected
- The baseline file should be committed to the repository

