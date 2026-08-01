"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { getCroppedImg } from "@/lib/utils/crop-image";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type ImageUploadShape = "circle" | "square";

export interface ImageUploadWithCropProps {
    /** Callback when a file is selected (passes the cropped File or null) */
    onFileSelect?: (file: File | null) => void;
    /** Currently selected file (e.g. from parent state) - used to restore preview when component remounts */
    selectedFile?: File | null;
    /** Current preview URL if editing */
    currentImageUrl?: string | null;
    /** Max file size in bytes (default 5MB) */
    maxFileSize?: number;
    /** Shape of the crop area and preview */
    shape?: ImageUploadShape;
    /** Size of the preview/avatar (for circle: diameter, for square: side) */
    size?: number;
    /** Accept string for dropzone (default: image/jpeg,image/png) */
    accept?: Record<string, string[]>;
    /** Placeholder when empty - for square use icon, for circle use avatar fallback */
    placeholder?: React.ReactNode;
    className?: string;
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ACCEPT = { "image/jpeg": [".jpeg", ".jpg"], "image/png": [".png"] };

export function ImageUploadWithCrop({
    onFileSelect,
    selectedFile,
    currentImageUrl,
    maxFileSize = DEFAULT_MAX_SIZE,
    shape = "circle",
    size = shape === "circle" ? 96 : 64,
    accept = DEFAULT_ACCEPT,
    placeholder,
    className,
}: ImageUploadWithCropProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
    const [userRemoved, setUserRemoved] = useState(false);

    useEffect(() => {
        if (selectedFile) {
            const url = URL.createObjectURL(selectedFile);
            setPreviewUrl(url);
            setUserRemoved(false);
            return () => URL.revokeObjectURL(url);
        }
        if (selectedFile === null) {
            setPreviewUrl(null);
        }
    }, [selectedFile]);
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            const file = acceptedFiles[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            setImageToCrop(url);
            setCropModalOpen(true);
        },
        []
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept,
        maxSize: maxFileSize,
        maxFiles: 1,
        multiple: false,
        onDropRejected: (rejections) => {
            const err = rejections[0]?.errors[0];
            if (err?.code === "file-too-large") {
                toast.error(`File too large. Maximum size is ${maxFileSize / 1024 / 1024} MB.`);
            } else if (err?.code === "file-invalid-type") {
                toast.error("Invalid file type. Please upload a PNG or JPEG image.");
            }
        },
    });

    const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCropConfirm = useCallback(async () => {
        if (!imageToCrop || !croppedAreaPixels) return;
        try {
            const file = await getCroppedImg(
                imageToCrop,
                croppedAreaPixels,
                "image.png"
            );
            const url = URL.createObjectURL(file);
            if (previewUrl && previewUrl.startsWith("blob:")) {
                URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl(url);
            setUserRemoved(false);
            onFileSelect?.(file);
        } catch (error) {
            toast.error("Failed to crop image");
            console.error(error);
        } finally {
            URL.revokeObjectURL(imageToCrop);
            setCropModalOpen(false);
            setImageToCrop(null);
            setCroppedAreaPixels(null);
        }
    }, [imageToCrop, croppedAreaPixels, previewUrl, onFileSelect]);

    const handleCropCancel = useCallback(() => {
        if (imageToCrop) URL.revokeObjectURL(imageToCrop);
        setCropModalOpen(false);
        setImageToCrop(null);
        setCroppedAreaPixels(null);
    }, [imageToCrop]);

    const handleDelete = useCallback(() => {
        if (previewUrl && previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        setUserRemoved(true);
        onFileSelect?.(null);
    }, [previewUrl, onFileSelect]);

    const displayUrl = userRemoved ? null : (previewUrl || currentImageUrl);

    const containerClass = shape === "circle"
        ? "rounded-full overflow-hidden"
        : "rounded-lg overflow-hidden";

    const cropDialog = (
        <Dialog open={cropModalOpen} onOpenChange={(open) => { if (!open) handleCropCancel(); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Crop image</DialogTitle>
                </DialogHeader>
                {imageToCrop && (
                    <div className="relative h-80 w-full">
                            <Cropper
                                image={imageToCrop}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape={shape === "circle" ? "round" : "rect"}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                    </div>
                )}
                <div className="flex gap-2 items-center">
                    <label className="text-sm">Zoom</label>
                    <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.1}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleCropCancel}>
                        Cancel
                    </Button>
                    <Button onClick={handleCropConfirm}>Apply</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    if (displayUrl) {
        return (
            <div className={cn("space-y-2", className)}>
                <div className="relative inline-flex">
                    <div
                        className={cn(
                            "border-2 border-border bg-muted flex items-center justify-center",
                            containerClass
                        )}
                        style={{
                            width: size,
                            height: size,
                        }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element -- blob/object URL preview, next/image cannot optimize it */}
                        <img
                            src={displayUrl}
                            alt="Upload preview"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="absolute -bottom-1 -right-1 bg-background p-1.5 rounded-full border shadow-sm cursor-pointer hover:bg-muted transition-colors"
                    >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Click to remove and upload a different image
                </p>
                {cropDialog}
            </div>
        );
    }

    return (
        <div className={cn("space-y-2", className)}>
            <div
                {...getRootProps()}
                className={cn(
                    "border-2 border-dashed border-border rounded-lg p-4 cursor-pointer transition-colors hover:bg-muted/50 flex flex-col items-center justify-center gap-2",
                    isDragActive && "border-primary bg-primary/10",
                    shape === "circle" && "rounded-full p-6",
                    shape === "circle" && "w-[96px] h-[96px]"
                )}
                style={shape === "square" ? undefined : { width: size, height: size }}
            >
                <input {...getInputProps()} />
                {placeholder ?? (
                    <>
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        {/* <span className="text-sm font-medium text-center">
                            Upload your {shape === "circle" ? "photo" : "logo"}
                        </span> */}
                    </>
                )}
            </div>
            <p className="text-xs text-muted-foreground">
                *.png, *.jpeg files up to {maxFileSize / 1024 / 1024} MB
            </p>
            {cropDialog}
        </div>
    );
}
