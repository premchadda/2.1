# Node Version

This project requires Node.js 18.20.0 (see .nvmrc).

# Contributing to Trstprep V2.1

## Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Lint your code: `npm run lint`
6. Commit with semantic messages: `git commit -m "feat: add new feature"`
7. Push and create a Pull Request

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Maintenance tasks

Example: `feat: add live test leaderboard integration`

## Code Style

- Use 2-space indentation
- Use camelCase for variables and functions
- Use PascalCase for components and classes
- Use kebab-case for file names (components use PascalCase)
- Keep lines under 100 characters

## Directory Structure

```
apps/
  frontend/    # Student-facing React application
  backend/     # Node.js/Express API server
  admin-panel/ # Admin dashboard React application
packages/
  shared-config/ # Shared configuration
docs/          # Documentation
dev-tools/     # Development scripts
```

## Running the Project

```bash
# Install Node dependencies (recommended: pnpm)
pnpm install

# Setup Python AI environment
uv venv
uv pip install -e .

# Start development servers
pnpm dev

# Build for production
pnpm run build

# Run tests
pnpm test
```

## Pull Request Checklist

- [ ] Tests pass locally
- [ ] Linting passes
- [ ] Code follows project conventions
- [ ] Documentation updated if needed
- [ ] Changes tested manually
- [ ] No console.log statements left in production code
