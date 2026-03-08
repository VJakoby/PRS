# AI Disclosure & Provenance

### 🏗️ Architectural Ownership
The **ENGRAM-knowledge-base-indexer** was conceptualized, architected, and directed by **VJakoby**. 

The human architect defined and oversaw the following core systems:
* **The Indexing & Scoring Engine:** The strategy for fuzzy search matching and the hierarchical scoring system for search results.
* **CLI Suite & Automation:** The design and structure of the `indexer.js` command suite (handling `build`, `update`, `cache`, and `info` routines).
* **Polite Indexing Logic:** The implementation of a "Fair-Use" rate-limiting system (defaulting to 5 req/sec) to ensure server stability and ethical data collection.
* **Containerization:** The Docker Compose orchestration for a localized, isolated Node.js environment.

### 🤖 AI Implementation
This repository was developed through iterative collaboration with **Claude 4.6 Sonnet** (Anthropic).

* **Role:** The AI acted as the primary implementation partner, generating the logic for CLI argument parsing, file system interactions, and HTML scraping via `cheerio` based on human-defined architectural requirements.
* **Refinement:** All AI-generated outputs underwent multiple rounds of human review. The author manually refactored the request-handling logic to ensure the `RATE` constant was correctly integrated across the asynchronous crawling process.

### ⚖️ Legal Standing & Attribution
* **Ownership:** The author claims copyright over the **collective work** and the unique **system architecture**. The AI is recognized as a sophisticated development tool used under human direction.
* **License:** This project is licensed under the **MIT License**.
* **Dependencies:** Built using Express, Axios, and Cheerio.

### 🌐 Note on Data Sources
- This repository may contain a list of publicly accessible URLs used as reference points for indexing.

- **Public Access:** This tool is designed to interface only with publicly available data and does not bypass authentication, paywalls, or security measures.

- **User Responsibility:** The inclusion of these URLs does not imply an endorsement or a license to scrape. Users are **responsible** for ensuring that their use of this indexer complies with the specific Terms of Service (ToS) and robots.txt files of the target domains.

- **Fair Use:** The author provides this list for educational and organizational purposes only.
---
*Created by VJakoby + 🤖*