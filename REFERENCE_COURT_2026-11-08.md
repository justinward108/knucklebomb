# Reference-corrected court — local revision

Owner correction, 2026-11-08: the goals must follow the reference images, and the court is essentially concrete. This supersedes the earlier turf-and-steel visual interpretation. No master reference image bytes were changed.

Inspected references, resolved with `reference_system.py`:

- Equipment: `ref.sha256.496c560fb444c75b0c6a99c63b3ba4868718ad64b2014d1975251deabfcb71ef` — thick circular stone ring.
- Team gameplay: `ref.sha256.6e55c415cbef34347b2c04f03bfabbb2ad9d4bfa8c15228a81e2fa880c98e351` — elevated stone hoop against masonry and hard paved floor.
- Arena wide: `ref.sha256.46349479353abfbe2753a7abb96ba1f3a1449bedbccd3c590f7922d10c2cafff` — pale paving and masonry arena architecture.

These discovery records have blank entity links and UNMAPPED inventory status. They were used for this specific correction at the owner's direction, not promoted to general canonical approval. The current script set was checked through the creative repository's CURRENT pointer: Vol1 v663 describes soccer-like field markings and raised handball-like goals. The owner's reference correction governs this game revision; no manuscript or reference registry was edited.

Implemented: pale concrete/stone slabs, seams and wear, masonry end walls, thick circular stone hoops, dark recessed openings; removed turf, metal cages, nets, hazard tape and illuminated frame. Broad existing court markings remain subdued. The placement, numeric dimensions and renderer detail are game implementation choices, not new canon.

Scoring now tests the circular aperture rather than the former rectangle. The ring opening spans the same horizontal bounds, and its vertical diameter matches that width; AI throws aim at its center. Goal boundary regressions cover center, inner diagonal, former rectangular corner and outside heights. The platform simulation export was synchronized locally. Both backend and client must be released together before this geometry is used online.

Standalone game tests, all-club AI exhibitions, multiplayer room checks, actual HTTP handler tests and engine hash parity passed locally. This revision is not published; the live exhibition release remains the previous approved version.
