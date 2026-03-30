# Search Quality Roadmap

ENGRAM should prioritize retrieval quality over new scope.

## Priority Order

1. Phrase intent and co-occurrence
2. Synonym confidence weighting
3. Command-heavy note matching
4. Noise reduction
5. Explain/debug visibility

## Why This Order

The biggest quality failures are usually not missing data. They are ranking failures:

- broad documentation outranks specific local notes
- phrase-heavy offensive-security terms are treated like loose bags of words
- short operator queries fail to surface note content that is clearly relevant

Fixing phrase intent and clustered-term ranking gives the highest-value improvement first.

## Planned Refinement Passes

## Implementation Progress

- Implemented: Pass 1 phrase intent and clustered-term scoring
- Implemented: Pass 2 weighted synonym confidence model
- Implemented: Pass 3 command-heavy local note matching
- Planned next: Pass 4 noise reduction and Pass 5 explainability
### Pass 1: Phrase Intent and Co-occurrence

Goal:
- reward exact and near-exact multi-word phrases more strongly
- reward pages where important terms appear close together
- prefer dense tactical content over generic mentions

Candidate changes:
- strong phrase boosts in title, page name, and content
- clustered-term bonus when multi-word query terms occur in a short span
- stronger phrase boosts for local notes when confidence is similar

Expected improvement:
- `active directory delegation`
- `pass the hash`
- `nmap smb enumeration`
- `silver ticket`

These should rank more reliably and with less dilution from generic docs.

### Pass 2: Synonym Confidence Model

Goal:
- separate strong aliases from weaker related terms
- make expansion directional where useful

Candidate changes:
- `alias` vs `related` synonym categories
- lower-weight scoring for weaker related expansions
- directional mappings for ports and shorthand terms

Expected improvement:
- `ad` <-> `active directory` remains strong
- `winrm` no longer behaves like `evil-winrm`
- protocol and product confusion is reduced

### Pass 3: Command-heavy Note Matching

Goal:
- improve searches against local notes that contain commands and flags

Candidate changes:
- better boosts for command-like patterns
- stronger scoring when multiple technical tokens co-occur
- prefer note content where service/tool/flag combinations appear together

Expected improvement:
- `nmap smb shares`
- `certipy find vulnerable templates`
- `kerbrute userenum`

### Pass 4: Noise Reduction

Goal:
- reduce false-positive expansion and broad matches

Candidate changes:
- lower weak-content boosts
- cap generic page boosts
- stronger differentiation between broad docs and specific note hits

### Pass 5: Explainability

Goal:
- make ranking tunable without guessing

Candidate changes:
- optional score breakdown output
- matched phrase / synonym / cluster debug visibility
- result-level reason tags

Expected improvement:
- faster tuning
- fewer accidental regressions

## Success Criteria

Search quality is improving if:

- specific local notes beat broad docs when both are relevant
- multi-word tactical phrases behave like phrases
- command-heavy note content is surfaced by natural-language queries
- fuzzy matching rescues typos without dominating strong exact/phrase matches
