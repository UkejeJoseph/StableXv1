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
        const text = response.text();
        console.log('[AI] 📥 Gemini Response:', text);
        res.json({ reply: text });
    } catch (err) {
        console.error("AI service error:", err.message);
        // Special highlighting for 429/quota errors
        if (err.message?.includes('quota') || err.message?.includes('429')) {
            console.error("[AI] 🛑 GEMINI LIMIT REACHED");
            return res.status(429).json({ message: 'AI service limit reached. Please try again later.' });
        }
        res.status(500).json({ message: 'AI service unavailable' });
    }
});

export default router;
