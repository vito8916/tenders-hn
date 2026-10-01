"use client";

// AI Elements «Prompt Input» (elements.ai-sdk.dev): the form, the textarea,
// and the send / stop button, without attachments, menus, model selection,
// or commands.

import type { ChatStatus } from "ai";
import { CornerDownLeftIcon, SquareIcon } from "lucide-react";
import { useState, type ComponentProps, type FormEvent, type KeyboardEvent } from "react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type PromptInputProps = Omit<ComponentProps<"form">, "onSubmit"> & {
    onSubmit: (text: string, event: FormEvent<HTMLFormElement>) => void;
};

/** Sends the textarea's text and clears it. */
export const PromptInput = ({ className, onSubmit, children, ...props }: PromptInputProps) => (
    <form
        className={cn("w-full", className)}
        onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const text = String(new FormData(form).get("message") ?? "").trim();
            if (!text) return;
            onSubmit(text, event);
            form.reset();
        }}
        {...props}
    >
        <InputGroup className="overflow-hidden">{children}</InputGroup>
    </form>
);

/** Enter sends; Shift+Enter adds a line; Enter while composing (IME) does neither. */
export const PromptInputTextarea = ({ onKeyDown, className, ...props }: ComponentProps<typeof InputGroupTextarea>) => {
    const [isComposing, setIsComposing] = useState(false);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.key !== "Enter" || event.shiftKey || isComposing || event.nativeEvent.isComposing) return;
        event.preventDefault();
        const submitButton = event.currentTarget.form?.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (submitButton?.disabled) return;
        event.currentTarget.form?.requestSubmit();
    };

    return (
        <InputGroupTextarea
            className={cn("field-sizing-content max-h-48 min-h-16", className)}
            name="message"
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={handleKeyDown}
            {...props}
        />
    );
};

export const PromptInputFooter = ({ className, ...props }: Omit<ComponentProps<typeof InputGroupAddon>, "align">) => (
    <InputGroupAddon align="block-end" className={cn("justify-between gap-1", className)} {...props} />
);

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
    status?: ChatStatus;
    onStop?: () => void;
};

/** Sends, or stops the answer while it is being written. */
export const PromptInputSubmit = ({ className, variant = "default", size = "icon-sm", status, onStop, onClick, children, ...props }: PromptInputSubmitProps) => {
    const isGenerating = status === "submitted" || status === "streaming";
    const icon = status === "submitted" ? <Spinner /> : status === "streaming" ? <SquareIcon className="size-4" /> : <CornerDownLeftIcon className="size-4" />;

    return (
        <InputGroupButton
            aria-label={isGenerating ? "Detener" : "Enviar"}
            className={cn(className)}
            onClick={(event) => {
                if (isGenerating && onStop) {
                    event.preventDefault();
                    onStop();
                    return;
                }
                onClick?.(event);
            }}
            size={size}
            type={isGenerating && onStop ? "button" : "submit"}
            variant={variant}
            {...props}
        >
            {children ?? icon}
        </InputGroupButton>
    );
};
