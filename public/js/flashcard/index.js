// Lấy phần tử HTML
const cardsContainer = document.getElementById("cards-container");
const prevButton = document.getElementById("prev");
const nextButton = document.getElementById("next");
const currentElement = document.getElementById("current");
const showButton = document.getElementById("show");
const hideButton = document.getElementById("hide");
const addContainer = document.getElementById("add-container");
const shuffleButton = document.getElementById("random"); // Nút trộn thẻ
const alertMessage = document.getElementById("alert");
const settingsToggleButton = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const settingsCloseButton = document.getElementById("settings-close");
const soundToggleButton = document.getElementById("sound-toggle");
const soundVolumeInput = document.getElementById("sound-volume");
const soundVolumeValue = document.getElementById("sound-volume-value");
// Lấy dữ liệu từ HTML (Pug đã render)
const cardData = document.querySelector(".card-data");
const flashcard = JSON.parse(cardData.getAttribute("data"));
const listCard = flashcard.cards;
listCard.forEach(card => {
    card.isDifficult = false;
});
const imageModeButtons = document.querySelectorAll(".image-mode-btn");
const IMAGE_DISPLAY_MODES = ["front", "back", "both"];
const imageModeStorageKey = `flashcard-image-display-mode-${flashcard._id}`;
let imageDisplayMode = localStorage.getItem(imageModeStorageKey) || "front";
if (!IMAGE_DISPLAY_MODES.includes(imageDisplayMode)) {
    imageDisplayMode = "front";
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    }[char]));
}

function hasJapaneseText(value) {
    return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(String(value || ""));
}

function getImageSearchQuery(card) {
    if (!card) return "";
    if (hasJapaneseText(card.vocabulary)) return card.vocabulary.trim();
    if (hasJapaneseText(card.meaning)) return card.meaning.trim();
    return (card.vocabulary || card.meaning || "").trim();
}

