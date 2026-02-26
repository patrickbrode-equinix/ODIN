import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "../ui/button";

interface CopyTicketButtonProps {
    ticketId: string;
    className?: string;
}

export function CopyTicketButton({ ticketId, className }: CopyTicketButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click
        e.preventDefault();

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(ticketId);
            } else {
                // Fallback for non-secure contexts (e.g. older browsers or HTTP)
                const textArea = document.createElement("textarea");
                textArea.value = ticketId;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('Fallback copy failed', err);
                }
                document.body.removeChild(textArea);
            }

            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.error("Failed to copy ticket ID", err);
        }
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            className={`h-5 w-5 hover:bg-white/20 ml-1.5 shrink-0 ${className ?? ""}`}
            onClick={handleCopy}
            title="Copy Ticket ID"
            aria-label="Copy Ticket ID"
        >
            {copied ? (
                <Check className="h-3 w-3 text-green-400" />
            ) : (
                <Copy className="h-3 w-3 text-muted-foreground hover:text-white" />
            )}
        </Button>
    );
}
