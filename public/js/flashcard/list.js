const dataNode = document.querySelector(".flashcard-list-data");
const table = document.getElementById("flashcard-list-table");
const headRow = document.getElementById("flashcard-list-head");
const tableBody = document.getElementById("flashcard-list-body");
const studyButton = document.getElementById("study-mode-toggle");
const studyLabel = document.querySelector(".list-study-label");
const layoutButtons = document.querySelectorAll(".list-layout-btn");

if (dataNode && table && headRow && tableBody && studyButton) {
    let cards = [];

    try {
        cards = JSON.parse(dataNode.dataset.cards || "[]");
    } catch (error) {
        console.error("Không thể đọc dữ liệu flashcard list:", error);
    }

    const flashcardId = dataNode.dataset.flashcardId || "default";
    const studyStorageKey = `flashcard-list-study-mode-${flashcardId}`;
    const columnsStorageKey = `flashcard-list-columns-${flashcardId}`;
    const revealedItems = new Set();

    let isStudyMode = localStorage.getItem(studyStorageKey) === "true";
    let columnCount = Number(localStorage.getItem(columnsStorageKey) || 2);

    if (![1, 2].includes(columnCount)) {
        columnCount = 2;
    }

    function getRevealKey(index, field) {
        return `${index}-${field}`;
    }

    function isRevealed(index, field) {
        return !isStudyMode || revealedItems.has(getRevealKey(index, field));
    }

    function updateControls() {
        studyButton.classList.toggle("is-active", isStudyMode);
        studyButton.setAttribute("aria-pressed", String(isStudyMode));

        if (studyLabel) {
            studyLabel.textContent = isStudyMode ? "Tắt chế độ học" : "Chế độ học";
        }

        layoutButtons.forEach((button) => {
            const isActive = Number(button.dataset.columns) === columnCount;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
    }

    function createHeaderCell(text) {
        const cell = document.createElement("th");
        cell.textContent = text;
        cell.style.width = `${100 / (columnCount * 2)}%`;
        return cell;
    }

    function renderHeader() {
        headRow.innerHTML = "";

        for (let index = 0; index < columnCount; index += 1) {
            headRow.appendChild(createHeaderCell("Từ vựng"));
            headRow.appendChild(createHeaderCell("Nghĩa"));
        }
    }

    function createRevealButton(index, field, label, extraClass = "") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `list-reveal-btn ${extraClass}`.trim();
        button.dataset.revealIndex = String(index);
        button.dataset.revealField = field;
        button.setAttribute("aria-label", label);
        button.title = label;
        button.textContent = "?";
        return button;
    }

    function createImage(card, index) {
        const image = document.createElement("img");
        image.className = "list-card-thumb";
        image.src = card.previewUrl;
        image.alt = card.vocabulary || `Ảnh flashcard ${index + 1}`;
        image.loading = "lazy";
        return image;
    }

    function createVocabCell(card, index) {
        const cell = document.createElement("td");
        cell.className = "vocab";

        const content = document.createElement("div");
        content.className = "list-card-cell";

        if (card.previewUrl) {
            if (isRevealed(index, "image")) {
                content.appendChild(createImage(card, index));
            } else {
                cell.classList.add("list-reveal-cell");
                cell.dataset.revealIndex = String(index);
                cell.dataset.revealField = "image";
                content.appendChild(createRevealButton(index, "image", "Mở ảnh"));
            }
        }

        const vocabulary = document.createElement("span");
        vocabulary.textContent = card.vocabulary || "";
        content.appendChild(vocabulary);

        cell.appendChild(content);
        return cell;
    }

    function createMeaningCell(card, index) {
        const cell = document.createElement("td");
        cell.className = "meaning";

        if (isRevealed(index, "meaning")) {
            cell.textContent = card.meaning || "";
        } else {
            cell.classList.add("list-reveal-cell");
            cell.dataset.revealIndex = String(index);
            cell.dataset.revealField = "meaning";
            cell.appendChild(createRevealButton(index, "meaning", "Mở nghĩa", "list-meaning-cover"));
        }

        return cell;
    }

    function createEmptyCell() {
        const cell = document.createElement("td");
        cell.className = "list-empty-cell";
        cell.colSpan = 2;
        return cell;
    }

    function renderTable() {
        table.dataset.columns = String(columnCount);
        renderHeader();
        tableBody.innerHTML = "";

        for (let index = 0; index < cards.length; index += columnCount) {
            const row = document.createElement("tr");

            for (let offset = 0; offset < columnCount; offset += 1) {
                const cardIndex = index + offset;
                const card = cards[cardIndex];

                if (card) {
                    row.appendChild(createVocabCell(card, cardIndex));
                    row.appendChild(createMeaningCell(card, cardIndex));
                } else {
                    row.appendChild(createEmptyCell());
                }
            }

            tableBody.appendChild(row);
        }
    }

    studyButton.addEventListener("click", () => {
        isStudyMode = !isStudyMode;
        revealedItems.clear();
        localStorage.setItem(studyStorageKey, String(isStudyMode));
        updateControls();
        renderTable();
    });

    layoutButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const nextColumnCount = Number(button.dataset.columns);

            if (![1, 2].includes(nextColumnCount) || nextColumnCount === columnCount) {
                return;
            }

            columnCount = nextColumnCount;
            localStorage.setItem(columnsStorageKey, String(columnCount));
            updateControls();
            renderTable();
        });
    });

    table.addEventListener("click", (event) => {
        if (!isStudyMode) return;

        const target = event.target.closest("[data-reveal-index][data-reveal-field]");

        if (!target || !table.contains(target)) {
            return;
        }

        revealedItems.add(getRevealKey(target.dataset.revealIndex, target.dataset.revealField));
        renderTable();
    });

    updateControls();
    renderTable();
}
