## Copilot Usage Guidelines

- Always use Context7 when code generation, setup guidance, or library/API documentation is needed. Automatically resolve library IDs and fetch docs without waiting for a separate request.
- Follow the repository's current coding standards, lint rules, and formatting conventions for every language and framework present.
- Treat typing as non-optional: use full type hints in Python (including `typing` / `pydantic` models) and strict TypeScript/JS typing in Node projects (e.g., `strict` TS config, JSDoc annotations when necessary).
- Prefer clean, maintainable solutions that solve the problem directly; avoid premature optimization or over-engineering unless the requirements explicitly call for it.
- Rely on established best practices for structure, error handling, logging, and testing; add or update unit tests when behavior changes.
- If something is unclear or undocumented, ask for the relevant documentation instead of guessing, or use available tools (Context7, repo search, etc.) to locate authoritative answers.
- Default to incremental improvements that integrate smoothly with the existing architecture and patterns already used in this codebase.