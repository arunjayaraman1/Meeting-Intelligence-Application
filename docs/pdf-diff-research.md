# PDF Diff — Open Source Research

Research into open-source PDF comparison / text diff tools, their architectures, and end-to-end data flows.

---

## Top Open-Source Projects

| Project | Lang | Stars | Approach | URL |
|---------|------|-------|----------|-----|
| **diff-pdf** (vslavik) | C++ / wxWidgets | ~4,200 | Visual pixel diff → PDF output | github.com/vslavik/diff-pdf |
| **pdf-diff** (jamesmontemagno) | React 19 + TypeScript + Vite | active | Text diff, 100% client-side | github.com/jamesmontemagno/pdf-diff |
| **pdf-diff** (JoshData) | Python + Poppler | active | Text + visual hybrid, PNG output | github.com/JoshData/pdf-diff |
| **pdfdiff** (cascremers) | Python | small | CLI text diff, integrates with vimdiff etc. | github.com/cascremers/pdfdiff |
| **DiffPDF** (witwall) | C++ + Qt GUI | active | Word / char / appearance modes | github.com/witwall/diffpdf |
| **pdf-diff-viewer** (a-subhaneel) | AngularJS + PDF.js | small | Pixel diff at 300 DPI + auto-align | github.com/a-subhaneel/pdf-diff-viewer |

---

## Three Core Architectures

### Architecture 1 — Text-Based (client-side, modern)
**Representative project:** jamesmontemagno/pdf-diff (React + PDF.js + jsdiff)

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│  PDF A   │──▶  │  PDF.js      │──▶  │  Text        │──▶  │  jsdiff / Myers diff │
│  PDF B   │──▶  │  (extract    │──▶  │  Normalise   │──▶  │  (patience or Myers  │
└──────────┘     │   text +     │     │  (whitespace,│     │   algorithm)         │
                 │   positions) │     │   hyphenation│     └────────┬─────────────┘
                 └──────────────┘     │   EOL joins) │              │
                                      └──────────────┘     ┌────────▼─────────────┐
                                                           │  Diff hunks          │
                                                           │  [{type, value,      │
                                                           │    lineA, lineB}]    │
                                                           └────────┬─────────────┘
                                                                    │
                                                  ┌─────────────────▼────────────────┐
                                                  │         Renderer                  │
                                                  │  • Side-by-side (sync scroll)     │
                                                  │  • Unified inline                 │
                                                  │  • Additions-only / Removals-only │
                                                  │  • Export: HTML report / PDF      │
                                                  └──────────────────────────────────┘
```

**Data structures at each stage:**
- **Extraction:** `{ page: number, items: [{str, x, y, width, height}] }` per page (PDF.js TextContent)
- **Normalised text:** plain string per page (or joined across pages)
- **Diff output:** array of change objects `{ count, value, added?, removed? }` (jsdiff format)
- **Render model:** hunk list with before/after line numbers and colour tags

**Key properties:**
- Zero backend — static CDN deploy, privacy-first
- No server-side dependencies; all computation in browser JS
- Export via jsPDF (re-renders changes into a new PDF)

---

### Architecture 2 — Visual/Pixel-Based
**Representative project:** vslavik/diff-pdf (C++) / pdf-diff-viewer (AngularJS)

```
┌──────────┐     ┌──────────────┐     ┌──────────────────────────┐
│  PDF A   │──▶  │  Render to   │──▶  │  Pixel diff              │
│  PDF B   │──▶  │  image/canvas│──▶  │  (RGB channel subtract,  │
└──────────┘     │  at 300 DPI  │     │   threshold, mask)       │
                 └──────────────┘     └────────────┬─────────────┘
                                                   │
                                      ┌────────────▼─────────────┐
                                      │  Diff mask bitmap        │
                                      │  (red = changed pixels)  │
                                      └────────────┬─────────────┘
                                                   │
                                      ┌────────────▼─────────────┐
                                      │  Output                  │
                                      │  • Annotated PDF         │
                                      │  • Side-by-side PNG      │
                                      │  • GUI overlay viewer    │
                                      └──────────────────────────┘
