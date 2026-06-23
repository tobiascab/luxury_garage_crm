import React from 'react';
import { useMotionValue, useTransform } from 'framer-motion';
import { motion, AnimatePresence, springSoft, easeOutFast, useReduce } from '../lib/motion';
import useScrollLock from '../../hooks/useScrollLock';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    /** Max height: 'full' = 100vh, 'auto' = content-driven (default) */
    height?: 'auto' | 'full';
}

export default function BottomSheet({ isOpen, onClose, children, height = 'auto' }: BottomSheetProps) {
    const reduce = useReduce();
    const y = useMotionValue(0);
    // Fade overlay as user drags down
    const overlayOpacity = useTransform(y, [0, 300], [1, 0]);

    // Lock body scroll while open (iOS-proof, vía hook compartido)
    useScrollLock(isOpen);

    const handleDragEnd = (_: any, info: any) => {
        if (info.offset.y > 120 || info.velocity.y > 500) {
            onClose();
        }
    };

    // Reduced motion: no slide / no drag, just a gentle fade + scale.
    const sheetAnim = reduce
        ? {
              initial: { opacity: 0, scale: 0.98 },
              animate: { opacity: 1, scale: 1 },
              exit: { opacity: 0, scale: 0.98, transition: easeOutFast },
              transition: { duration: 0.2 },
          }
        : {
              style: { y },
              drag: 'y' as const,
              dragConstraints: { top: 0 },
              dragElastic: { top: 0.05, bottom: 0.4 },
              onDragEnd: handleDragEnd,
              initial: { y: '100%' },
              animate: { y: 0 },
              exit: { y: '100%', transition: easeOutFast },
              transition: springSoft,
          };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[300] flex items-end justify-center">
                    {/* Backdrop */}
                    <motion.div
                        style={reduce ? undefined : { opacity: overlayOpacity }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: easeOutFast }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
                    />

                    {/* Sheet */}
                    <motion.div
                        {...sheetAnim}
                        className={`relative z-10 w-full max-w-lg ${height === 'full' ? 'h-[90vh]' : 'max-h-[90vh]'} flex flex-col`}
                    >
                        <div
                            className="bg-white dark:bg-slate-900 rounded-t-[2.5rem] shadow-2xl overflow-hidden flex flex-col flex-1"
                            // Allow inner scroll without propagating to drag
                            onPointerDown={e => e.stopPropagation()}
                        >
                            {/* Drag Handle — always draggable */}
                            <div
                                onPointerDown={e => {
                                    // Allow drag to start from handle
                                    e.stopPropagation();
                                }}
                                className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing select-none shrink-0"
                            >
                                <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
                            </div>

                            {/* Content — scrollable inside, doesn't trigger drag */}
                            <div
                                className="overflow-y-auto flex-1 overscroll-contain"
                                style={{ touchAction: 'pan-y' }}
                                onPointerDown={e => e.stopPropagation()}
                            >
                                {children}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
