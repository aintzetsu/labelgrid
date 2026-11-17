# LabelGrid — Multi-Modal AI Data Annotation Workbench

A zero-dependency, browser-based data annotation workbench & SaaS showcase built with HTML5 Canvas, Pointer Events, CSS3, and modular Vanilla JavaScript.

## Key Features
- **Interactive Vision Workbench (`960×540` Canvas):** Switch across three vector/canvas scenes (*Street Traffic*, *Warehouse Robotics*, *PCB Inspection*). Click and drag to draw new bounding boxes, move existing boxes, inspect pixel coordinates, toggle labels, undo (`Ctrl+Z`), or delete selected boxes (`Delete`).
- **Interactive Text / NER Span Tagging:** Click or drag across tokens in sample telemetry, clinical, and FinTech documents to assign entity tags (`ORG`, `METRIC`, `DATE`, `ISSUE`, `LOC`) with exact UTF-16 character offsets.
- **Live Schema Exports:** Inspect and download real **COCO JSON**, **YOLO `.txt`**, **JSON**, and **JSONL** payloads directly from the browser.
- **QA Confidence Gate Simulator & Pricing:** Interactive consensus threshold slider calculating auto-verified vs. human-review queue throughput, monthly/annual billing toggle, FAQ accordion, and Dark/Light theme switcher.

## Structure
```text
labelgrid/
├── index.html
├── styles/
│   ├── tokens.css      # Theme variables & color tokens
│   ├── main.css        # Landing layout, QA simulator, pricing & FAQ
│   └── workbench.css   # Canvas stage, NER spans & inspector styles
├── js/
│   ├── data.js         # Sample scenes, NER documents & vector scene renderer
│   ├── vision.js       # Canvas bounding-box engine & COCO/YOLO exporters
│   ├── nlp.js          # Token span tagging engine & JSONL exporter
│   └── app.js          # Application controller & state orchestration
└── README.md
```
