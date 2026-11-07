# Knucklebomb deployment — November 3, 2026

Published at the owner's explicit request for hands-on testing.

- Live site: https://knucklebomb.poor.camp
- Netlify site: 37a749b9-b946-47d0-8864-07e2f4e29bf2
- Production deploy: 6aea4bc0a6dd9e7f60f1c83e
- Release permalink: https://6aea4bc0a6dd9e7f60f1c83e--knucklebomb.netlify.app
- Source: current local main working tree, including the uncommitted controls, practice and restart-fight changes.
- Published package: 25 game files, about 5.8 MB. Development notes, tests, native wrappers and repository metadata were excluded. Existing Netlify headers and four proxy rules were retained.

This release includes receiver targeting, shooting guides, combat feedback, touch controls, five guided practice drills and short post-goal fights with directional blocking. The initial footrace interpretation has been removed. Practice awards no credits. Online multiplayer remains unconfigured.

Validation before publication: static/mobile checks, deterministic match and practice tests, and desktop/portrait/landscape browser checks. After publication, all 25 served files matched the prepared release bytes and Netlify reported this deploy as current and ready.

The owner's deployment instruction releases this Knucklebomb version from the publication hold. Other projects' holds remain in place. A later Git-triggered production deploy may replace this manually uploaded release.

Live browser verification also passed on desktop and phone: practice completion, the post-goal fight, held blocking without damage, and no page exceptions.
