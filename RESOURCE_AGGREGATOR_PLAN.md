## Smart Resource Aggregator – Implementation Plan

This document outlines the work required to implement the **Smart Resource Aggregator** feature specified in the resource aggregator spec. It is split into:

- **Section 1**: Setup tasks (fast, unblock parallel work)
- **Section 2**: Backend, DB, and LLM orchestration
- **Section 3**: Frontend UI and extension integration

All paths below are relative to the repo root.

---

## 1. Setup Tasks (quick, unblock both devs)

These are ideal setup tasks to complete up front so developers can work independently with minimal merge conflicts. They are mostly **scaffolding, contracts, and wiring**, not full logic.

- **1.1 Define backend API surface & shared contracts**
  - **1.1.1 Add resources router file**
    - Create `backend/app/api/endpoints/resources.py` with:
      - `router = APIRouter()` and placeholder endpoints:
        - `POST /resources/search`
        - `GET /resources/library`
        - `POST /resources/library`
        - `DELETE /resources/library/{id}`
      - Each endpoint should use **Pydantic models** for request/response that match the spec (see 2.2).
      - For now, implementations can return hard-coded dummy data (or simple `{"message": "not implemented yet"}`) so the frontend can start integration.
  - **1.1.2 Wire the new router into the main API**
    - Update `backend/app/api/routes.py` to include the new router:
      - `from app.api.endpoints import resources` (new import).
      - `api_router.include_router(resources.router, prefix="/resources", tags=["resources"])`.
    - Confirm the FastAPI docs (`/docs`) show the new endpoints.

- **1.2 Define resource models (Pydantic)**
  - **1.2.1 Create resource models module**
    - Add `backend/app/models/resource.py` with Pydantic models mirroring the spec:
      - `ResourceSearchRequest`:
        - `query: str`
        - `piazza_course_id: str`
        - `filters: list[str] | None` (e.g., `"youtube"`, `"stackoverflow"`, `"khan_academy"`, `"wikipedia"`)
        - `limit: int | None` (with a sane default in the endpoint, e.g., 10–20).
      - `ResourceSearchItem` (single aggregated result):
        - `title: str`
        - `url: str`
        - `resource_type: str` (e.g., `"youtube"`, `"stackoverflow"`, `"khan_academy"`, `"wikipedia"`, `"other"`)
        - `description: str`
        - `relevance_score: float`
      - `ResourceSearchResponse`:
        - `results: list[ResourceSearchItem]`
      - `SavedResource` (library row shape):
        - `id: UUID`
        - `topic: str`
        - `title: str`
        - `url: str`
        - `resource_type: str`
        - `description: str | None`
        - `relevance_score: float | None`
        - `piazza_course_id: str`
        - `created_at: datetime`
      - `SavedResourceListResponse`:
        - `saved_resources: list[SavedResource]`
      - `SaveResourceRequest`:
        - `piazza_course_id: str`
        - `topic: str`
        - `resource_type: str`
        - `title: str`
        - `url: str`
        - `description: str`
        - `relevance_score: float | None`
      - `SaveResourceResponse`:
        - `id: UUID`
        - `message: str`
      - `DeleteResourceResponse` (optional, since spec returns 204, but useful for testing).
  - **1.2.2 Export models through the main models module**
    - Update `backend/app/models/__init__.py` to import and expose resource models (like `Document*` is currently done), so endpoints can `from app.models import ResourceSearchRequest, ...`.

- **1.3 Database migration for `resource_library` table**
  - **1.3.1 Create migration file**
    - Under `supabase/migrations/`, add a new migration, e.g. `20260226000000_resource_library.sql` (timestamp prefix can follow the pattern of existing files).
  - **1.3.2 Implement schema using the spec**
    - Use the spec definition as base:
      - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
      - `user_id UUID REFERENCES users(id) ON DELETE CASCADE`
      - `piazza_course_id TEXT`
      - `topic TEXT NOT NULL`
      - `resource_type TEXT` (e.g., `youtube`, `stackoverflow`, `khan_academy`, `wikipedia`, `other`)
      - `title TEXT NOT NULL`
      - `url TEXT NOT NULL`
      - `description TEXT`
      - `relevance_score DECIMAL(3,2)`
      - `created_at TIMESTAMPTZ DEFAULT NOW()`
    - Add useful indexes:
      - Index on `(user_id, piazza_course_id)`.
      - Maybe index on `topic` if you expect topic-based filtering.