```

**Key properties:**
- Catches layout/formatting/image changes not visible in text
- Sensitive to minor reflowing (font substitution triggers false positives)
- pdf-diff-viewer uses **auto-alignment** (text similarity scoring) to match pages when counts differ

---

### Architecture 3 — Hybrid (text diff → visual output)
**Representative project:** JoshData/pdf-diff (Python + Poppler)

```
Stage 1 — Text pipeline:
PDF A/B → pdftotext (Poppler) → bounding-box XML → fast-diff-match-patch
        → list of changed text runs [{text, x1,y1,x2,y2, page}]

Stage 2 — Visual pipeline:
PDF A/B → pdftopng (Poppler) → PIL images
        → draw red rectangles around changed bounding boxes
        → stitch pages → single PNG output

Key functions: compute_changes() → render_changes()
```

**Key properties:**
- Bounding box coordinates bridge text diff results to visual output
- EOL hyphen normalisation prevents spurious diffs
- "Zealous crop" auto-trims margins

---

## End-to-End Data Flow (canonical)

```
INPUT: PDF A + PDF B (binary)
  │
  ▼ STEP 1 — PARSE & EXTRACT (per page)
  │  text items with bounding boxes: [{page, str, x, y, w, h}]
  │  normalise: join EOL hyphens, strip headers/footers, collapse whitespace
  │
  ▼ STEP 2 — DIFF
  │  flatten to string or line array
  │  apply Myers / Patience / DMP → [{type:'equal|insert|delete', value, aPos, bPos}]
  │
  ▼ STEP 3 — MAP BACK TO PAGES
  │  resolve each hunk → page number + bounding box coordinates
  │
  ▼ STEP 4 — RENDER
  │  Choice A (text view): unified ± lines, side-by-side with sync scroll
  │  Choice B (visual): draw coloured boxes on rendered page images
  │
  ▼ STEP 5 — EXPORT (optional)
     HTML report / annotated PDF / PNG per page
```

---

## Diff Algorithms

| Algorithm | Complexity | Characteristic | Used By |
|-----------|-----------|----------------|---------|
| **Myers** | O(ND) | Fastest, grid shortest-path, may match trivial lines | Git default, jsdiff default |
| **Patience** | O(N log N) | Anchors on unique lines first → more human-readable hunks | jsdiff, some PDF tools |
| **Histogram** | O(N log N) | Extended patience, rarely worse than Myers | Modern git option |
| **Diff-match-patch** | O(N²) worst | Character-level, designed for collaborative editing | JoshData/pdf-diff |

---

## Text Extraction Libraries

| Library | Language | Speed | Accuracy | Notes |
|---------|----------|-------|----------|-------|
| **PDF.js** | JavaScript | Fast (async) | Good | Browser-native, Promise-based, text + positions |
| **PyMuPDF** | Python | ~42ms | High | Block-level with coordinates, supports OCR |
| **pdfminer.six** | Python | ~2.5s | Highest | Preserves spatial layout, complex API |
| **Poppler (pdftotext)** | C/CLI | Fast | Good | Used by most CLI tools, XML bounding-box output |
| **Grobid** | Java/ML | Slow | Excellent | Strips headers/footers; separates structure from body |

---

## Key Design Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Where to process | Client-side vs server-side | Client-side (privacy, no infra) for <50MB PDFs |
| Granularity | Line vs word vs char | Word-level is best UX; char-level for legal/compliance |
| Algorithm | Myers vs Patience | Patience for prose documents (fewer spurious matches) |
| Output | Text diff vs visual overlay | Text diff for content changes; pixel diff for layout |
| Page mismatch | Skip vs align | Text similarity scoring to auto-match pages |
| Multi-column | Ignore layout vs reconstruct | PyMuPDF block detection or Grobid for best accuracy |

---

## Recommended Projects to Study

1. **[jamesmontemagno/pdf-diff](https://github.com/jamesmontemagno/pdf-diff)** — Modern React/TypeScript; best reference for a web app; MIT license; well documented.
2. **[JoshData/pdf-diff](https://github.com/JoshData/pdf-diff)** — Clearest text-diff → visual output pipeline; ~200 lines of Python; CC0 license.
3. **[a-subhaneel/pdf-diff-viewer](https://github.com/a-subhaneel/pdf-diff-viewer)** — Shows pixel-diff approach and auto-alignment for mismatched page counts.
