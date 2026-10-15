import { useState, useCallback } from "react";
import { FeedbackType } from "../components/InlineFeedback";

export interface FeedbackState {
    isOpen: boolean;
    type: FeedbackType;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
}

export function useAlert() {
    const [feedback, setFeedback] = useState<FeedbackState>({
        isOpen: false,
        type: 'info',
        title: '',
        message: '',
        onConfirm: () => {}
    });

    const showAlert = useCallback((type: FeedbackType, title: string, message: string, onConfirm?: () => void, confirmText?: string) => {
        setFeedback({
            isOpen: true,
            type,
            title,
            message,
            onConfirm: onConfirm || (() => {}),
            confirmText
        });
    }, []);

    const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmText?: string) => {
        setFeedback({
            isOpen: true,
            type: 'confirm',
            title,
            message,
            onConfirm,
            confirmText
        });
    }, []);

    const closeAlert = useCallback(() => {
        setFeedback(prev => ({ ...prev, isOpen: false }));
    }, []);

    return {
        feedback,
        showAlert,
        showConfirm,
        closeAlert
    };
}