const soundEffects = (() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    let context = null;
    let masterGain = null;
    let isEnabled = true;
    let masterVolume = 0.9;
    const lastPlayedAt = new Map();

    function getContext() {
        if (!AudioContextClass) return null;
        if (!context) {
            context = new AudioContextClass();
            masterGain = context.createGain();
            masterGain.gain.value = masterVolume;
            masterGain.connect(context.destination);
        }

        if (context.state === "suspended") {
            context.resume().catch(() => {});
        }

        return context;
    }

    function canPlay(name, gap = 60) {
        if (!isEnabled) return false;
        const now = Date.now();
        const previous = lastPlayedAt.get(name) || 0;
        if (now - previous < gap) return false;
        lastPlayedAt.set(name, now);
        return true;
    }

    function scheduleNoise(options = {}) {
        const ctx = getContext();
        if (!ctx || !masterGain) return;

        const {
            duration = 0.08,
            gain = 0.08,
            frequency = 1800,
            endFrequency,
            filterType = "bandpass",
            q = 1,
            startOffset = 0,
            attack = 0.004,
            release = 0.045,
        } = options;
        const startAt = ctx.currentTime + startOffset;
        const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
        const output = buffer.getChannelData(0);

        for (let i = 0; i < frameCount; i += 1) {
            const fade = 1 - (i / frameCount) * 0.35;
            output[i] = (Math.random() * 2 - 1) * fade;
        }

        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const volume = ctx.createGain();

        source.buffer = buffer;
        filter.type = filterType;
        filter.frequency.setValueAtTime(frequency, startAt);
        if (endFrequency) {
            filter.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startAt + duration);
        }
        filter.Q.value = q;
        volume.gain.setValueAtTime(0.0001, startAt);
        volume.gain.linearRampToValueAtTime(gain, startAt + attack);
        volume.gain.exponentialRampToValueAtTime(0.0001, startAt + duration + release);

        source.connect(filter);
        filter.connect(volume);
        volume.connect(masterGain);
        source.start(startAt);
        source.stop(startAt + duration + release + 0.03);
    }

    function scheduleTone(options = {}) {
        const ctx = getContext();
        if (!ctx || !masterGain) return;

        const {
            frequency = 440,
            endFrequency,
            duration = 0.08,
            gain = 0.05,
            type = "sine",
            startOffset = 0,
            attack = 0.006,
            release = 0.06,
        } = options;
        const startAt = ctx.currentTime + startOffset;
        const oscillator = ctx.createOscillator();
        const volume = ctx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startAt);
        if (endFrequency) {
            oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startAt + duration);
        }
        volume.gain.setValueAtTime(0.0001, startAt);
        volume.gain.linearRampToValueAtTime(gain, startAt + attack);
        volume.gain.exponentialRampToValueAtTime(0.0001, startAt + duration + release);

        oscillator.connect(volume);
        volume.connect(masterGain);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration + release + 0.03);
    }

    return {
        setEnabled(value) {
            isEnabled = Boolean(value);
            if (!isEnabled && context?.state === "running") {
                context.suspend().catch(() => {});
            }
        },
        isEnabled() {
            return isEnabled;
        },
        setVolume(value) {
            masterVolume = Math.min(Math.max(Number(value) || 0, 0), 1.2);
            if (masterGain && context) {
                masterGain.gain.setTargetAtTime(masterVolume, context.currentTime, 0.015);
            }
        },
        flip() {
            if (!canPlay("flip", 110)) return;
            scheduleNoise({ duration: 0.075, gain: 0.07, frequency: 5200, endFrequency: 1600, filterType: "bandpass", q: 0.85, startOffset: 0, attack: 0.002, release: 0.025 });
            scheduleNoise({ duration: 0.06, gain: 0.04, frequency: 7600, endFrequency: 3200, filterType: "highpass", q: 0.65, startOffset: 0.022, attack: 0.001, release: 0.02 });
            scheduleTone({ frequency: 720, endFrequency: 1180, duration: 0.045, gain: 0.04, type: "triangle", startOffset: 0.062, attack: 0.003, release: 0.035 });
            scheduleTone({ frequency: 1320, endFrequency: 980, duration: 0.052, gain: 0.026, type: "sine", startOffset: 0.095, attack: 0.002, release: 0.04 });
            scheduleNoise({ duration: 0.032, gain: 0.026, frequency: 2800, endFrequency: 1200, filterType: "bandpass", q: 1.2, startOffset: 0.118, attack: 0.001, release: 0.028 });
        },
        known() {
            if (!canPlay("known", 120)) return;
            scheduleTone({ frequency: 620, endFrequency: 820, duration: 0.08, gain: 0.045, type: "triangle" });
            scheduleTone({ frequency: 980, duration: 0.11, gain: 0.035, type: "sine", startOffset: 0.07 });
            scheduleNoise({ duration: 0.045, gain: 0.018, frequency: 3200, filterType: "highpass", startOffset: 0.015 });
        },
        drop() {
            if (!canPlay("drop", 120)) return;
            scheduleTone({ frequency: 150, endFrequency: 72, duration: 0.18, gain: 0.08, type: "sine", startOffset: 0.16, release: 0.09 });
            scheduleNoise({ duration: 0.1, gain: 0.055, frequency: 180, filterType: "lowpass", q: 0.7, startOffset: 0.18, release: 0.08 });
        },
        move() {
            if (!canPlay("move", 85)) return;
            scheduleNoise({ duration: 0.09, gain: 0.06, frequency: 4600, endFrequency: 1500, filterType: "bandpass", q: 0.8, attack: 0.002, release: 0.03 });
            scheduleNoise({ duration: 0.055, gain: 0.038, frequency: 7200, endFrequency: 2600, filterType: "highpass", q: 0.55, startOffset: 0.025, attack: 0.001, release: 0.022 });
            scheduleTone({ frequency: 880, endFrequency: 520, duration: 0.055, gain: 0.032, type: "triangle", startOffset: 0.072, attack: 0.002, release: 0.035 });
            scheduleNoise({ duration: 0.028, gain: 0.024, frequency: 1800, endFrequency: 900, filterType: "bandpass", q: 1.1, startOffset: 0.095, attack: 0.001, release: 0.025 });
        },
        flag() {
            if (!canPlay("flag", 90)) return;
            scheduleTone({ frequency: 410, endFrequency: 520, duration: 0.055, gain: 0.03, type: "triangle" });
            scheduleNoise({ duration: 0.04, gain: 0.018, frequency: 1600, startOffset: 0.02 });
        },
        shuffle() {
            if (!canPlay("shuffle", 180)) return;
            scheduleNoise({ duration: 0.06, gain: 0.03, frequency: 1300, startOffset: 0 });
            scheduleNoise({ duration: 0.06, gain: 0.03, frequency: 2100, startOffset: 0.055 });
            scheduleNoise({ duration: 0.05, gain: 0.024, frequency: 900, startOffset: 0.105 });
        },
    };
})();

