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
// Lấy dữ liệu từ HTML (Pug đã render)
const cardData = document.querySelector(".card-data");
const flashcard = JSON.parse(cardData.getAttribute("data"));
const listCard = flashcard.cards;
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
let isReversed = false;

// Chuyển đổi dữ liệu từ BE thành { question, answer }
let cardsData = listCard.map(card => ({
    question: card.vocabulary,
    answer: card.meaning,
    previewUrl: card.previewUrl || ''
}));
let currentActiveCard = 0;
let cardsElement = [];

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

// Tạo các card từ dữ liệu BE
function createCards() {
    cardsContainer.innerHTML = ""; // Xóa danh sách cũ
    cardsElement = []; // Xóa danh sách phần tử cũ
    if (cardsData.length === 0) {
        currentElement.innerText = "0/0";
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
    card.innerHTML = `
        <div class="inner-card card-animation">
            <div class="inner-card-front">
                <div class="inner-card-content">
                    ${frontImageHtml}
                    <p style="font-size:1.5rem">${escapeHtml(data.question)}</p>
                </div>
                <button class="voice-btn front-voice" data-text="${escapeHtml(data.question)}"><i class="fa-solid fa-volume-high"></i></i></button>
            </div>
            <div class="inner-card-back">
                <div class="inner-card-content">
                    ${backImageHtml}
                    <p style="font-size:1.5rem">${escapeHtml(data.answer)}</p>
                </div>
                <button class="voice-btn back-voice" data-text="${escapeHtml(data.answer)}"><i class="fa-solid fa-volume-high"></i></button>
            </div>
        </div>
    `;
    card.addEventListener("click", () => card.classList.toggle("show-answer"));

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
    if (cardsElement.length === 0) return;
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
    if (cardsElement.length === 0) return;
    cardsElement[currentActiveCard].className = "card right";
    currentActiveCard--;
    if (currentActiveCard < 0) {
        currentActiveCard = cardsElement.length - 1;
    }
    cardsElement[currentActiveCard].className = "card active";
    updateCurrentText();
});

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

    // Fisher-Yates shuffle
    for (let i = cardsData.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [cardsData[i], cardsData[j]] = [cardsData[j], cardsData[i]];
    }

    createCards(); // Cập nhật giao diện sau khi trộn
});

// Khởi tạo các card từ dữ liệu BE
updateImageModeButtons();
createCards();

imageModeButtons.forEach(button => {
    button.addEventListener("click", () => {
        imageDisplayMode = button.dataset.imageMode;
        localStorage.setItem(imageModeStorageKey, imageDisplayMode);
        updateImageModeButtons();
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

        const data = await response.json();
        console.log(data.message); // Kiểm tra phản hồi từ server
        alertMessage.innerText = data.message;
        setTimeout(() => {
            alertMessage.innerText = "";
        }, 2000);

        const newCard = { vocabulary, meaning, previewUrl };
        listCard.push(newCard);
        cardsData.push({
            question: isReversed ? meaning : vocabulary,
            answer: isReversed ? vocabulary : meaning,
            previewUrl,
        });
        currentActiveCard = cardsData.length - 1;
        createCards();
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
    const query = document.getElementById("question").value.trim();
    if (!query) {
        imageSearchPanel.innerHTML = '<p class="image-search-message">Nhập câu hỏi trước để tìm ảnh.</p>';
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
    if (learnBtn && choiseContainer) {
        learnBtn.addEventListener('click', () => { choiseContainer.classList.add('show') });
    } else {
        console.log('Không tìm thấy phần tử');
    }
    closeBtn.addEventListener('click', () => { choiseContainer.classList.remove('show') });

});

// Lắng nghe sự kiện phím từ bàn phím
document.addEventListener('keydown', (e) => {
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
            }
            break;
        default:
            break;
    }
});



document.getElementById("reverse").addEventListener("click", () => {
    isReversed = !isReversed;

    cardsData = listCard.map(card => ({
        question: isReversed ? card.meaning : card.vocabulary,
        answer: isReversed ? card.vocabulary : card.meaning,
        previewUrl: card.previewUrl || ''
    }));

    createCards();
});

