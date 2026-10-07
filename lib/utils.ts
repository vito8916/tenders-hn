import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// This check can be removed, it is just for tutorial purposes
export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  
  export function capitalizeText(text?: string | null) {
    if (!text) return 'no text';
    const words = text.split(" ")
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
  }
  
  export const getInitials = (name?: string | null) => {
    if (!name) return 'N/A';
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'N/A';
    const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
    return letters.toUpperCase();
  };