let isReversed = false;
let isDifficultMode = false;
let generatedCardId = 0;
const knownCardIds = new Set();
const soundStorageKey = "flashcard-sound-effects-enabled";
const soundVolumeStorageKey = "flashcard-sound-effects-volume";
let isSoundEnabled = localStorage.getItem(soundStorageKey) !== "false";
let soundVolumePercent = Number(localStorage.getItem(soundVolumeStorageKey) || 85);
if (!Number.isFinite(soundVolumePercent)) {
    soundVolumePercent = 85;
}
soundVolumePercent = Math.min(Math.max(soundVolumePercent, 0), 100);
soundEffects.setEnabled(isSoundEnabled);
soundEffects.setVolume((soundVolumePercent / 100) * 1.2);

// Chuyển đổi dữ liệu từ BE thành { question, answer }
function getCardId(card) {
    if (!card) return "";
    if (card._id || card.id) return String(card._id || card.id);
    if (!card.__localStudyId) {
        generatedCardId += 1;
        card.__localStudyId = `local-card-${generatedCardId}`;
    }
    return card.__localStudyId;
}

function mapCardToStudyData(card) {
    return {
        id: getCardId(card),
        question: isReversed ? card.meaning : card.vocabulary,
        answer: isReversed ? card.vocabulary : card.meaning,
        previewUrl: card.previewUrl || '',
        isDifficult: Boolean(card.isDifficult),
    };
}

function getVisibleSourceCards() {
    const sourceCards = isDifficultMode ? listCard.filter(card => card.isDifficult) : listCard;
    return sourceCards.filter(card => !knownCardIds.has(getCardId(card)));
}

let cardsData = getVisibleSourceCards().map(card => mapCardToStudyData(card));
let currentActiveCard = 0;
let cardsElement = [];
let suppressCardClick = false;
let isRemovingKnownCard = false;

function shouldShowImageOn(side) {
    return imageDisplayMode === "both" || imageDisplayMode === side;
}

function getImageHtml(data, side) {
    if (!data.previewUrl || !shouldShowImageOn(side)) return "";

    const altText = side === "front" ? data.question : data.answer;
    return `<img class="card-preview-image" src="${escapeHtml(data.previewUrl)}" alt="${escapeHtml(altText)}" loading="lazy">`;
}

