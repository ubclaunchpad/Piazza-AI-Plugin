# Contributing to Piazza-AI-Plugin

Thank you for your interest in contributing to our project! We welcome contributions from all team members.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Python (3.11 or higher)
- Git
- Supabase CLI

## 🔄 Development Workflow

### Branch Naming Convention

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Adding or updating tests

### Commit Message Format

We follow the Conventional Commits specification:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Example: `feat(extension): add content script for Piazza integration`

### Pull Request Process

1. **Create a branch** from `main` following our naming convention
2. **Make your changes** with clear, atomic commits
3. **Write/update tests** for your changes
4. **Update documentation** if needed
5. **Create a pull request** using our template
6. **Request review** from at least one team lead
7. **Address feedback** and make necessary changes
8. **Merge** once approved (squash and merge preferred)

## 👥 Team Structure & Reviews

### Review Requirements

- **Features & Major Changes**: Require 1 approval
- **Bug Fixes**: Require 1 approval
- **Documentation**: Require 1 approval

## 🧪 Testing Guidelines

### Backend Testing

- Write unit tests for all new functions
- Integration tests for API endpoints
- Minimum 80% code coverage
- Run `pytest` before submitting PR

### Frontend Testing

- Unit tests for utility functions
- Integration tests for components
- E2E tests for critical user flows
- Run `npm test` before submitting PR

## 📝 Code Standards

### Python (Backend)

- Follow PEP 8 style guide
- Use type hints
- Document functions with docstrings
- Use `black` for formatting
- Use `flake8` for linting

### JavaScript/TypeScript (Extension)

- Follow ESLint configuration
- Use Prettier for formatting
- Prefer TypeScript for new code
- Document complex functions

### General

- Keep functions small and focused
- Use meaningful variable and function names
- Comment complex logic
- Remove unused imports and variables

## 🐛 Bug Reports

Use the bug report template and include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Screenshots if applicable

## ✨ Feature Requests

Use the feature request template and include:

- Problem description
- Proposed solution
- Alternative approaches considered
- Priority level

## 🚫 What NOT to Commit

- Environment files (`.env`, `.env.local`)
- IDE-specific files
- Build artifacts
- Sensitive data (API keys, passwords)
- Large binary files
- Generated files

## 📞 Getting Help

- **Technical Questions**: Ask in our team Slack channel
- **Code Reviews**: Tag team leads in PR comments
- **Design Questions**: Tag designers for UI/UX feedback
- **Architecture Decisions**: Discuss with team leads first

## 📊 Project Metrics

We track:

- Code coverage (aim for 80%+)
- PR review time (target: 24 hours)
- CI/CD pipeline success rate
- Bug resolution time

---

By contributing to this project, you agree to abide by our code of conduct and these contribution guidelines.
