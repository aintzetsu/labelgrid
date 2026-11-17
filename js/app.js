/* ==========================================================================
   LabelGrid — Application Controller & Workbench State
   ========================================================================== */

(function (global) {
  "use strict";

  const STORAGE_THEME = "labelgrid_theme";
  const Data = global.LabelGridData;

  function safeStorageGet(key, fallback) {
    try {
      const val = global.localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch (_err) {
      return fallback;
    }
  }

  function safeStorageSet(key, val) {
    try {
      global.localStorage.setItem(key, JSON.stringify(val));
    } catch (_err) {
      // Ignore storage errors in restricted modes
    }
  }

  const state = {
    theme: safeStorageGet(STORAGE_THEME, "dark"),
    mode: "vision", // "vision" | "nlp"
    visionSceneId: Data.VISION_SCENES[0].id,
    nlpDocId: Data.NLP_DOCS[0].id,
    visionClassId: Data.VISION_CLASSES[0].id,
    nlpClassId: Data.NLP_CLASSES[0].id,
    showLabels: true,
    exportFormat: "primary", // "primary" (COCO/PrettyJSON) | "secondary" (YOLO/JSONL)
    billing: "monthly",
    visionCache: {},
    nlpCache: {}
  };

  let visionEngine = null;
  let nlpEngine = null;
  const dom = {};

  function cacheDom() {
    dom.themeToggle = document.getElementById("theme-toggle");
    dom.themeIcon = document.getElementById("theme-icon");
    dom.mobileMenuBtn = document.getElementById("mobile-menu-btn");
    dom.mobileNav = document.getElementById("mobile-nav");

    dom.modeTabs = document.querySelectorAll("[data-mode]");
    dom.datasetPills = document.getElementById("dataset-pills");
    dom.classPalette = document.getElementById("class-palette");
    dom.undoBtn = document.getElementById("wb-undo");
    dom.labelsToggleBtn = document.getElementById("wb-labels-toggle");
    dom.clearBtn = document.getElementById("wb-clear");
    dom.resetBtn = document.getElementById("wb-reset");

    dom.visionStage = document.getElementById("vision-stage");
    dom.visionCanvas = document.getElementById("vision-canvas");
    dom.visionFileName = document.getElementById("vision-file-name");
    dom.nlpStage = document.getElementById("nlp-stage");
    dom.nlpDocName = document.getElementById("nlp-doc-name");
    dom.nlpTokens = document.getElementById("nlp-tokens");

    dom.inspectorCount = document.getElementById("inspector-count");
    dom.annotationList = document.getElementById("annotation-list");
    dom.exportTabs = document.getElementById("export-tabs");
    dom.exportOutput = document.getElementById("export-output");
    dom.copyExportBtn = document.getElementById("copy-export-btn");
    dom.downloadExportBtn = document.getElementById("download-export-btn");

    dom.qaSlider = document.getElementById("qa-threshold");
    dom.qaThresholdVal = document.getElementById("qa-threshold-val");
    dom.qaAutoPct = document.getElementById("qa-auto-pct");
    dom.qaReviewPct = document.getElementById("qa-review-pct");
    dom.qaThroughput = document.getElementById("qa-throughput");

    dom.billingBtns = document.querySelectorAll("[data-billing]");
    dom.studioPrice = document.getElementById("studio-price");
    dom.studioNote = document.getElementById("studio-note");
    dom.faqTriggers = document.querySelectorAll(".faq-trigger");
    dom.waitlistForm = document.getElementById("waitlist-form");
    dom.waitlistEmail = document.getElementById("waitlist-email");
    dom.waitlistFeedback = document.getElementById("waitlist-feedback");
    dom.toastStack = document.getElementById("toast-stack");
  }

  function showToast(msg) {
    if (!dom.toastStack) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    const dot = document.createElement("span");
    dot.className = "toast__dot";
    const text = document.createElement("span");
    text.textContent = msg;
    toast.appendChild(dot);
    toast.appendChild(text);
    dom.toastStack.appendChild(toast);
    setTimeout(function () {
      toast.remove();
    }, 2400);
  }

  function applyTheme(theme) {
    state.theme = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", state.theme);
    safeStorageSet(STORAGE_THEME, state.theme);
    if (dom.themeIcon && dom.themeToggle) {
      const isDark = state.theme === "dark";
      dom.themeIcon.textContent = isDark ? "SUN" : "DRK";
      dom.themeToggle.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
      dom.themeToggle.setAttribute("aria-pressed", String(!isDark));
    }
  }

  /* ------------------------------------------------------------------------
     Workbench Rendering
     ------------------------------------------------------------------------ */
  function renderDatasetPills() {
    if (!dom.datasetPills) return;
    dom.datasetPills.innerHTML = "";
    const items = state.mode === "vision" ? Data.VISION_SCENES : Data.NLP_DOCS;
    const activeId = state.mode === "vision" ? state.visionSceneId : state.nlpDocId;

    items.forEach(function (item) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dataset-pill" + (item.id === activeId ? " is-active" : "");
      btn.textContent = item.label;
      btn.setAttribute("aria-pressed", String(item.id === activeId));
      btn.addEventListener("click", function () {
        if (state.mode === "vision") {
          state.visionSceneId = item.id;
          visionEngine.setScene(item.id, state.visionCache[item.id]);
          dom.visionFileName.textContent = item.fileName + " · 960×540";
        } else {
          state.nlpDocId = item.id;
          nlpEngine.setDocument(item.id, state.nlpCache[item.id]);
          dom.nlpDocName.textContent = item.docId;
        }
        renderDatasetPills();
      });
      dom.datasetPills.appendChild(btn);
    });
  }

  function renderClassPalette() {
    if (!dom.classPalette) return;
    dom.classPalette.innerHTML = "";
    const classes = state.mode === "vision" ? Data.VISION_CLASSES : Data.NLP_CLASSES;
    const activeId = state.mode === "vision" ? state.visionClassId : state.nlpClassId;

    classes.forEach(function (cls) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "class-btn" + (cls.id === activeId ? " is-active" : "");
      btn.style.setProperty("--class-color", cls.color);
      btn.setAttribute("aria-pressed", String(cls.id === activeId));

      const dot = document.createElement("span");
      dot.className = "class-swatch";
      const label = document.createElement("span");
      label.textContent = cls.name;

      btn.appendChild(dot);
      btn.appendChild(label);
      btn.addEventListener("click", function () {
        if (state.mode === "vision") {
          state.visionClassId = cls.id;
          visionEngine.setActiveClass(cls.id);
        } else {
          state.nlpClassId = cls.id;
          nlpEngine.setActiveClass(cls.id);
        }
        renderClassPalette();
      });
      dom.classPalette.appendChild(btn);
    });
  }

  function renderExportTabs() {
    if (!dom.exportTabs) return;
    dom.exportTabs.innerHTML = "";
    const labels = state.mode === "vision"
      ? [
          { id: "primary", label: "COCO JSON" },
          { id: "secondary", label: "YOLO .txt" }
        ]
      : [
          { id: "primary", label: "JSON" },
          { id: "secondary", label: "JSONL" }
        ];

    labels.forEach(function (tab) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "export-tab" + (state.exportFormat === tab.id ? " is-active" : "");
      btn.textContent = tab.label;
      btn.addEventListener("click", function () {
        state.exportFormat = tab.id;
        renderExportTabs();
        renderExportOutput();
      });
      dom.exportTabs.appendChild(btn);
    });
  }

  function renderExportOutput() {
    if (!dom.exportOutput) return;
    if (state.mode === "vision") {
      dom.exportOutput.textContent = state.exportFormat === "primary"
        ? visionEngine.exportCoco()
        : visionEngine.exportYolo();
    } else {
      dom.exportOutput.textContent = state.exportFormat === "primary"
        ? nlpEngine.exportPrettyJson()
        : nlpEngine.exportJsonl();
    }
  }

  function renderInspectorList(items, selectedId) {
    if (!dom.annotationList || !dom.inspectorCount) return;
    dom.inspectorCount.textContent = String(items.length);
    dom.annotationList.innerHTML = "";

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.style.margin = "0.5rem 0";
      empty.style.fontSize = "0.84rem";
      empty.style.color = "var(--ink-muted)";
      empty.textContent = state.mode === "vision"
        ? "Drag anywhere on the canvas to draw a bounding box."
        : "Click or drag across words to tag an entity span.";
      dom.annotationList.appendChild(empty);
      renderExportOutput();
      return;
    }

    items.forEach(function (item) {
      const row = document.createElement("div");
      row.className = "annotation-row" + (item.id === selectedId ? " is-selected" : "");

      const cls = state.mode === "vision"
        ? Data.getVisionClass(item.classId)
        : Data.getNlpClass(item.classId);

      const left = document.createElement("div");
      left.className = "annotation-row__left";
      const swatch = document.createElement("span");
      swatch.className = "class-swatch";
      swatch.style.setProperty("--class-color", cls.color);

      const label = document.createElement("span");
      label.className = "annotation-row__label";
      label.textContent = state.mode === "vision" ? cls.name : item.text;

      const coords = document.createElement("span");
      coords.className = "annotation-row__coords";
      coords.textContent = state.mode === "vision"
        ? "[" + item.x + ", " + item.y + ", " + item.w + ", " + item.h + "]"
        : cls.name + " · " + item.startChar + ":" + item.endChar;

      left.appendChild(swatch);
      left.appendChild(label);
      left.appendChild(coords);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "annotation-row__del";
      del.setAttribute("aria-label", "Delete annotation");
      del.textContent = "×";
      del.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (state.mode === "vision") {
          visionEngine.deleteBox(item.id);
        } else {
          nlpEngine.deleteEntity(item.id);
        }
      });

      if (state.mode === "vision") {
        row.addEventListener("click", function () {
          visionEngine.selectBox(item.id);
        });
      }

      row.appendChild(left);
      row.appendChild(del);
      dom.annotationList.appendChild(row);
    });

    renderExportOutput();
  }

  function setWorkbenchMode(mode) {
    state.mode = mode;
    const isVision = mode === "vision";

    dom.modeTabs.forEach(function (tab) {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
    });

    dom.visionStage.hidden = !isVision;
    dom.nlpStage.hidden = isVision;
    if (dom.labelsToggleBtn) dom.labelsToggleBtn.hidden = !isVision;

    renderDatasetPills();
    renderClassPalette();
    renderExportTabs();

    if (isVision) {
      const boxes = visionEngine.getBoxes();
      renderInspectorList(boxes, null);
      visionEngine.render();
    } else {
      renderInspectorList(nlpEngine.getEntities(), null);
    }
  }

  /* ------------------------------------------------------------------------
     QA Confidence Threshold Simulator & Pricing
     ------------------------------------------------------------------------ */
  function updateQaSimulator() {
    if (!dom.qaSlider) return;
    const threshold = Number(dom.qaSlider.value); // 0.60 - 0.98
    const autoApproved = Math.max(18, Math.min(96, Math.round((1.05 - threshold) * 215)));
    const humanQueue = 100 - autoApproved;
    const throughput = Math.round(420 + (1 - threshold) * 2400);

    dom.qaThresholdVal.textContent = threshold.toFixed(2);
    dom.qaAutoPct.textContent = autoApproved + "%";
    dom.qaReviewPct.textContent = humanQueue + "%";
    dom.qaThroughput.textContent = throughput.toLocaleString("en-US") + "/hr";
  }

  function updateBilling(period) {
    state.billing = period;
    dom.billingBtns.forEach(function (btn) {
      const active = btn.dataset.billing === period;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    if (dom.studioPrice && dom.studioNote) {
      if (period === "annual") {
        dom.studioPrice.textContent = "$39";
        dom.studioNote.textContent = "per seat / month · billed annually (-20%)";
      } else {
        dom.studioPrice.textContent = "$49";
        dom.studioNote.textContent = "per seat / month · cancel anytime";
      }
    }
  }

  /* ------------------------------------------------------------------------
     Event Bindings
     ------------------------------------------------------------------------ */
  function bindEvents() {
    if (dom.themeToggle) {
      dom.themeToggle.addEventListener("click", function () {
        applyTheme(state.theme === "dark" ? "light" : "dark");
      });
    }

    if (dom.mobileMenuBtn && dom.mobileNav) {
      dom.mobileMenuBtn.addEventListener("click", function () {
        const open = dom.mobileNav.classList.toggle("is-open");
        dom.mobileMenuBtn.setAttribute("aria-expanded", String(open));
      });
      dom.mobileNav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          dom.mobileNav.classList.remove("is-open");
          dom.mobileMenuBtn.setAttribute("aria-expanded", "false");
        });
      });
    }

    dom.modeTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        setWorkbenchMode(tab.dataset.mode);
      });
    });

    if (dom.undoBtn) {
      dom.undoBtn.addEventListener("click", function () {
        const ok = state.mode === "vision" ? visionEngine.undo() : nlpEngine.undo();
        if (!ok) showToast("Nothing to undo");
      });
    }

    if (dom.labelsToggleBtn) {
      dom.labelsToggleBtn.addEventListener("click", function () {
        state.showLabels = !state.showLabels;
        visionEngine.setShowLabels(state.showLabels);
        dom.labelsToggleBtn.textContent = state.showLabels ? "Hide Labels" : "Show Labels";
        dom.labelsToggleBtn.setAttribute("aria-pressed", String(state.showLabels));
      });
    }

    if (dom.clearBtn) {
      dom.clearBtn.addEventListener("click", function () {
        if (state.mode === "vision") {
          visionEngine.clearBoxes();
        } else {
          nlpEngine.clearEntities();
        }
        showToast("Cleared annotations");
      });
    }

    if (dom.resetBtn) {
      dom.resetBtn.addEventListener("click", function () {
        if (state.mode === "vision") {
          visionEngine.resetScene();
        } else {
          nlpEngine.resetDocument();
        }
        showToast("Restored starter annotations");
      });
    }

    if (dom.copyExportBtn) {
      dom.copyExportBtn.addEventListener("click", function () {
        const text = dom.exportOutput.textContent || "";
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            showToast("Copied export to clipboard");
          }).catch(function () {
            showToast("Copy unavailable in this context");
          });
        } else {
          showToast("Clipboard API unavailable");
        }
      });
    }

    if (dom.downloadExportBtn) {
      dom.downloadExportBtn.addEventListener("click", function () {
        const content = dom.exportOutput.textContent || "";
        const ext = state.mode === "vision"
          ? (state.exportFormat === "primary" ? "coco.json" : "labels.txt")
          : (state.exportFormat === "primary" ? "entities.json" : "entities.jsonl");
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "labelgrid_" + ext;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast("Downloaded labelgrid_" + ext);
      });
    }

    if (dom.qaSlider) {
      dom.qaSlider.addEventListener("input", updateQaSimulator);
    }

    dom.billingBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        updateBilling(btn.dataset.billing);
      });
    });

    dom.faqTriggers.forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        const expanded = trigger.getAttribute("aria-expanded") === "true";
        const panel = document.getElementById(trigger.getAttribute("aria-controls"));
        trigger.setAttribute("aria-expanded", String(!expanded));
        if (panel) panel.classList.toggle("is-open", !expanded);
      });
    });

    if (dom.waitlistForm) {
      dom.waitlistForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        const email = dom.waitlistEmail.value.trim();
        const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        dom.waitlistFeedback.classList.remove("form-feedback--error", "form-feedback--success");
        if (!valid) {
          dom.waitlistFeedback.textContent = "Enter a valid work or research email.";
          dom.waitlistFeedback.classList.add("form-feedback--error");
          dom.waitlistEmail.focus();
          return;
        }
        dom.waitlistFeedback.textContent = "Sandbox API invite queued for " + email + ".";
        dom.waitlistFeedback.classList.add("form-feedback--success");
        dom.waitlistForm.reset();
        showToast("API waitlist request recorded");
      });
    }

    document.addEventListener("keydown", function (ev) {
      const tag = ev.target && ev.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        if (state.mode === "vision") visionEngine.undo();
        else nlpEngine.undo();
      } else if ((ev.key === "Delete" || ev.key === "Backspace") && state.mode === "vision") {
        if (visionEngine.deleteBox()) {
          ev.preventDefault();
        }
      }
    });
  }

  function init() {
    cacheDom();
    applyTheme(state.theme);

    visionEngine = global.LabelGridVision.create(dom.visionCanvas, {
      onChange: function (boxes, selectedId) {
        state.visionCache[state.visionSceneId] = boxes;
        if (state.mode === "vision") {
          renderInspectorList(boxes, selectedId);
        }
      }
    });

    nlpEngine = global.LabelGridNlp.create(dom.nlpTokens, {
      onChange: function (entities) {
        state.nlpCache[state.nlpDocId] = entities;
        if (state.mode === "nlp") {
          renderInspectorList(entities, null);
        }
      }
    });

    const initialScene = Data.VISION_SCENES[0];
    const initialDoc = Data.NLP_DOCS[0];
    dom.visionFileName.textContent = initialScene.fileName + " · 960×540";
    dom.nlpDocName.textContent = initialDoc.docId;

    visionEngine.setScene(initialScene.id);
    nlpEngine.setDocument(initialDoc.id);
    setWorkbenchMode("vision");
    updateQaSimulator();
    updateBilling("monthly");
    bindEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
