import { FlashcardDeckSpeaker, isSpeechSupported, stopBrowserSpeech } from "./tts.js";

const dataNode = document.querySelector(".flashcard-list-data");
const table = document.getElementById("flashcard-list-table");
const headRow = document.getElementById("flashcard-list-head");
const tableBody = document.getElementById("flashcard-list-body");
const studyButton = document.getElementById("study-mode-toggle");
const studyLabel = document.querySelector(".list-study-label");
const layoutButtons = document.querySelectorAll(".list-layout-btn");
const postcardToggle = document.getElementById("postcard-toggle");
const postcardPanel = document.getElementById("postcard-panel");
const postcardPlay = document.getElementById("postcard-play");
const postcardPause = document.getElementById("postcard-pause");
const postcardStop = document.getElementById("postcard-stop");
const postcardSpeed = document.getElementById("postcard-speed");
const postcardSpeedValue = document.getElementById("postcard-speed-value");
const postcardStatus = document.getElementById("postcard-status");

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
    const postcardSpeedStorageKey = `flashcard-postcard-speed-${flashcardId}`;
    const revealedCards = new Set();

    let isStudyMode = localStorage.getItem(studyStorageKey) === "true";
    let columnCount = Number(localStorage.getItem(columnsStorageKey) || 2);
    let postcardRate = Number(localStorage.getItem(postcardSpeedStorageKey) || 1);
    let deckSpeaker = null;

    if (![1, 2].includes(columnCount)) {
        columnCount = 2;
    }

    if (!Number.isFinite(postcardRate) || postcardRate < 0.5 || postcardRate > 1.8) {
        postcardRate = 1;
    }

    function formatRate(rate) {
        return `${Number(rate).toFixed(1)}x`;
    }

    function isRevealed(index) {
        return !isStudyMode || revealedCards.has(String(index));
    }

    function setPostcardStatus(text) {
        if (postcardStatus) {
            postcardStatus.textContent = text;
        }
    }

    function setPauseButton(isPaused) {
        if (!postcardPause) return;

        postcardPause.innerHTML = isPaused
            ? '<i class="fas fa-play mr-2"></i>Tiếp tục'
            : '<i class="fas fa-pause mr-2"></i>Tạm dừng';
    }

    function updatePostcardControls() {
        const supported = isSpeechSupported();

        [postcardToggle, postcardPlay, postcardPause, postcardStop, postcardSpeed].forEach((control) => {
            if (control) {
                control.disabled = !supported;
            }
        });

        if (!supported) {
            setPostcardStatus("Trình duyệt này chưa hỗ trợ đọc bằng giọng nói.");
        }

        if (postcardSpeed) {
            postcardSpeed.value = String(postcardRate);
        }

        if (postcardSpeedValue) {
            postcardSpeedValue.textContent = formatRate(postcardRate);
        }
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

        updatePostcardControls();
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

    function createRevealButton(index, label, extraClass = "") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `list-reveal-btn ${extraClass}`.trim();
        button.dataset.revealIndex = String(index);
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
            if (isRevealed(index)) {
                content.appendChild(createImage(card, index));
            } else {
                cell.classList.add("list-reveal-cell");
                cell.dataset.revealIndex = String(index);
                content.appendChild(createRevealButton(index, "Mở thẻ"));
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

        if (isRevealed(index)) {
            cell.textContent = card.meaning || "";
        } else {
            cell.classList.add("list-reveal-cell");
            cell.dataset.revealIndex = String(index);
            cell.appendChild(createRevealButton(index, "Mở thẻ", "list-meaning-cover"));
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
        revealedCards.clear();
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

    function getDeckSpeaker() {
        if (!deckSpeaker) {
            deckSpeaker = new FlashcardDeckSpeaker(cards, {
                rate: postcardRate,
                onCardStart: (card, index, total) => {
                    revealedCards.add(String(index));
                    renderTable();
                    setPostcardStatus(`Đang đọc ${index + 1}/${total}: ${card.vocabulary || card.meaning}`);
                },
                onPause: () => setPostcardStatus("Đã tạm dừng Postcard."),
                onResume: () => setPostcardStatus("Tiếp tục đọc bộ thẻ."),
                onStop: () => {
                    setPauseButton(false);
                    setPostcardStatus("Đã dừng Postcard.");
                },
                onDone: (total) => {
                    setPauseButton(false);
                    setPostcardStatus(`Đã đọc xong ${total} thẻ.`);
                },
                onError: () => {
                    setPauseButton(false);
                    setPostcardStatus("Không thể đọc bộ thẻ lúc này.");
                },
            });
        }

        deckSpeaker.setRate(postcardRate);
        return deckSpeaker;
    }

    table.addEventListener("click", (event) => {
        if (!isStudyMode) return;

        const target = event.target.closest("[data-reveal-index]");

        if (!target || !table.contains(target)) {
            return;
        }

        revealedCards.add(String(target.dataset.revealIndex));
        renderTable();
    });

    if (postcardToggle && postcardPanel) {
        postcardToggle.addEventListener("click", () => {
            const isOpen = postcardPanel.classList.toggle("is-open");
            postcardToggle.classList.toggle("is-active", isOpen);
            postcardToggle.setAttribute("aria-expanded", String(isOpen));
        });
    }

    if (postcardPlay) {
        postcardPlay.addEventListener("click", () => {
            if (!isSpeechSupported()) {
                setPostcardStatus("Trình duyệt này chưa hỗ trợ đọc bằng giọng nói.");
                return;
            }

            getDeckSpeaker().play(0);
        });
    }

    if (postcardPause) {
        postcardPause.addEventListener("click", () => {
            const speaker = getDeckSpeaker();

            if (!speaker.isPlaying) {
                return;
            }

            if (speaker.isPaused) {
                speaker.resume();
                setPauseButton(false);
            } else {
                speaker.pause();
                setPauseButton(true);
            }
        });
    }

    if (postcardStop) {
        postcardStop.addEventListener("click", () => {
            getDeckSpeaker().stop();
            setPauseButton(false);
        });
    }

    if (postcardSpeed) {
        postcardSpeed.addEventListener("input", () => {
            postcardRate = Number(postcardSpeed.value) || 1;
            localStorage.setItem(postcardSpeedStorageKey, String(postcardRate));
            if (postcardSpeedValue) {
                postcardSpeedValue.textContent = formatRate(postcardRate);
            }
            if (deckSpeaker) {
                deckSpeaker.setRate(postcardRate);
            }
        });
    }

    window.addEventListener("beforeunload", stopBrowserSpeech);

    updateControls();
    renderTable();
}
