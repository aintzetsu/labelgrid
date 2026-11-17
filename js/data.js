/* ==========================================================================
   LabelGrid — Datasets, Class Schemas & Procedural Vector Scene Renderer
   ========================================================================== */

(function (global) {
  "use strict";

  const VISION_CLASSES = [
    { id: "vehicle", name: "Vehicle", color: "#4f7cff", yoloId: 0 },
    { id: "pedestrian", name: "Pedestrian", color: "#22c55e", yoloId: 1 },
    { id: "signal", name: "Traffic Sign", color: "#f59e0b", yoloId: 2 },
    { id: "pallet", name: "Pallet / Forklift", color: "#06b6d4", yoloId: 3 },
    { id: "defect", name: "PCB Defect", color: "#f43f5e", yoloId: 4 }
  ];

  const NLP_CLASSES = [
    { id: "ORG", name: "ORG", color: "#4f7cff" },
    { id: "METRIC", name: "METRIC", color: "#22c55e" },
    { id: "DATE", name: "DATE", color: "#f59e0b" },
    { id: "ISSUE", name: "ISSUE", color: "#f43f5e" },
    { id: "LOC", name: "LOC", color: "#06b6d4" }
  ];

  const VISION_SCENES = [
    {
      id: "street",
      label: "Street Traffic",
      fileName: "street_cam_042.png",
      width: 960,
      height: 540,
      starterBoxes: [
        { id: "bx-1", classId: "vehicle", x: 112, y: 290, w: 196, h: 98, conf: 0.98 },
        { id: "bx-2", classId: "pedestrian", x: 374, y: 214, w: 54, h: 108, conf: 0.94 },
        { id: "bx-3", classId: "signal", x: 774, y: 84, w: 62, h: 168, conf: 0.97 }
      ]
    },
    {
      id: "warehouse",
      label: "Warehouse Robotics",
      fileName: "dock_aisle_09.png",
      width: 960,
      height: 540,
      starterBoxes: [
        { id: "bx-4", classId: "pallet", x: 462, y: 266, w: 196, h: 146, conf: 0.96 },
        { id: "bx-5", classId: "pallet", x: 128, y: 252, w: 158, h: 126, conf: 0.92 }
      ]
    },
    {
      id: "pcb",
      label: "PCB Inspection",
      fileName: "board_rev_c_118.png",
      width: 960,
      height: 540,
      starterBoxes: [
        { id: "bx-6", classId: "defect", x: 226, y: 194, w: 78, h: 62, conf: 0.91 },
        { id: "bx-7", classId: "vehicle", x: 374, y: 170, w: 210, h: 202, conf: 0.99 }
      ]
    }
  ];

  const NLP_DOCS = [
    {
      id: "incident",
      label: "Infra Telemetry",
      docId: "log_edge_2026_10.txt",
      text: "On 2026-10-14 Vercel Edge Router in Frankfurt reported p99 latency of 142ms during the Q4 inference rollout while Redis cache hit rate remained steady at 98.4%.",
      starterEntities: [
        { id: "ent-1", classId: "DATE", startToken: 1, endToken: 1 },
        { id: "ent-2", classId: "ORG", startToken: 2, endToken: 4 },
        { id: "ent-3", classId: "LOC", startToken: 6, endToken: 6 },
        { id: "ent-4", classId: "METRIC", startToken: 11, endToken: 11 }
      ]
    },
    {
      id: "clinical",
      label: "Clinical Note",
      docId: "trial_note_4092.txt",
      text: "Patient administered 250mg Metformin daily at Charite Berlin with HbA1c dropping by 1.4% over 12 weeks and zero adverse hypoglycemia events recorded.",
      starterEntities: [
        { id: "ent-5", classId: "METRIC", startToken: 2, endToken: 2 },
        { id: "ent-6", classId: "LOC", startToken: 6, endToken: 7 },
        { id: "ent-7", classId: "METRIC", startToken: 11, endToken: 11 }
      ]
    },
    {
      id: "fintech",
      label: "Support Ticket",
      docId: "ticket_ach_8831.txt",
      text: "Merchant flagged a duplicate ACH payout of $4280 on Nov-03 via Stripe Connect in Chicago causing temporary ledger reconciliation mismatch.",
      starterEntities: [
        { id: "ent-8", classId: "ISSUE", startToken: 3, endToken: 5 },
        { id: "ent-9", classId: "DATE", startToken: 9, endToken: 9 },
        { id: "ent-10", classId: "ORG", startToken: 11, endToken: 12 }
      ]
    }
  ];

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSceneBackground(ctx, sceneId, w, h) {
    if (sceneId === "street") {
      // Sky / Horizon gradient
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.45);
      sky.addColorStop(0, "#121a2b");
      sky.addColorStop(1, "#1e2a42");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Sidewalk & Buildings silhouette
      ctx.fillStyle = "#192132";
      ctx.fillRect(45, 70, 150, 145);
      ctx.fillRect(225, 95, 190, 120);
      ctx.fillRect(520, 60, 210, 155);
      ctx.fillStyle = "#2b364d";
      ctx.fillRect(0, 215, w, 34);

      // Asphalt Road
      ctx.fillStyle = "#161920";
      ctx.fillRect(0, 249, w, h - 249);

      // Dashed Center Lane
      ctx.fillStyle = "#d9a441";
      for (let x = 20; x < w; x += 82) {
        ctx.fillRect(x, 388, 44, 6);
      }

      // Crosswalk Stripes
      ctx.fillStyle = "#cbd5e1";
      for (let y = 262; y < 515; y += 36) {
        ctx.fillRect(368, y, 74, 18);
      }

      // Sedan (bottom-left)
      ctx.fillStyle = "#3b82f6";
      drawRoundedRect(ctx, 120, 316, 180, 62, 12);
      ctx.fill();
      ctx.fillStyle = "#93c5fd";
      drawRoundedRect(ctx, 154, 298, 108, 28, 8);
      ctx.fill();
      ctx.fillStyle = "#0b0d12";
      ctx.beginPath();
      ctx.arc(158, 378, 15, 0, Math.PI * 2);
      ctx.arc(262, 378, 15, 0, Math.PI * 2);
      ctx.fill();

      // Unlabeled Delivery Van (right lane — invites user to draw box!)
      ctx.fillStyle = "#e2e8f0";
      drawRoundedRect(ctx, 555, 260, 210, 96, 10);
      ctx.fill();
      ctx.fillStyle = "#64748b";
      drawRoundedRect(ctx, 705, 272, 46, 40, 5);
      ctx.fill();
      ctx.fillStyle = "#0b0d12";
      ctx.beginPath();
      ctx.arc(602, 358, 17, 0, Math.PI * 2);
      ctx.arc(722, 358, 17, 0, Math.PI * 2);
      ctx.fill();

      // Pedestrian 1 (near top crosswalk)
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(401, 236, 12, 0, Math.PI * 2);
      ctx.fill();
      drawRoundedRect(ctx, 386, 250, 30, 58, 8);
      ctx.fill();

      // Pedestrian 2 (unlabeled bottom crosswalk)
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.arc(466, 386, 11, 0, Math.PI * 2);
      ctx.fill();
      drawRoundedRect(ctx, 452, 399, 28, 54, 8);
      ctx.fill();

      // Traffic Signal Pole
      ctx.fillStyle = "#475569";
      ctx.fillRect(801, 145, 8, 104);
      ctx.fillStyle = "#0f172a";
      drawRoundedRect(ctx, 784, 92, 42, 92, 8);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(805, 114, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.arc(805, 138, 8, 0, Math.PI * 2);
      ctx.arc(805, 162, 8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (sceneId === "warehouse") {
      ctx.fillStyle = "#121722";
      ctx.fillRect(0, 0, w, h);

      // Perspective concrete grid
      ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 180);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 180; y <= h; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Back shelving bays
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, w, 180);
      for (let x = 50; x < 880; x += 180) {
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 4;
        ctx.strokeRect(x, 28, 150, 140);
        ctx.fillStyle = "#926239";
        ctx.fillRect(x + 14, 52, 54, 38);
        ctx.fillRect(x + 78, 52, 54, 38);
        ctx.fillRect(x + 14, 112, 118, 42);
      }

      // Yellow safety lane border
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 5;
      ctx.strokeRect(90, 220, 780, 260);

      // Pallet #1 (left)
      ctx.fillStyle = "#b45309";
      ctx.fillRect(140, 344, 135, 22);
      ctx.fillStyle = "#d97706";
      ctx.fillRect(150, 264, 54, 80);
      ctx.fillStyle = "#b47c3e";
      ctx.fillRect(208, 282, 56, 62);

      // AGV Forklift (center)
      ctx.fillStyle = "#06b6d4";
      drawRoundedRect(ctx, 505, 310, 138, 76, 10);
      ctx.fill();
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(540, 276, 68, 38);
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(472, 278, 12, 112);
      ctx.fillRect(472, 376, 36, 10);
      ctx.fillStyle = "#0b0d12";
      ctx.beginPath();
      ctx.arc(536, 392, 16, 0, Math.PI * 2);
      ctx.arc(616, 392, 16, 0, Math.PI * 2);
      ctx.fill();

      // Unlabeled Pallet #2 (right)
      ctx.fillStyle = "#a16207";
      ctx.fillRect(732, 322, 122, 22);
      ctx.fillStyle = "#ca8a04";
      ctx.fillRect(740, 250, 104, 72);
      return;
    }

    // PCB Surface Inspection
    ctx.fillStyle = "#0b3b28";
    ctx.fillRect(0, 0, w, h);

    // Copper trace lines
    ctx.strokeStyle = "#166544";
    ctx.lineWidth = 4;
    for (let y = 70; y < 480; y += 38) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(340, y);
      ctx.lineTo(390, y + 18);
      ctx.lineTo(920, y + 18);
      ctx.stroke();
    }

    // Gold Edge Pads
    ctx.fillStyle = "#eab308";
    for (let y = 80; y <= 430; y += 34) {
      ctx.fillRect(28, y, 28, 14);
      ctx.fillRect(904, y, 28, 14);
    }

    // Central QFP IC Chip
    ctx.fillStyle = "#181a1f";
    drawRoundedRect(ctx, 392, 186, 174, 168, 10);
    ctx.fill();
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const offset = 204 + i * 20;
      ctx.beginPath();
      ctx.moveTo(378, offset);
      ctx.lineTo(392, offset);
      ctx.moveTo(566, offset);
      ctx.lineTo(580, offset);
      ctx.stroke();
    }
    ctx.fillStyle = "#64748b";
    ctx.font = "600 13px monospace";
    ctx.fillText("LG-DSP-409", 436, 274);

    // Solder Bridge Defect (left)
    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.arc(250, 222, 10, 0, Math.PI * 2);
    ctx.arc(280, 222, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(250, 217, 30, 10);

    // Unlabeled Missing Pad Defect (bottom right)
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(674, 326, 48, 36);
    ctx.setLineDash([]);
  }

  function getVisionClass(classId) {
    return VISION_CLASSES.find(function (c) {
      return c.id === classId;
    }) || VISION_CLASSES[0];
  }

  function getNlpClass(classId) {
    return NLP_CLASSES.find(function (c) {
      return c.id === classId;
    }) || NLP_CLASSES[0];
  }

  global.LabelGridData = {
    VISION_CLASSES: VISION_CLASSES,
    NLP_CLASSES: NLP_CLASSES,
    VISION_SCENES: VISION_SCENES,
    NLP_DOCS: NLP_DOCS,
    drawSceneBackground: drawSceneBackground,
    getVisionClass: getVisionClass,
    getNlpClass: getNlpClass
  };
})(window);
