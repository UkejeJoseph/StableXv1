import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
    onComplete: () => void;
    duration?: number;
}

export function SplashScreen({ onComplete, duration = 2500 }: SplashScreenProps) {
    const [phase, setPhase] = useState<'logo' | 'fadeout'>('logo');

    useEffect(() => {
        const fadeTimer = setTimeout(() => setPhase('fadeout'), duration - 800);
        const completeTimer = setTimeout(onComplete, duration);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(completeTimer);
        };
    }, [onComplete, duration]);

    return (
        <AnimatePresence>
            {phase !== 'fadeout' ? null : null}
            <motion.div
                className="fixed inset-0 z-[100] flex items-center justify-center splash-bg"
                initial={{ opacity: 1 }}
                animate={{ opacity: phase === 'fadeout' ? 0 : 1 }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
                {/* Pulsating aura behind logo */}
                <motion.div
                    className="absolute w-48 h-48 rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(79,209,197,0.3) 0%, transparent 70%)',
                    }}
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />

                {/* Logo text */}
                <motion.div
                    className="relative flex flex-col items-center gap-3"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div className="flex items-center gap-2">
                        {/* Icon */}
                        <motion.div
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, #14B8A6, #4FD1C5)',
                                boxShadow: '0 0 30px rgba(79,209,197,0.4)',
                            }}
                            animate={{
                                boxShadow: [
                                    '0 0 30px rgba(79,209,197,0.4)',
                                    '0 0 50px rgba(79,209,197,0.6)',
                                    '0 0 30px rgba(79,209,197,0.4)',
                                ],
                            }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <span className="text-white font-black text-xl">S</span>
                        </motion.div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-white">
                                Stable<span className="text-teal-400">X</span>
                            </h1>
                        </div>
                    </div>
                    <motion.p
                        className="text-sm text-white/50 font-medium tracking-widest uppercase"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                    >
                        Crypto Wallet & Exchange
                    </motion.p>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