function updateImageModeButtons() {
    imageModeButtons.forEach(button => {
        const isActive = button.dataset.imageMode === imageDisplayMode;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
}

function updateSoundToggleButton() {
    if (!soundToggleButton) return;

    soundToggleButton.classList.toggle("is-muted", !isSoundEnabled);
    soundToggleButton.setAttribute("aria-pressed", isSoundEnabled ? "true" : "false");
    soundToggleButton.setAttribute("title", isSoundEnabled ? "Tắt âm thanh hiệu ứng" : "Bật âm thanh hiệu ứng");
    soundToggleButton.innerHTML = isSoundEnabled
        ? '<i class="fas fa-volume-high"></i><span>Âm bật</span>'
        : '<i class="fas fa-volume-xmark"></i><span>Âm tắt</span>';
}

function updateSoundVolumeControl() {
    if (soundVolumeInput) {
        soundVolumeInput.value = String(soundVolumePercent);
        soundVolumeInput.disabled = !isSoundEnabled;
    }

    if (soundVolumeValue) {
        soundVolumeValue.innerText = `${soundVolumePercent}%`;
    }
}

function setSettingsPanelOpen(isOpen) {
    if (!settingsPanel || !settingsToggleButton) return;

    settingsPanel.classList.toggle("show", isOpen);
    settingsPanel.setAttribute("aria-hidden", isOpen ? "false" : "true");
    settingsToggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function updateDifficultButtonState(button, isDifficult) {
    button.classList.toggle("active", isDifficult);
    button.setAttribute("aria-pressed", isDifficult ? "true" : "false");
    button.setAttribute("title", isDifficult ? "Bỏ đánh dấu khó thuộc" : "Đánh dấu thẻ khó thuộc");
    button.setAttribute("aria-label", isDifficult ? "Bỏ đánh dấu khó thuộc" : "Đánh dấu thẻ khó thuộc");
}

function refreshVisibleCards(preferredCardId = "") {
    cardsData = getVisibleSourceCards().map(card => mapCardToStudyData(card));

    if (preferredCardId) {
        const preferredIndex = cardsData.findIndex(card => card.id === preferredCardId);
        currentActiveCard = preferredIndex === -1 ? 0 : preferredIndex;
    }

    if (currentActiveCard < 0 || currentActiveCard >= cardsData.length) {
        currentActiveCard = 0;
    }

    createCards();
}

function toggleDifficultCard(data, buttons) {
    const sourceCard = listCard.find(card => getCardId(card) === data.id);
    if (!sourceCard) return;

    sourceCard.isDifficult = !sourceCard.isDifficult;
    data.isDifficult = sourceCard.isDifficult;
    buttons.forEach(button => updateDifficultButtonState(button, data.isDifficult));
    soundEffects.flag();

    if (isDifficultMode && !sourceCard.isDifficult) {
        refreshVisibleCards();
    }
}

function showDifficultCards() {
    isDifficultMode = true;
    currentActiveCard = 0;
    refreshVisibleCards();

    const choiseContainer = document.getElementById("choise-container");
    if (choiseContainer) {
        choiseContainer.classList.remove("show");
    }
}

function getEmptyCardMessage() {
    const hasSourceCards = isDifficultMode
        ? listCard.some(card => card.isDifficult)
        : listCard.length > 0;

    if (hasSourceCards && knownCardIds.size > 0) {
        return "Bạn đã thuộc hết thẻ trong lượt này.";
    }

    return isDifficultMode ? "Chưa có thẻ khó thuộc nào." : "Chưa có thẻ nào.";
}

function revealNextCardBehind(currentCard) {
    if (cardsData.length <= 1) return;

    const nextVisibleIndex = currentActiveCard >= cardsData.length - 1 ? 0 : currentActiveCard + 1;
    const nextCard = cardsElement[nextVisibleIndex];
    if (!nextCard || nextCard === currentCard) return;

    nextCard.className = "card active known-card-reveal";
    nextCard.classList.remove("show-answer");
}

function markCardAsKnown(data, card, buttons) {
    if (isRemovingKnownCard || !data?.id) return;

    isRemovingKnownCard = true;
    soundEffects.known();
    soundEffects.drop();
    buttons.forEach(button => {
        button.disabled = true;
    });
    card.classList.remove("show-answer");
    revealNextCardBehind(card);
    card.classList.add("known-drop");

    let didFinish = false;
    const finishRemoval = () => {
        if (didFinish) return;
        didFinish = true;

        knownCardIds.add(data.id);
        cardsData = cardsData.filter(cardData => cardData.id !== data.id);

        if (currentActiveCard >= cardsData.length) {
            currentActiveCard = 0;
        }

        isRemovingKnownCard = false;
        createCards();
    };

    card.addEventListener("animationend", finishRemoval, { once: true });
    setTimeout(finishRemoval, 650);
}

// Tạo các card từ dữ liệu BE
function createCards() {
    cardsContainer.innerHTML = ""; // Xóa danh sách cũ
    cardsElement = []; // Xóa danh sách phần tử cũ
    if (cardsData.length === 0) {
        currentElement.innerText = "0/0";
        cardsContainer.innerHTML = `
            <div class="empty-card-message">
                ${getEmptyCardMessage()}
            </div>
        `;
        return;
    }

    currentActiveCard = Math.min(currentActiveCard, cardsData.length - 1);
    cardsData.forEach((data, index) => createCard(data, index));
}


function createCard(data, index) {
    const card = document.createElement("div");
    card.classList.add("card");
    if (index === currentActiveCard) card.classList.add("active");
    const frontImageHtml = getImageHtml(data, "front");
    const backImageHtml = getImageHtml(data, "back");
    const difficultButtonClass = data.isDifficult ? " active" : "";
    const difficultButtonLabel = data.isDifficult ? "Bỏ đánh dấu khó thuộc" : "Đánh dấu thẻ khó thuộc";
    const knownButtonLabel = "Đánh dấu đã thuộc";
    const actionButtonsHtml = `
        <button class="difficult-card-btn${difficultButtonClass}" type="button" data-card-id="${escapeHtml(data.id)}" title="${escapeHtml(difficultButtonLabel)}" aria-label="${escapeHtml(difficultButtonLabel)}" aria-pressed="${data.isDifficult ? "true" : "false"}">
            <i class="fa-solid fa-flag"></i>
        </button>
        <button class="known-card-btn" type="button" data-card-id="${escapeHtml(data.id)}" title="${escapeHtml(knownButtonLabel)}" aria-label="${escapeHtml(knownButtonLabel)}">
            <i class="fa-solid fa-check"></i>
        </button>
    `;
    card.innerHTML = `
        <div class="inner-card card-animation">
            <div class="inner-card-front">
                <div class="inner-card-content">
                    ${frontImageHtml}
                    <p style="font-size:1.5rem">${escapeHtml(data.question)}</p>
                </div>
                ${actionButtonsHtml}
                <button class="voice-btn front-voice" data-text="${escapeHtml(data.question)}"><i class="fa-solid fa-volume-high"></i></i></button>
            </div>
            <div class="inner-card-back">
                <div class="inner-card-content">
                    ${backImageHtml}
                    <p style="font-size:1.5rem">${escapeHtml(data.answer)}</p>
                </div>
                ${actionButtonsHtml}
                <button class="voice-btn back-voice" data-text="${escapeHtml(data.answer)}"><i class="fa-solid fa-volume-high"></i></button>
            </div>
        </div>
    `;
    card.addEventListener("click", () => {
        if (isRemovingKnownCard) return;
        if (suppressCardClick) {
            suppressCardClick = false;
            return;
        }

        card.classList.toggle("show-answer");
        soundEffects.flip();
    });

    const difficultButtons = card.querySelectorAll(".difficult-card-btn");
    difficultButtons.forEach(button => {
        button.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleDifficultCard(data, difficultButtons);
        });
    });

    const knownButtons = card.querySelectorAll(".known-card-btn");
    knownButtons.forEach(button => {
        button.addEventListener("click", (e) => {
            e.stopPropagation();
            markCardAsKnown(data, card, knownButtons);
        });
    });

    // Thêm sự kiện cho nút Voice trên mặt trước
    const frontVoiceBtn = card.querySelector(".front-voice");
    frontVoiceBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = frontVoiceBtn.getAttribute("data-text"); // Lấy từ <button>
        speakText(text);
    });

    // Thêm sự kiện cho nút Voice trên mặt sau
    const backVoiceBtn = card.querySelector(".back-voice");
    backVoiceBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = backVoiceBtn.getAttribute("data-text"); // Lấy từ <button>
        speakText(text);
    });

    cardsElement.push(card);
    cardsContainer.appendChild(card);
    updateCurrentText();
}

