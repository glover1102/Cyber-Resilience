# Contributing to Cyber Resilience Demo Platform

Thank you for your interest in contributing! 🛡️

---

## How to Report Issues

1. Search [existing issues](https://github.com/glover1102/Cyber-Resilience/issues) before opening a new one.
2. Use the appropriate issue template if available.
3. Include:
   - Operating system and version
   - Python / Node.js version (`python3 --version`, `node --version`)
   - Steps to reproduce
   - Expected vs actual behaviour
   - Relevant logs or error messages

---

## How to Submit Pull Requests

1. Fork the repository and create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes (see code style guidelines below).
3. Test your changes thoroughly.
4. Commit with a clear message:
   ```bash
   git commit -m "feat: add X to Y"
   ```
5. Push and open a pull request against `main`.
6. Fill in the PR description: what changed, why, and how to test it.

---

## Code Style Guidelines

### Python

- Follow [PEP 8](https://pep8.org/) conventions.
- Use type hints where practical.
- Docstrings for all public functions and modules.
- Maximum line length: 100 characters.
- Format with `black` (optional but appreciated).

### JavaScript / Node.js

- Use `'use strict'` at the top of Node.js files.
- Use `const` and `let`, never `var`.
- 4-space indentation.
- Single quotes for strings.
- Add JSDoc comments for public functions.

### Shell Scripts

- Use `#!/usr/bin/env bash` shebang.
- `set -euo pipefail` for safety.
- Add comments explaining non-obvious logic.
- Prefer `[[ ]]` over `[ ]` for conditionals in bash.

### HTML / CSS

- 4-space indentation.
- Semantic HTML5 elements.
- CSS custom properties (variables) for colours and spacing.
- Mobile-first responsive design.

---

## Testing Requirements

Before submitting a PR, please verify:

- [ ] The API server starts without errors: `cd railway/api && npm start`
- [ ] The dashboard loads at `http://localhost:3000`
- [ ] All six status cards display correctly
- [ ] The attack simulation phases work end-to-end
- [ ] The metrics forwarder connects and sends metrics
- [ ] The requirements checker passes: `bash local/scripts/check_requirements.sh`
- [ ] The API test script passes: `bash scripts/test_api.sh http://localhost:3000`

---

## Documentation Standards

- Use Markdown for all documentation files.
- Keep a consistent heading hierarchy (`#`, `##`, `###`).
- Include a Table of Contents for documents longer than 3 sections.
- Update relevant docs when changing functionality.
- Use code blocks with language identifiers (` ```bash `, ` ```js `, etc.).

---

## Security

- Do **not** commit secrets, passwords, API keys, or `.env` files.
- Do **not** introduce real malware or attack capabilities — this is an educational project.
- If you discover a security issue, please report it privately via a GitHub Security Advisory rather than opening a public issue.

---

## Code of Conduct

Be respectful, constructive, and professional. Harassment or abusive behaviour will not be tolerated.

---

Thank you for helping make this platform better! 🎉
