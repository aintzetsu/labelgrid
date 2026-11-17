/* ==========================================================================
   LabelGrid — Interactive Canvas Bounding-Box Engine
   ========================================================================== */

(function (global) {
  "use strict";

  const Data = global.LabelGridData;
  const LOGICAL_W = 960;
  const LOGICAL_H = 540;

  function createVisionEngine(canvas, callbacks) {
    const ctx = canvas.getContext("2d");
    let sceneId = Data.VISION_SCENES[0].id;
    let boxes = [];
    let history = [];
    let activeClassId = Data.VISION_CLASSES[0].id;
    let selectedBoxId = null;
    let showLabels = true;
    let pointerPos = null;

    // Drag / draw interaction state
    let dragMode = null; // "draw" | "move"
    let dragStart = null;
    let draftRect = null;
    let moveOffset = null;
    let boxCounter = 100;

    function cloneBoxes(list) {
      return list.map(function (b) {
        return Object.assign({}, b);
      });
    }

    function pushHistory() {
      history.push(cloneBoxes(boxes));
      if (history.length > 30) history.shift();
    }

    function notifyChange() {
      if (callbacks && callbacks.onChange) {
        callbacks.onChange(getBoxes(), selectedBoxId);
      }
    }

    function setScene(nextSceneId, initialBoxes) {
      sceneId = nextSceneId;
      const scene = Data.VISION_SCENES.find(function (s) {
        return s.id === sceneId;
      }) || Data.VISION_SCENES[0];
      boxes = cloneBoxes(initialBoxes || scene.starterBoxes);
      history = [];
      selectedBoxId = null;
      render();
      notifyChange();
    }

    function resetScene() {
      const scene = Data.VISION_SCENES.find(function (s) {
        return s.id === sceneId;
      }) || Data.VISION_SCENES[0];
      pushHistory();
      boxes = cloneBoxes(scene.starterBoxes);
      selectedBoxId = null;
      render();
      notifyChange();
    }

    function clearBoxes() {
      if (boxes.length === 0) return;
      pushHistory();
      boxes = [];
      selectedBoxId = null;
      render();
      notifyChange();
    }

    function undo() {
      if (history.length === 0) return false;
      boxes = history.pop();
      if (!boxes.some(function (b) { return b.id === selectedBoxId; })) {
        selectedBoxId = null;
      }
      render();
      notifyChange();
      return true;
    }

    function deleteBox(id) {
      const targetId = id || selectedBoxId;
      if (!targetId) return false;
      pushHistory();
      boxes = boxes.filter(function (b) {
        return b.id !== targetId;
      });
      if (selectedBoxId === targetId) selectedBoxId = null;
      render();
      notifyChange();
      return true;
    }

    function selectBox(id) {
      selectedBoxId = id;
      render();
      notifyChange();
    }

    function setActiveClass(classId) {
      activeClassId = classId;
    }

    function setShowLabels(flag) {
      showLabels = Boolean(flag);
      render();
    }

    function getBoxes() {
      return cloneBoxes(boxes);
    }

    function toLogicalPoint(ev) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = LOGICAL_W / rect.width;
      const scaleY = LOGICAL_H / rect.height;
      return {
        x: Math.max(0, Math.min(LOGICAL_W, (ev.clientX - rect.left) * scaleX)),
        y: Math.max(0, Math.min(LOGICAL_H, (ev.clientY - rect.top) * scaleY))
      };
    }

    function hitTestBox(pt) {
      for (let i = boxes.length - 1; i >= 0; i--) {
        const b = boxes[i];
        if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) {
          return b;
        }
      }
      return null;
    }

    function render() {
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      if (canvas.width !== LOGICAL_W * dpr || canvas.height !== LOGICAL_H * dpr) {
        canvas.width = LOGICAL_W * dpr;
        canvas.height = LOGICAL_H * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);

      Data.drawSceneBackground(ctx, sceneId, LOGICAL_W, LOGICAL_H);

      // Crosshair guide lines
      if (pointerPos && dragMode !== "move") {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pointerPos.x, 0);
        ctx.lineTo(pointerPos.x, LOGICAL_H);
        ctx.moveTo(0, pointerPos.y);
        ctx.lineTo(LOGICAL_W, pointerPos.y);
        ctx.stroke();
        ctx.restore();
      }

      // Draw saved boxes
      boxes.forEach(function (box) {
        const cls = Data.getVisionClass(box.classId);
        const isSelected = box.id === selectedBoxId;

        ctx.save();
        ctx.fillStyle = cls.color + (isSelected ? "36" : "1c");
        ctx.fillRect(box.x, box.y, box.w, box.h);

        ctx.strokeStyle = cls.color;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(box.x, box.y, box.w, box.h);

        if (isSelected) {
          ctx.fillStyle = "#ffffff";
          [
            [box.x, box.y],
            [box.x + box.w, box.y],
            [box.x, box.y + box.h],
            [box.x + box.w, box.y + box.h]
          ].forEach(function (corner) {
            ctx.fillRect(corner[0] - 4, corner[1] - 4, 8, 8);
            ctx.strokeRect(corner[0] - 4, corner[1] - 4, 8, 8);
          });
        }

        if (showLabels) {
          const text = cls.name + " " + (box.conf === 1 ? "human" : Math.round(box.conf * 100) + "%");
          ctx.font = "600 12px monospace";
          const tw = ctx.measureText(text).width + 12;
          const ly = box.y > 24 ? box.y - 22 : box.y + 4;
          ctx.fillStyle = cls.color;
          ctx.fillRect(box.x, ly, tw, 20);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(text, box.x + 6, ly + 14);
        }
        ctx.restore();
      });

      // Draft box while dragging
      if (draftRect) {
        const cls = Data.getVisionClass(activeClassId);
        ctx.save();
        ctx.fillStyle = cls.color + "28";
        ctx.fillRect(draftRect.x, draftRect.y, draftRect.w, draftRect.h);
        ctx.strokeStyle = cls.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(draftRect.x, draftRect.y, draftRect.w, draftRect.h);
        ctx.setLineDash([]);
        ctx.fillStyle = cls.color;
        ctx.font = "600 12px monospace";
        const dimText = Math.round(draftRect.w) + " x " + Math.round(draftRect.h) + " px";
        ctx.fillText(dimText, draftRect.x + 6, Math.max(16, draftRect.y - 8));
        ctx.restore();
      }
    }

    canvas.addEventListener("pointerdown", function (ev) {
      const pt = toLogicalPoint(ev);
      pointerPos = pt;
      const hit = hitTestBox(pt);

      if (hit) {
        pushHistory();
        dragMode = "move";
        selectedBoxId = hit.id;
        moveOffset = { x: pt.x - hit.x, y: pt.y - hit.y };
        canvas.setPointerCapture(ev.pointerId);
        render();
        notifyChange();
        return;
      }

      selectedBoxId = null;
      dragMode = "draw";
      dragStart = pt;
      draftRect = { x: pt.x, y: pt.y, w: 0, h: 0 };
      canvas.setPointerCapture(ev.pointerId);
      render();
      notifyChange();
    });

    canvas.addEventListener("pointermove", function (ev) {
      const pt = toLogicalPoint(ev);
      pointerPos = pt;

      if (dragMode === "draw" && dragStart) {
        draftRect = {
          x: Math.min(dragStart.x, pt.x),
          y: Math.min(dragStart.y, pt.y),
          w: Math.abs(pt.x - dragStart.x),
          h: Math.abs(pt.y - dragStart.y)
        };
      } else if (dragMode === "move" && selectedBoxId && moveOffset) {
        const target = boxes.find(function (b) {
          return b.id === selectedBoxId;
        });
        if (target) {
          target.x = Math.round(Math.max(0, Math.min(LOGICAL_W - target.w, pt.x - moveOffset.x)));
          target.y = Math.round(Math.max(0, Math.min(LOGICAL_H - target.h, pt.y - moveOffset.y)));
        }
      }
      render();
    });

    canvas.addEventListener("pointerup", function (ev) {
      if (dragMode === "draw" && draftRect) {
        if (draftRect.w >= 14 && draftRect.h >= 14) {
          pushHistory();
          const newBox = {
            id: "bx-" + (++boxCounter),
            classId: activeClassId,
            x: Math.round(draftRect.x),
            y: Math.round(draftRect.y),
            w: Math.round(draftRect.w),
            h: Math.round(draftRect.h),
            conf: 1
          };
          boxes.push(newBox);
          selectedBoxId = newBox.id;
          notifyChange();
        }
      } else if (dragMode === "move") {
        notifyChange();
      }

      dragMode = null;
      dragStart = null;
      draftRect = null;
      moveOffset = null;
      if (canvas.hasPointerCapture(ev.pointerId)) {
        canvas.releasePointerCapture(ev.pointerId);
      }
      render();
    });

    canvas.addEventListener("pointerleave", function () {
      if (!dragMode) {
        pointerPos = null;
        render();
      }
    });

    function exportCoco() {
      const scene = Data.VISION_SCENES.find(function (s) {
        return s.id === sceneId;
      }) || Data.VISION_SCENES[0];
      return JSON.stringify(
        {
          image: {
            file_name: scene.fileName,
            width: LOGICAL_W,
            height: LOGICAL_H
          },
          annotations: boxes.map(function (b, idx) {
            const cls = Data.getVisionClass(b.classId);
            return {
              id: idx + 1,
              category: cls.name,
              category_id: cls.yoloId,
              bbox: [b.x, b.y, b.w, b.h],
              source: b.conf === 1 ? "human" : "prelabel",
              confidence: b.conf
            };
          })
        },
        null,
        2
      );
    }

    function exportYolo() {
      if (boxes.length === 0) return "# No bounding boxes in scene";
      return boxes
        .map(function (b) {
          const cls = Data.getVisionClass(b.classId);
          const xc = ((b.x + b.w / 2) / LOGICAL_W).toFixed(4);
          const yc = ((b.y + b.h / 2) / LOGICAL_H).toFixed(4);
          const wn = (b.w / LOGICAL_W).toFixed(4);
          const hn = (b.h / LOGICAL_H).toFixed(4);
          return [cls.yoloId, xc, yc, wn, hn].join(" ");
        })
        .join("\n");
    }

    return {
      setScene: setScene,
      resetScene: resetScene,
      clearBoxes: clearBoxes,
      undo: undo,
      deleteBox: deleteBox,
      selectBox: selectBox,
      setActiveClass: setActiveClass,
      setShowLabels: setShowLabels,
      getBoxes: getBoxes,
      exportCoco: exportCoco,
      exportYolo: exportYolo,
      render: render
    };
  }

  global.LabelGridVision = {
    create: createVisionEngine
  };
})(window);
