import express from 'express';
const router = express.Router();
import { GoogleGenerativeAI } from '@google/generative-ai';
import { protect } from '../middleware/authMiddleware.js';

router.post('/chat', protect, async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            console.error("GEMINI_API_KEY is not defined in environment variables");
            return res.status(500).json({ message: 'AI service configuration error' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: 'gemini-pro'
        });

        const chat = model.startChat({
            history: history || []
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        res.json({ reply: response.text() });
    } catch (err) {
        console.error("AI service error:", err);
        res.status(500).json({ message: 'AI service unavailable' });
    }
});

export default router;
