# Task Collaboration Platform

Full-stack task management app built with React, Express, and MongoDB, fully containerized with Docker Compose.

## Running the app

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api
- MongoDB: localhost:27017

## Running tests

Run the full test suite (backend + frontend) from the project root:

```bash
npm test
```

This runs `npm test --prefix backend` then `npm test --prefix frontend` in sequence and fails immediately if either suite fails.

To run each suite individually:

```bash
npm run test:backend    # Jest + Supertest + mongodb-memory-server
npm run test:frontend   # Vitest + React Testing Library
```

Backend tests use an in-memory MongoDB instance so no running database is required. Frontend tests run in a jsdom environment with mocked API calls.

To run only the security-focused backend tests (rate limiting, input validation, CORS):

```bash
npm run test:security
```

This targets `security.test.ts` exclusively via `--testPathPattern=security` and is useful for a fast CI security check without running the full suite.