function detectSpeechLang(text) {
    if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) return "ja-JP";
    if (/[\uac00-\ud7af]/.test(text)) return "ko-KR";
    if (/[\u0e00-\u0e7f]/.test(text)) return "th-TH";
    if (/[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(text)) return "vi-VN";
    return "en-US";
}

function pickVoice(lang) {
    const voices = window.speechSynthesis.getVoices();
    return voices.find(voice => voice.lang === lang)
        || voices.find(voice => voice.lang && voice.lang.startsWith(lang.split("-")[0]))
        || null;
}

// Hàm đọc văn bản bằng TTS của trình duyệt
function speakText(text) {
    const speechText = String(text || "").trim();
    if (!speechText) return;

    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        alert("Trình duyệt không hỗ trợ đọc văn bản.");
        return;
    }

    window.speechSynthesis.cancel();

    const lang = detectSpeechLang(speechText);
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = lang;
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.voice = pickVoice(lang);

    window.speechSynthesis.speak(utterance);
}
function updateCurrentText() {
    currentElement.innerText = `${currentActiveCard + 1}/${cardsElement.length}`;
}

// Chuyển card tiếp theo
nextButton.addEventListener("click", () => {
    if (isRemovingKnownCard) return;
    if (cardsElement.length === 0) return;
    soundEffects.move();
    cardsElement[currentActiveCard].className = "card left";
    currentActiveCard++;
    if (currentActiveCard > cardsElement.length - 1) {
        currentActiveCard = 0;
    }
    cardsElement[currentActiveCard].className = "card active";
    updateCurrentText();
});

