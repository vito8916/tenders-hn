"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Building2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

interface OrganizationLogoUploadProps {
  /** Callback when a file is selected (passes the File object) */
  onFileSelect?: (file: File | null) => void;
  /** Current preview URL if editing */
  currentLogoUrl?: string | null;
  /** Max file size in bytes (default 2MB) */
  maxFileSize?: number;
  className?: string;
}

export function OrganizationLogoUpload({
  onFileSelect,
  currentLogoUrl,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  className,
}: OrganizationLogoUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl || null);
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Invalid file type. Please upload a JPEG, PNG, or WebP image.");
      return;
    }

    // Validate file size
    if (file.size > maxFileSize) {
      toast.error(`File too large. Maximum size is ${maxFileSize / 1024 / 1024}MB.`);
      return;
    }

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    
    // Clean up old preview URL if it was created by us
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    
    setPreviewUrl(objectUrl);
    onFileSelect?.(file);
  }, [previewUrl, onFileSelect, maxFileSize]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input so the same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDelete = useCallback(() => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    onFileSelect?.(null);
  }, [previewUrl, onFileSelect]);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  // If we have a preview, show it
  if (previewUrl) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="relative inline-flex">
          <div className="h-16 w-16 rounded-lg border-2 border-border overflow-hidden bg-muted flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob/object URL preview, next/image cannot optimize it */}
            <img
              src={previewUrl}
              alt="Organization logo"
              className="h-full w-full object-cover"
            />
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className="absolute -top-2 -right-2 bg-background p-1 rounded-full border shadow-sm cursor-pointer hover:bg-muted transition-colors"
          >
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Click X to remove and upload a different logo</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed border-border rounded-lg p-4 cursor-pointer transition-colors hover:bg-muted/50",
          isDragActive && "border-primary bg-primary/10"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg border-2 border-dashed border-border bg-muted flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-medium">Upload your logo</p>
            <p className="text-xs text-muted-foreground">*.png, *.jpeg files up to {maxFileSize / 1024 / 1024} MB</p>
          </div>
          <Upload className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
