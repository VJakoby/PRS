# AI Disclosure & Provenance

### 🏗️ Architectural Ownership
The **engram-Indexed-Search-Surface** repository and its user-facing application, **ENGRAM — Indexed Search Surface**, were conceptualized, architected, and directed by **VJakoby**.

The human architect defined and oversaw the following core systems:
* **The Indexing & Scoring Engine:** The strategy for fuzzy search matching and the hierarchical scoring system for search results.
* **CLI Suite & Automation:** The design and structure of the `indexer.js` command suite (handling `build`, `update`, `cache`, and `info` routines).
* **Polite Indexing Logic:** The implementation of a "Fair-Use" rate-limiting system (defaulting to 5 req/sec) to ensure server stability and ethical data collection.
* **Containerization:** The Docker Compose orchestration for a localized, isolated Node.js environment.

### 🤖 AI Implementation
This repository was developed through iterative collaboration with AI coding tools, including **Claude 4.6 Sonnet** (Anthropic) and **Codex** (OpenAI).

* **Role:** These AI systems were used as implementation partners, assisting with logic generation for CLI argument parsing, file system interactions, indexing workflows, and HTML scraping via `cheerio`, based on human-defined architectural requirements.
* **Refinement:** All AI-generated outputs underwent multiple rounds of human review and revision. Final responsibility for architectural decisions, review, acceptance, and refactoring remained with the human author.

### ⚖️ Legal Standing & Attribution
* **Repository & App Name:** This repository is published as **engram-Indexed-Search-Surface**. The user-facing application is presented as **ENGRAM — Indexed Search Surface**.
* **Function:** ENGRAM is a local knowledge-base and documentation indexing/search tool that aggregates public online documentation and local markdown notes into a unified searchable surface, exposed through both a CLI workflow and a local REST API.
* **Ownership:** The author claims copyright over the **collective work**, the project structure, and the unique **system architecture**. The AI is recognized as a sophisticated development tool used under human direction.
* **License:** This project is licensed under the **MIT License**, consistent with the repository metadata.
* **Dependencies:** Built using Express, Axios, Cheerio, Marked, and CORS.

### 🌐 Note on Data Sources
- This repository may contain a list of publicly accessible URLs used as reference points for indexing.

- **Public Access:** This tool is designed to interface only with publicly available data and does not bypass authentication, paywalls, or security measures.

- **User Responsibility:** The inclusion of these URLs does not imply an endorsement or a license to scrape. Users are **responsible** for ensuring that their use of this indexer complies with the specific Terms of Service (ToS) and robots.txt files of the target domains.

- **Fair Use:** The author provides this list for educational and organizational purposes only.
---
*Created by VJakoby + 🤖*