// Chuyển card trước đó
prevButton.addEventListener("click", () => {
    if (isRemovingKnownCard) return;
    if (cardsElement.length === 0) return;
    soundEffects.move();
    cardsElement[currentActiveCard].className = "card right";
    currentActiveCard--;
    if (currentActiveCard < 0) {
        currentActiveCard = cardsElement.length - 1;
    }
    cardsElement[currentActiveCard].className = "card active";
    updateCurrentText();
});

let swipeStartX = 0;
let swipeStartY = 0;
let swipeStartTime = 0;
let isSwipingCard = false;

cardsContainer.addEventListener("touchstart", (event) => {
    if (event.target.closest("button, a, input, textarea, select")) return;
    if (addContainer.classList.contains("show")) return;

    const touch = event.touches[0];
    if (!touch) return;

    swipeStartX = touch.clientX;
    swipeStartY = touch.clientY;
    swipeStartTime = Date.now();
    isSwipingCard = true;
}, { passive: true });

cardsContainer.addEventListener("touchend", (event) => {
    if (!isSwipingCard) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - swipeStartX;
    const deltaY = touch.clientY - swipeStartY;
    const elapsed = Date.now() - swipeStartTime;
    const isHorizontalSwipe = Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4;

    isSwipingCard = false;

    if (!isHorizontalSwipe || elapsed > 800 || cardsElement.length === 0) return;

    event.preventDefault();
    suppressCardClick = true;

    if (deltaX < 0) {
        nextButton.click();
    } else {
        prevButton.click();
    }

    setTimeout(() => {
        suppressCardClick = false;
    }, 250);
}, { passive: false });

// Mở form thêm card
showButton.addEventListener("click", () => addContainer.classList.add("show"));

// Đóng form thêm card
hideButton.addEventListener("click", () => {
    addContainer.classList.remove("show");
    document.getElementById("question").value = "";
    document.getElementById("answer").value = "";
    document.getElementById("previewUrl").value = "";
    document.getElementById("image-search-panel").innerHTML = "";
    location.reload();
});

// Trộn ngẫu nhiên danh sách thẻ
shuffleButton.addEventListener("click", () => {
    if (cardsData.length === 0) {
        alertMessage.innerText = "Không có thẻ để trộn!";
        setTimeout(() => {
            alertMessage.innerText = "";
        }, 2000);

        return;
    }

    soundEffects.shuffle();

    // Fisher-Yates shuffle
    for (let i = cardsData.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [cardsData[i], cardsData[j]] = [cardsData[j], cardsData[i]];
    }

    createCards(); // Cập nhật giao diện sau khi trộn
});

// Khởi tạo các card từ dữ liệu BE
updateImageModeButtons();
updateSoundToggleButton();
updateSoundVolumeControl();
createCards();

soundToggleButton?.addEventListener("click", () => {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem(soundStorageKey, isSoundEnabled ? "true" : "false");
    soundEffects.setEnabled(isSoundEnabled);
    updateSoundToggleButton();
    updateSoundVolumeControl();

    if (isSoundEnabled) {
        soundEffects.flip();
    }
});

