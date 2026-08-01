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
  
  export const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  export const getInitials = (name?: string | null) => {
    if (!name) return 'N/A';
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'N/A';
  };