- **1.4 Backend scaffolding for external aggregators and LLM ranking**
  - **1.4.1 Create a module for resource providers**
    - Add `backend/app/services/resource_providers.py` (or a small package `backend/app/services/resource_providers/` if you want one file per provider).
    - Define **interfaces only**, with stub implementations:
      - `async def fetch_youtube_resources(query: str, limit: int) -> list[dict]: ...`
      - `async def fetch_stackoverflow_resources(query: str, limit: int) -> list[dict]: ...`
      - `async def fetch_khan_academy_resources(query: str, limit: int) -> list[dict]: ...`
      - `async def fetch_wikipedia_resources(query: str, limit: int) -> list[dict]: ...`
    - For now, just return a small fixed dummy list shaped like `ResourceSearchItem` dicts so frontend integration and endpoint plumbing can happen early.
  - **1.4.2 Create resource_ranker module**
    - Add `backend/app/textGeneration/resource_ranker.py` with:
      - A function like:
        - `def rank_resources(resources: list[dict], query: str, piazza_course_id: str | None = None) -> list[dict]:`
      - For setup, implement a trivial ranking (e.g., keep order, or sort by a `source_weight` key) so the endpoint works end-to-end while LLM logic is built later by Backend dev.

- **1.5 Frontend scaffolding for Resources UI**
  - **1.5.1 Create a Resources page component**
    - Add `frontend/src/popup/ResourcesPage.jsx`:
      - Basic layout only:
        - Text input for topic / query.
        - Checkboxes or pills for filters: YouTube, StackOverflow, Khan Academy, Wikipedia.
        - Empty list placeholder for results with “Result card” layout stub (title, description, type, Save button).
        - A secondary “Library” tab or section with empty-state placeholder.
      - Do **not** wire real network calls yet – just props + basic component state placeholder.
  - **1.5.2 Wire navigation entry point (minimal)**
    - Update `frontend/src/popup/App.jsx`:
      - Add `"resources"` as a possible `currentPage` state value.
      - Add a stub navigation path to `ResourcesPage` (e.g., a button from `DashboardPage` that sets `currentPage` to `"resources"`).
      - Keep this change small so future Frontend work can expand it without touching `App.jsx` again.

- **1.6 API client stubs for resources**
  - **1.6.1 Add API helper functions**
    - Create `frontend/src/api/resourcesApi.js` with functions:
      - `searchResources({ query, piazzaCourseId, filters, limit })`
      - `getResourceLibrary({ piazzaCourseId })`
      - `saveResource(payload)`
      - `deleteResource(id)`
    - For setup, have them hit the **real backend endpoints** but expect dummy data (from stubbed backend), or even temporarily return mocked data structures while backend is being implemented.

- **1.7 Dependencies & configuration**
  - **1.7.1 Backend dependencies**
    - Update `backend/requirements.in` (and regenerate `requirements.txt` if you use a lock step) to include:
      - `google-api-python-client` (YouTube Data API v3)
      - `requests`
      - `beautifulsoup4`
    - Ensure the CI and local setup docs mention that `pip-compile` or equivalent has been run if needed.
  - **1.7.2 Configuration placeholders**
    - Update `backend/app/core/config.py` to add config entries for:
      - `YOUTUBE_API_KEY`
      - Any Stack Exchange API keys or base URLs.
      - Timeouts / max results / default limits for resource search.
    - Do **not** hardcode secrets; just add environment-variable-based settings and document them in `backend/README.md`.

Once all of the above are done, the **backend** and **frontend** workstreams can mostly proceed in parallel, with backend powering real data and frontend building out the UX against the stable contracts defined above.

---

## 2. Backend – DB, APIs, LLM Orchestration

Scope: implement resource fetching, ranking, and library persistence in the backend, plus DB migration and provider integrations. Primary directories: `backend/app/api/endpoints`, `backend/app/models`, `backend/app/services`, `backend/app/textGeneration`, `supabase/migrations`.

