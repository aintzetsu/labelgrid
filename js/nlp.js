/* ==========================================================================
   LabelGrid — Interactive Text / NER Span Tagging Engine
   ========================================================================== */

(function (global) {
  "use strict";

  const Data = global.LabelGridData;

  function buildTokens(text) {
    const tokens = [];
    const regex = /\S+/g;
    let match;
    let idx = 0;
    while ((match = regex.exec(text)) !== null) {
      tokens.push({
        index: idx++,
        text: match[0],
        startChar: match.index,
        endChar: match.index + match[0].length
      });
    }
    return tokens;
  }

  function createNlpEngine(container, callbacks) {
    let currentDoc = Data.NLP_DOCS[0];
    let tokens = buildTokens(currentDoc.text);
    let entities = [];
    let history = [];
    let activeClassId = Data.NLP_CLASSES[0].id;
    let entCounter = 100;

    let isSelecting = false;
    let anchorIndex = null;
    let focusIndex = null;

    function cloneEntities(list) {
      return list.map(function (e) {
        return Object.assign({}, e);
      });
    }

    function sortEntities(list) {
      return list.slice().sort(function (a, b) {
        return a.startToken - b.startToken;
      });
    }

    function pushHistory() {
      history.push(cloneEntities(entities));
      if (history.length > 30) history.shift();
    }

    function notifyChange() {
      if (callbacks && callbacks.onChange) {
        callbacks.onChange(getEnrichedEntities());
      }
    }

    function getEnrichedEntities() {
      return sortEntities(entities).map(function (ent) {
        const startTok = tokens[ent.startToken];
        const endTok = tokens[ent.endToken];
        return {
          id: ent.id,
          classId: ent.classId,
          startToken: ent.startToken,
          endToken: ent.endToken,
          startChar: startTok ? startTok.startChar : 0,
          endChar: endTok ? endTok.endChar : 0,
          text: startTok && endTok ? currentDoc.text.slice(startTok.startChar, endTok.endChar) : ""
        };
      });
    }

    function setDocument(docId, savedEntities) {
      currentDoc = Data.NLP_DOCS.find(function (d) {
        return d.id === docId;
      }) || Data.NLP_DOCS[0];
      tokens = buildTokens(currentDoc.text);
      entities = sortEntities(cloneEntities(savedEntities || currentDoc.starterEntities));
      history = [];
      render();
      notifyChange();
    }

    function resetDocument() {
      pushHistory();
      entities = sortEntities(cloneEntities(currentDoc.starterEntities));
      render();
      notifyChange();
    }

    function clearEntities() {
      if (entities.length === 0) return;
      pushHistory();
      entities = [];
      render();
      notifyChange();
    }

    function undo() {
      if (history.length === 0) return false;
      entities = history.pop();
      render();
      notifyChange();
      return true;
    }

    function deleteEntity(id) {
      pushHistory();
      entities = entities.filter(function (e) {
        return e.id !== id;
      });
      render();
      notifyChange();
    }

    function setActiveClass(classId) {
      activeClassId = classId;
    }

    function addSpan(startIdx, endIdx) {
      const s = Math.min(startIdx, endIdx);
      const e = Math.max(startIdx, endIdx);
      pushHistory();
      // Remove overlapping spans so ranges stay crisp
      entities = entities.filter(function (item) {
        return item.endToken < s || item.startToken > e;
      });
      entities.push({
        id: "ent-" + (++entCounter),
        classId: activeClassId,
        startToken: s,
        endToken: e
      });
      entities = sortEntities(entities);
      render();
      notifyChange();
    }

    function updateSelectionHighlight() {
      if (!isSelecting || anchorIndex === null || focusIndex === null) return;
      const min = Math.min(anchorIndex, focusIndex);
      const max = Math.max(anchorIndex, focusIndex);
      container.querySelectorAll("[data-token-index]").forEach(function (el) {
        const idx = Number(el.dataset.tokenIndex);
        el.classList.toggle("is-selecting", idx >= min && idx <= max);
      });
    }

    function render() {
      if (!container) return;
      container.innerHTML = "";

      const sorted = sortEntities(entities);
      let cursor = 0;

      while (cursor < tokens.length) {
        const ent = sorted.find(function (item) {
          return item.startToken === cursor;
        });

        if (ent) {
          const cls = Data.getNlpClass(ent.classId);
          const spanText = tokens
            .slice(ent.startToken, ent.endToken + 1)
            .map(function (t) { return t.text; })
            .join(" ");

          const pill = document.createElement("span");
          pill.className = "nlp-entity";
          pill.style.setProperty("--entity-color", cls.color);

          const textSpan = document.createElement("span");
          textSpan.textContent = spanText;

          const tag = document.createElement("span");
          tag.className = "nlp-entity__tag";
          tag.textContent = cls.name;

          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "nlp-entity__del";
          delBtn.setAttribute("aria-label", "Remove " + cls.name + " tag from " + spanText);
          delBtn.textContent = "×";
          delBtn.addEventListener("click", function () {
            deleteEntity(ent.id);
          });

          pill.appendChild(textSpan);
          pill.appendChild(tag);
          pill.appendChild(delBtn);
          container.appendChild(pill);

          cursor = ent.endToken + 1;
          continue;
        }

        const tok = tokens[cursor];
        const btn = document.createElement("span");
        btn.className = "nlp-token";
        btn.dataset.tokenIndex = String(tok.index);
        btn.textContent = tok.text;

        btn.addEventListener("pointerdown", function (ev) {
          ev.preventDefault();
          isSelecting = true;
          anchorIndex = tok.index;
          focusIndex = tok.index;
          updateSelectionHighlight();
        });

        btn.addEventListener("pointerenter", function () {
          if (!isSelecting) return;
          focusIndex = tok.index;
          updateSelectionHighlight();
        });

        container.appendChild(btn);
        cursor += 1;
      }
    }

    global.addEventListener("pointerup", function () {
      if (!isSelecting) return;
      isSelecting = false;
      if (anchorIndex !== null && focusIndex !== null) {
        addSpan(anchorIndex, focusIndex);
      }
      anchorIndex = null;
      focusIndex = null;
    });

    function exportJsonl() {
      const enriched = getEnrichedEntities();
      return JSON.stringify({
        doc_id: currentDoc.docId,
        text: currentDoc.text,
        entities: enriched.map(function (e) {
          return {
            start: e.startChar,
            end: e.endChar,
            label: e.classId,
            text: e.text
          };
        })
      });
    }

    function exportPrettyJson() {
      return JSON.stringify(JSON.parse(exportJsonl()), null, 2);
    }

    return {
      setDocument: setDocument,
      resetDocument: resetDocument,
      clearEntities: clearEntities,
      undo: undo,
      deleteEntity: deleteEntity,
      setActiveClass: setActiveClass,
      getEntities: getEnrichedEntities,
      exportJsonl: exportJsonl,
      exportPrettyJson: exportPrettyJson
    };
  }

  global.LabelGridNlp = {
    create: createNlpEngine
  };
})(window);
