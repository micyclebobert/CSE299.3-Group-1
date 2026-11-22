Title: Split UI audit history and consolidate live UI plan

Summary:
Moved `docs/Plans/UI Audit.md` unchanged to `docs/Plans/UI Audit Historical.md` and created `docs/Plans/UI.md` as the single live UI tracker. The new file contains exactly one DONE section for work delivered through commit `4dd3ef8`, one QA section for the latest implementation review, and one consolidated TODO section containing every still-open historical UI requirement plus newly discovered placement, Debugger synchronization, Canvas rendering, I/O cache, accessibility, persistence, panel-layout, testing, naming, and documentation gaps. Verification included the full Node test suite (807 passing), focused UI tests, targeted runtime probes, section-count checks, and byte-for-byte historical-file integrity validation.