- **2.1 Implement `resource_library` migration & verify schema**
  - Complete and run the new migration file created in **1.3**:
    - Ensure table `resource_library` is created correctly with foreign keys and indexes.
    - Confirm it appears in Supabase / Postgres.
  - Add any necessary down-migration logic if your tooling requires reversible migrations.

- **2.2 Finalize Pydantic models and types**
  - Revisit `backend/app/models/resource.py`:
    - Ensure all fields match the final DB schema (`resource_library`) and API contract.
    - Add any additional optional fields you decide to support (e.g., `thumbnail_url`, `source_id`, `raw_metadata`).
    - Make sure models are exported from `backend/app/models/__init__.py`.

- **2.3 Implement `POST /resources/search` endpoint**
  - File: `backend/app/api/endpoints/resources.py`.
  - Responsibilities:
    - Accept `ResourceSearchRequest` in the body.
    - Normalize filters (e.g., default to all providers if `filters` is empty).
    - Dispatch parallel fetches to provider functions defined in `app/services/resource_providers.py`:
      - Use `asyncio.gather` or similar to call enabled providers concurrently.
      - Standardize each provider’s response into a unified internal structure (e.g., a `RawResource` dict or internal dataclass).
    - Call `resource_ranker.rank_resources` with:
      - Combined list of candidate resources.
      - `query` and `piazza_course_id`.
    - Apply `limit` (if provided) **after** ranking.
    - Return `ResourceSearchResponse` with normalized `ResourceSearchItem` objects.
  - Error handling:
    - Gracefully handle provider failures (e.g., log and continue with other providers).
    - Return 500 only if all providers fail or ranking fails in a non-recoverable way.

