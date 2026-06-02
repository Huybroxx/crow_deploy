import express from 'express';
import { getflashcardDetail, getflashcards, getCreateCard, postCreateCard, getEditCard, postEditCard, newCard, deleteFlashCard, baiTapTuVung, getList, searchFlashcardImages } from '../controller/flashcards.controller.js';
import { auth, requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/flashcards', requireAuth, getflashcards);
router.get('/flashcards/image-search', requireAuth, searchFlashcardImages);
router.get('/flashcards/card/:id', requireAuth, getflashcardDetail);
router.post('/flashcards/card/:id', requireAuth, newCard);
router.get('/flashcards/createCard', requireAuth, getCreateCard);
router.post('/flashcards/createCard', requireAuth, postCreateCard);
router.get('/flashcards/edit/:id', requireAuth, getEditCard);
router.post('/flashcards/edit/:id', requireAuth, postEditCard);
router.delete('/flashcards/delete/:id', requireAuth, deleteFlashCard);
router.get('/review/:id', requireAuth, baiTapTuVung);
router.get('/flashcards/list/:id', requireAuth, getList);
export default router;
