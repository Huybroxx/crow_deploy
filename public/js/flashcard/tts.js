const JAPANESE_TEXT = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
const JAPANESE_CHARS = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff々ー〆〤]+/g;
const LATIN_TEXT = /[A-Za-zÀ-ỹ]/;
const FIELD_SEPARATOR = /\s*(?:-|–|—|\||:|：)\s*/;
const PARENTHETICAL_TEXT = /\(([^)]*)\)|（([^）]*)）/g;

let voices = [];
let voicesPromise = null;

export function isSpeechSupported() {
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function detectSpeechLang(text, fallbackLang = "vi-VN") {
    return JAPANESE_TEXT.test(String(text || "")) ? "ja-JP" : fallbackLang;
}

function uniqueTexts(texts = []) {
    const seen = new Set();

    return texts.filter((text) => {
        const normalized = String(text || "").trim();
        if (!normalized || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
    });
}

function cleanupVietnameseText(text) {
    return String(text || "")
        .replace(JAPANESE_CHARS, " ")
        .replace(/[()[\]{}（）]/g, " ")
        .replace(/^[\s\-–—|:：,，.。]+|[\s\-–—|:：,，.。]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function getParentheticalTexts(text) {
    return [...String(text || "").matchAll(PARENTHETICAL_TEXT)]
        .map(match => String(match[1] || match[2] || "").trim())
        .filter(Boolean);
}

function extractJapaneseText(text) {
    const value = String(text || "").trim();
    if (!JAPANESE_TEXT.test(value)) return "";

    const segments = value.split(FIELD_SEPARATOR).map(segment => segment.trim()).filter(Boolean);
    const candidate = segments.find(segment => JAPANESE_TEXT.test(segment)) || value;
    const withoutMeaning = candidate.replace(PARENTHETICAL_TEXT, " ");
    const matches = withoutMeaning.match(JAPANESE_CHARS);

    return matches?.[0] || "";
}

function extractVietnameseText(text) {
    const value = String(text || "").trim();
    if (!value) return "";

    const parenthetical = getParentheticalTexts(value)
        .map(cleanupVietnameseText)
        .find(item => item && LATIN_TEXT.test(item));

    if (parenthetical) return parenthetical;

    const segments = value.split(FIELD_SEPARATOR).map(segment => segment.trim()).filter(Boolean);
    const segment = segments
        .map(cleanupVietnameseText)
        .find(item => item && LATIN_TEXT.test(item) && !JAPANESE_TEXT.test(item));

    if (segment) return segment;

    const cleaned = cleanupVietnameseText(value);
    return LATIN_TEXT.test(cleaned) ? cleaned : "";
}

function normalizeCards(cards = []) {
    return cards
        .map(card => ({
            vocabulary: String(card?.vocabulary || "").trim(),
            meaning: String(card?.meaning || "").trim(),
        }))
        .filter(card => card.vocabulary || card.meaning);
}

function loadVoices() {
    if (!isSpeechSupported()) {
        return Promise.resolve([]);
    }

    voices = window.speechSynthesis.getVoices();

    if (voices.length) {
        return Promise.resolve(voices);
    }

    if (!voicesPromise) {
        voicesPromise = new Promise((resolve) => {
            const handleVoicesChanged = () => {
                voices = window.speechSynthesis.getVoices();
                window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
                resolve(voices);
            };

            window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);

            window.setTimeout(() => {
                voices = window.speechSynthesis.getVoices();
                window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
                resolve(voices);
            }, 800);
        });
    }

    return voicesPromise;
}

function findVoice(lang) {
    const normalizedLang = lang.toLowerCase();
    const baseLang = normalizedLang.split("-")[0];
    const voiceList = voices.length ? voices : window.speechSynthesis.getVoices();

    return voiceList.find(voice => voice.lang.toLowerCase() === normalizedLang)
        || voiceList.find(voice => voice.lang.toLowerCase().startsWith(`${baseLang}-`))
        || null;
}

function clampRate(rate) {
    const nextRate = Number(rate);
    if (!Number.isFinite(nextRate)) return 1;
    return Math.min(Math.max(nextRate, 0.5), 1.8);
}

function getSpeechRate(part, rate) {
    const baseRate = clampRate(rate);

    if (String(part.lang || "").toLowerCase().startsWith("vi")) {
        return clampRate(baseRate * 0.85);
    }

    return baseRate;
}

function speakPart(part, rate) {
    return new Promise((resolve, reject) => {
        const text = String(part.text || "").trim();

        if (!text) {
            resolve();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = part.lang || detectSpeechLang(text);
        utterance.rate = getSpeechRate(part, rate);
        utterance.pitch = 1;
        utterance.voice = findVoice(utterance.lang);

        utterance.onend = () => resolve();
        utterance.onerror = (event) => {
            if (event.error === "canceled" || event.error === "interrupted") {
                resolve();
                return;
            }

            reject(event);
        };

        window.speechSynthesis.speak(utterance);
    });
}

function buildCardParts(card) {
    const japaneseText = uniqueTexts([card.vocabulary, card.meaning].map(extractJapaneseText))[0] || "";
    const vietnameseText = uniqueTexts([card.meaning, card.vocabulary].map(extractVietnameseText))[0] || "";
    const parts = [];

    if (japaneseText) {
        parts.push({ text: japaneseText, lang: "ja-JP" });
    }

    if (vietnameseText) {
        parts.push({ text: vietnameseText, lang: "vi-VN" });
    }

    return parts;
}

export function stopBrowserSpeech() {
    if (isSpeechSupported()) {
        window.speechSynthesis.cancel();
    }
}

export class FlashcardDeckSpeaker {
    constructor(cards, callbacks = {}) {
        this.cards = normalizeCards(cards);
        this.callbacks = callbacks;
        this.currentIndex = 0;
        this.rate = clampRate(callbacks.rate || 1);
        this.isPlaying = false;
        this.isPaused = false;
        this.stopped = false;
        this.playToken = 0;
    }

    setRate(rate) {
        this.rate = clampRate(rate);
    }

    pause() {
        if (!isSpeechSupported() || !this.isPlaying || this.isPaused) return;
        window.speechSynthesis.pause();
        this.isPaused = true;
        this.callbacks.onPause?.(this.currentIndex);
    }

    resume() {
        if (!isSpeechSupported() || !this.isPlaying || !this.isPaused) return;
        window.speechSynthesis.resume();
        this.isPaused = false;
        this.callbacks.onResume?.(this.currentIndex);
    }

    stop() {
        this.playToken += 1;
        this.stopped = true;
        this.isPlaying = false;
        this.isPaused = false;
        stopBrowserSpeech();
        this.callbacks.onStop?.(this.currentIndex);
    }

    async play(startIndex = 0) {
        if (!isSpeechSupported() || !this.cards.length) return;

        const playToken = this.playToken + 1;
        this.playToken = playToken;
        stopBrowserSpeech();
        await loadVoices();

        if (playToken !== this.playToken) return;

        this.currentIndex = Math.min(Math.max(Number(startIndex) || 0, 0), this.cards.length - 1);
        this.isPlaying = true;
        this.isPaused = false;
        this.stopped = false;

        try {
            while (!this.stopped && playToken === this.playToken && this.currentIndex < this.cards.length) {
                const card = this.cards[this.currentIndex];
                this.callbacks.onCardStart?.(card, this.currentIndex, this.cards.length);

                for (const part of buildCardParts(card)) {
                    if (this.stopped || playToken !== this.playToken) break;
                    await speakPart(part, this.rate);
                }

                if (!this.stopped && playToken === this.playToken) {
                    this.currentIndex += 1;
                }
            }

            if (!this.stopped && playToken === this.playToken) {
                this.isPlaying = false;
                this.isPaused = false;
                this.callbacks.onDone?.(this.cards.length);
            }
        } catch (error) {
            if (playToken !== this.playToken) return;

            this.isPlaying = false;
            this.isPaused = false;
            this.callbacks.onError?.(error);
        }
    }
}