- **2.4 Implement `GET /resources/library` endpoint**
  - Responsibilities:
    - Identify user (for now, options include:
      - Use a `user_id` passed explicitly as a query parameter, or
      - If auth is already in place, derive from token – follow `auth` patterns in `backend/app/api/endpoints/auth.py`.
    - Optional filter by `piazza_course_id`.
    - Query `resource_library` table using `execute_query` pattern like in `documents.py`.
    - Map rows into `SavedResource` models and return `SavedResourceListResponse`.
  - Performance:
    - Use pagination if you expect many rows (page / per_page query params).

- **2.5 Implement `POST /resources/library` endpoint**
  - Responsibilities:
    - Accept `SaveResourceRequest` (plus user or session context).
    - Validate URL and required fields.
    - Insert a row into `resource_library` with:
      - `user_id` from auth or explicit param.
      - `topic`, `title`, `resource_type`, `url`, `description`, `relevance_score`, `piazza_course_id`.
    - Return `SaveResourceResponse` with the new `id` and success message.
  - Consider deduplication:
    - Optionally avoid duplicates for the same user/topic/url (e.g., unique constraint on `(user_id, url)` or application-level check).

- **2.6 Implement `DELETE /resources/library/{id}` endpoint**
  - Responsibilities:
    - Validate that the resource belongs to the requesting user (if you have auth context).
    - Delete row by `id` from `resource_library`.
    - Return `204 No Content` or a simple JSON confirmation, consistent with your overall API style.

- **2.7 Implement external provider clients**
  - In `backend/app/services/resource_providers.py` (or a subpackage):
    - **YouTube Data API v3**:
      - Use `google-api-python-client` with your `YOUTUBE_API_KEY`.
      - Map search results to unified resource dicts (title, url, type `"youtube"`, description, potential `published_at` and `channel` metadata).
    - **Stack Exchange API (StackOverflow)**:
      - Use `requests` to call the search endpoint for StackOverflow questions.
      - Map results to type `"stackoverflow"` with title, URL, excerpt as description, and maybe score/answer count in metadata.
    - **Khan Academy**:
      - If no first-class API is used, implement a minimal scraper with `requests + beautifulsoup4`.
      - Keep parsing robust but simple – focus on stable page structure for video/topic pages.
    - **Wikipedia API**:
      - Call `opensearch` or search APIs to get article summaries and URLs.
      - Map to type `"wikipedia"`.
  - Each provider function should:
    - Take `(query: str, limit: int)` as input.
    - Handle rate limiting / timeouts.
    - Log and return an empty list on failure rather than raising, so `/resources/search` can degrade gracefully.

- **2.8 Implement LLM-based ranking in `resource_ranker.py`**
  - Design a prompt that:
    - Takes `query`, `piazza_course_id` (for possible course context), and a JSON list of raw resources.
    - Asks the LLM to:
      - Filter out off-topic or low-quality resources.
      - Assign a `relevance_score` between 0 and 1.
      - Optionally rephrase descriptions to be short and student-friendly.
  - Implementation details:
    - Reuse existing `ChatGroq` or `OpenAI` clients if possible (see patterns in `backend/app/textGeneration/llm_service.py`).
    - Consider token limits: cap the number of resources and/or truncate descriptions before sending to the LLM.
    - Parse the LLM output into structured data (e.g., via JSON).
  - Provide a safe fallback:
    - If LLM call fails, fall back to a heuristic ranking (e.g., by provider priority and original search scores).

- **2.9 Testing & validation**
  - Add tests (if your test infra is ready) or at minimum manual scripts:
    - Happy path: search with a topic returns ranked resources from multiple sources.
    - Library CRUD: save, list, delete resources.
    - Edge cases: invalid filters, missing query, rate-limited provider.
  - Verify:
    - OpenAPI schema looks clean in `/docs`.
    - CORS allows the extension to call the `/resources/*` endpoints (should already be covered by existing CORS config).

---

## 3. Frontend – UI, Extension Wiring, UX

Scope: build the user-facing “Resources” experience in the Chrome extension popup, including search UI, library view, and integration with Piazza context and the backend endpoints. Primary directories: `frontend/src/popup`, `frontend/src/api`, `frontend/src/content`.

> **Note:** Full wiring of API calls in this section depends on the backend contracts being stable (Sections 1.1–1.3 and 2.3–2.6). Most of the layout and local state management can be built against mocked data before the backend is ready.

- **3.1 Finalize Resources page layout**
  - Work in `frontend/src/popup/ResourcesPage.jsx` scaffolded in **1.5**:
    - Implement two main modes/tabs:
      - **Search**: for querying external resources on a topic.
      - **Library**: for viewing previously saved items.
    - In Search tab:
      - Text input for topic / query, seeded optionally from current Piazza post (see 3.2).
      - Multi-select filters for resource types.
      - Search button and clear button.
      - Results list rendering `ResourceCard` components with:
        - Title (clickable link).
        - Description summary.
        - Resource type badge (YouTube, SO, KA, Wikipedia).
        - Relevance score (optional, subtle).
        - “Save to Library” button.
    - In Library tab:
      - List of saved resources grouped by topic or course.
      - Filter by topic or `piazza_course_id`.
      - “Remove” button for each card (calls DELETE endpoint).
  - Open questions for team discussion:
    - Where should the Resources entry point live (Dashboard vs Assistant, or both)?
    - Should the Resources page open pre-filtered to the current post/topic or just the course?
    - How prominent should provider metadata and relevance scores be in the UI?

- **3.2 Integrate Piazza context (class + post/topic)**
  - Reuse existing logic in `DashboardPage.jsx` and `AssistantPage.jsx`:
    - Get `piazza_course_id` from the active tab URL, as is already done in `DashboardPage.jsx` and `AssistantPage.jsx`.
    - Optionally fetch the current thread title via content script (`GET_PIAZZA_INFO`) and:
      - Pre-fill the search query with the thread title when opening the Resources page from a Piazza post.
  - Implementation:
    - Add navigation entry (button or link) in `DashboardPage.jsx` (or `AssistantPage.jsx`) that:
      - Passes `piazza_course_id` and optional `topicTitle`/`threadName` down into `ResourcesPage`.
    - In `ResourcesPage`, use these props as defaults for `query` and course selection.

- **3.3 Wire API client functions**
  - Depends on: basic API shape from Sections **1.1**, **1.2**, and backend implementation in **2.3–2.6**.
  - Implement `frontend/src/api/resourcesApi.js` created in **1.6**:
    - Use `process.env.API_ENDPOINT` pattern as other API modules (`documentApi.js`, etc.).
    - Implement:
      - `searchResources({ query, piazzaCourseId, filters, limit })`:
        - `POST ${API_ENDPOINT}/resources/search` with the request body defined in the backend spec.
      - `getResourceLibrary({ piazzaCourseId })`:
        - `GET ${API_ENDPOINT}/resources/library?piazza_course_id=...`.
      - `saveResource(payload)`:
        - `POST ${API_ENDPOINT}/resources/library` with payload from the selected card.
      - `deleteResource(id)`:
        - `DELETE ${API_ENDPOINT}/resources/library/${id}`.
    - Handle JSON parsing, network errors, and timeouts consistently with existing APIs.

- **3.4 Connect ResourcesPage to API**
  - Depends on: `resourcesApi` functions in **3.3** and backend endpoints in **2.3–2.6**.
  - In `ResourcesPage.jsx`:
    - On Search:
      - Call `searchResources` with current `query`, `filters`, `piazzaCourseId`, and an optional `limit`.
      - Show loading state, handle errors with an inline message or toast.
      - Render returned `results` as cards.
    - On Save:
      - From a search result card, call `saveResource` with:
        - `piazza_course_id` from context.
        - `topic` derived from the search query or thread title.
        - Other fields from the result object.
      - Show success/failure feedback (small toast/snackbar or inline message).
    - On Library tab load:
      - Call `getResourceLibrary` when the tab is first opened (and when `piazzaCourseId` changes).
      - Cache and display results; support manual refresh.
    - On Remove:
      - Call `deleteResource(id)` and optimistically update UI.

- **3.5 UX polish**
  - Ensure the popup fits within the existing extension layout (`380px` width, min height) and matches Tailwind-based styling conventions:
    - Use consistent fonts, colors, and spacing as `DashboardPage` and `AssistantPage`.
  - Add:
    - Clear empty states (e.g., “No resources yet. Try searching for a topic above.”).
    - Inline validation (e.g., disable search button if query is empty).
    - Loading skeletons or spinners for search results and library.
  - Consider:
    - Indicating which provider each result comes from (icon or label).
    - Showing only the top N results by default with “Show more” if needed.

- **3.6 Testing & manual flows**
  - Validate flows with real backend (once Developer A’s endpoints are functional):
    - From a Piazza thread:
      - Open popup, navigate to Resources.
      - Confirm course ID is correctly detected and used in requests.
      - Search for a topic and see aggregated results.
      - Save one or more results, switch to Library tab, confirm they appear.
      - Delete a resource and confirm removal both in UI and on subsequent reload.
  - Ensure:
    - Network and error states are handled gracefully.
    - No console errors from React or content scripts.
    - API endpoint URLs use the same environment configuration as the rest of the extension.

---

## 4. File Boundaries & Cross‑Section Dependencies

- **Backend-focused files**
  - `backend/app/api/endpoints/resources.py`
  - `backend/app/models/resource.py`
  - `backend/app/models/__init__.py` (resource model exports)
  - `backend/app/services/resource_providers.py` (and any related provider modules)
  - `backend/app/textGeneration/resource_ranker.py`
  - `supabase/migrations/*resource_library*.sql`
  - `backend/requirements.in`, `backend/requirements.txt`, and `backend/app/core/config.py` for new dependencies and config.

- **Frontend-focused files**
  - `frontend/src/popup/ResourcesPage.jsx`
  - `frontend/src/api/resourcesApi.js`
  - Minor additions in:
    - `frontend/src/popup/App.jsx` (navigation to resources page)
    - `frontend/src/popup/DashboardPage.jsx` and/or `AssistantPage.jsx` (button/entry point + passing Piazza context)
  - Optional tweaks to shared styles in `frontend/src/popup/popup.css` or Tailwind config.

- **Setup / shared touchpoints**
  - `backend/app/api/routes.py` – only for registering the `resources` router (Section **1.1.2**).
  - `backend/app/models/__init__.py` – only for exposing resource models (Section **1.2.2**).
  - `frontend/src/popup/App.jsx` – only for adding the Resources page route (Section **1.5.2**).

To minimize conflicts when work is split across people, keep changes to these shared files small and sequential (e.g., finish Section 1 before starting deep backend or frontend work), so backend and frontend sections can progress mostly independently.