soundVolumeInput?.addEventListener("input", () => {
    const nextVolume = Number(soundVolumeInput.value);
    soundVolumePercent = Number.isFinite(nextVolume) ? Math.min(Math.max(nextVolume, 0), 100) : 85;
    localStorage.setItem(soundVolumeStorageKey, String(soundVolumePercent));
    soundEffects.setVolume((soundVolumePercent / 100) * 1.2);
    updateSoundVolumeControl();
});

soundVolumeInput?.addEventListener("change", () => {
    if (isSoundEnabled) {
        soundEffects.flip();
    }
});

settingsToggleButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    setSettingsPanelOpen(!settingsPanel?.classList.contains("show"));
});

settingsCloseButton?.addEventListener("click", () => setSettingsPanelOpen(false));

settingsPanel?.addEventListener("click", (event) => {
    event.stopPropagation();
});

document.addEventListener("click", () => setSettingsPanelOpen(false));

imageModeButtons.forEach(button => {
    button.addEventListener("click", () => {
        imageDisplayMode = button.dataset.imageMode;
        localStorage.setItem(imageModeStorageKey, imageDisplayMode);
        updateImageModeButtons();
        soundEffects.move();
        createCards();
    });
});

// Thêm card mới
document.getElementById("add-card").addEventListener("click", async () => {
    const vocabulary = document.getElementById("question").value.trim();
    const meaning = document.getElementById("answer").value.trim();
    const previewUrl = document.getElementById("previewUrl").value.trim();
    const flashCardId = flashcard._id;

    if (!vocabulary || !meaning) {
        return;
    }

    try {
        const response = await fetch(`/flashcards/card/${flashCardId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({ vocabulary, meaning, previewUrl }),
        });

        if (!response.ok) {
            throw new Error("Lỗi khi gửi dữ liệu");
        }

        const responseData = await response.json();
        console.log(responseData.message); // Kiểm tra phản hồi từ server
        alertMessage.innerText = responseData.message;
        setTimeout(() => {
            alertMessage.innerText = "";
        }, 2000);

        const newCard = responseData.card || { vocabulary, meaning, previewUrl };
        newCard.isDifficult = false;
        listCard.push(newCard);
        refreshVisibleCards(getCardId(newCard));
        document.getElementById("question").value = "";
        document.getElementById("answer").value = "";
        previewUrlInput.value = "";
        imageSearchPanel.innerHTML = "";
    } catch (error) {
        console.error("Lỗi khi thêm thẻ:", error);
    }
});

const previewUrlInput = document.getElementById("previewUrl");
const searchCardImageButton = document.getElementById("search-card-image");
const imageSearchPanel = document.getElementById("image-search-panel");

function renderSelectedImage(url) {
    if (!url) {
        imageSearchPanel.innerHTML = "";
        return;
    }

    imageSearchPanel.innerHTML = `
        <div class="selected-image-preview">
            <img src="${escapeHtml(url)}" alt="Ảnh flashcard đã chọn" loading="lazy">
            <span>Ảnh đã chọn</span>
        </div>
    `;
}

previewUrlInput.addEventListener("input", () => renderSelectedImage(previewUrlInput.value.trim()));

searchCardImageButton.addEventListener("click", async () => {
    const query = getImageSearchQuery({
        vocabulary: document.getElementById("question").value,
        meaning: document.getElementById("answer").value,
    });
    if (!query) {
        imageSearchPanel.innerHTML = '<p class="image-search-message">Nhập câu hỏi hoặc trả lời trước để tìm ảnh.</p>';
        return;
    }

    imageSearchPanel.innerHTML = '<p class="image-search-message">Đang tìm ảnh...</p>';

    try {
        const response = await fetch(`/flashcards/image-search?q=${encodeURIComponent(query)}&num=8`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tìm ảnh");
        }

        const images = data.items || [];
        if (!images.length) {
            imageSearchPanel.innerHTML = '<p class="image-search-message">Không tìm thấy ảnh phù hợp.</p>';
            return;
        }

        imageSearchPanel.innerHTML = `
            <div class="image-result-grid">
                ${images.map((image) => `
                    <button type="button" class="image-result-item" data-image-url="${escapeHtml(image.imageUrl)}" title="${escapeHtml(image.title)}">
                        <img src="${escapeHtml(image.thumbnailUrl || image.imageUrl)}" alt="${escapeHtml(image.title || 'Ảnh flashcard')}" loading="lazy">
                    </button>
                `).join("")}
            </div>
        `;
    } catch (error) {
        imageSearchPanel.innerHTML = `<p class="image-search-message">${escapeHtml(error.message || "Không thể tìm ảnh lúc này")}</p>`;
    }
});

imageSearchPanel.addEventListener("click", (event) => {
    const imageButton = event.target.closest(".image-result-item");
    if (!imageButton) return;

    previewUrlInput.value = imageButton.dataset.imageUrl;
    renderSelectedImage(previewUrlInput.value);
});

$(document).ready(function () {
    // Khởi tạo Select2
    $('#outputLang').select2({
        templateResult: formatLanguage, // Hiển thị trong dropdown
        templateSelection: formatLanguage, // Hiển thị khi chọn
        placeholder: 'Chọn ngôn ngữ',
        allowClear: true,
    });

    // Hàm hiển thị quốc kỳ và tên ngôn ngữ
    function formatLanguage(language) {
        if (!language.id) return language.text; // Placeholder
        const flagImg = language.element.dataset.img; // URL hình ảnh
        const flagEmoji = language.element.dataset.flag; // Emoji cờ
        const $language = $(
            `<span><img src="${flagImg}" class="flag-img" alt="${language.text}"/> ${language.text}</span>`
            // Nếu muốn dùng emoji thay img: `<span>${flagEmoji} ${language.text}</span>`
        );
        return $language;
    }

    // Xử lý click nút AI Gennarate
    const questionTextarea = document.getElementById('question');
    const answerTextarea = document.getElementById('answer');
    const aiGenButton = document.getElementById('AI-gen');
    const alertDiv = document.getElementById('alert');

    aiGenButton.addEventListener('click', async () => {
        const questionText = questionTextarea.value.trim();
        const outputLang = $('#outputLang').val() || 'en'; // Lấy giá trị từ Select2

        if (!questionText) {
            alertDiv.innerHTML = '<p class="text-danger">Vui lòng nhập câu hỏi!</p>';
            return;
        }

        alertDiv.innerHTML = '';

        try {
            const response = await fetch('/AI-gen', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_AUTH_TOKEN',
                },
                body: JSON.stringify({ question: questionText, outputLang: outputLang }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            answerTextarea.value = data.answer;

        } catch (error) {
            console.error('Lỗi khi gọi API /AI-gen:', error);
            alertDiv.innerHTML = '<p class="text-danger">Đã có lỗi xảy ra. Vui lòng thử lại!</p>';
        }
    });

    const learnBtn = document.getElementById('learn');
    const choiseContainer = document.getElementById('choise-container');
    const closeBtn = document.getElementById('closex');
    const difficultReviewBtn = document.getElementById('difficult-review');
    if (learnBtn && choiseContainer) {
        learnBtn.addEventListener('click', () => { choiseContainer.classList.add('show') });
    } else {
        console.log('Không tìm thấy phần tử');
    }
    closeBtn.addEventListener('click', () => { choiseContainer.classList.remove('show') });
    difficultReviewBtn?.addEventListener('click', showDifficultCards);

});

// Lắng nghe sự kiện phím từ bàn phím
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape" && settingsPanel?.classList.contains("show")) {
        setSettingsPanelOpen(false);
        return;
    }

    if (isRemovingKnownCard) return;

    switch (e.key) {
        case 'ArrowRight':
            nextButton.click();
            break;
        case 'ArrowLeft':
            prevButton.click();
            break;
        case 'ArrowDown':
        case ' ':
            e.preventDefault(); // Ngăn scroll khi nhấn space
            if (cardsElement[currentActiveCard]) {
                cardsElement[currentActiveCard].classList.toggle("show-answer");
                soundEffects.flip();
            }
            break;
        default:
            break;
    }
});



document.getElementById("reverse").addEventListener("click", () => {
    const currentCardId = cardsData[currentActiveCard]?.id || "";
    isReversed = !isReversed;
    soundEffects.move();

    refreshVisibleCards(currentCardId);
});

