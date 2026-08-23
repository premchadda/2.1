import { useState, useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import { X, Check } from "lucide-react";
import { toast } from "react-hot-toast";

// Helper function to create the cropped image
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous"); // needed to avoid cross-origin issues on CodeSandbox
    image.src = url;
  });

function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

async function getCroppedImg(
  imageSrc,
  pixelCrop,
  rotation = 0,
  flip = { horizontal: false, vertical: false },
) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  const rotRad = getRadianAngle(rotation);

  // calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = {
    width:
      Math.abs(Math.cos(rotRad) * image.width) +
      Math.abs(Math.sin(rotRad) * image.height),
    height:
      Math.abs(Math.sin(rotRad) * image.width) +
      Math.abs(Math.cos(rotRad) * image.height),
  };

  // set canvas size to match the bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // translate canvas context to a central location to allow rotating and flipping around the center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-image.width / 2, -image.height / 2);

  // draw rotated image
  ctx.drawImage(image, 0, 0);

  // croppedAreaPixels values are bounding box relative
  // extract the cropped image using these values
  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
  );

  // set canvas width to final desired crop size - this will clear existing context
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // paste generated rotate image at the top left corner
  ctx.putImageData(data, 0, 0);

  // As a blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (file) => {
        if (file) {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onloadend = () => {
            resolve(reader.result);
          };
        } else {
          reject(new Error("Canvas is empty"));
        }
      },
      "image/jpeg",
      0.95,
    );
  });
}

export default function ImageCropperModal({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  aspect = 1,
  title = "Adjust Photo",
  cropShape = "rect", // "rect" or "round"
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const dialogRef = useRef(null);
  const titleId = useId();

  const onCropCompleteHandler = useCallback(
    (croppedArea, croppedAreaPixels) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [],
  );

  // Move focus into the dialog on open and restore it to the trigger on close.
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    const prevFocused = document.activeElement;
    const node = dialogRef.current;
    if (node) {
      const focusable = node.querySelector(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (focusable || node).focus();
    }
    return () => {
      if (
        prevFocused &&
        typeof prevFocused.focus === "function" &&
        document.contains(prevFocused)
      ) {
        prevFocused.focus();
      }
    };
  }, [isOpen, imageSrc]);

  const handleKeyDown = (e) => {
    if (e.key !== "Tab") return;
    const node = dialogRef.current;
    if (!node) return;
    const focusable = Array.from(
      node.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusable.length === 0) {
      e.preventDefault();
      node.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !node.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !node.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const handleSave = async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    try {
      setIsProcessing(true);
      const croppedImageBase64 = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
      );
      onCropComplete(croppedImageBase64);
    } catch (e) {
      console.error(e);
      toast.error("Failed to crop image");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[99999] p-4 backdrop-blur-sm animate-fade-in">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[94vh] max-h-[94dvh]"
      >
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center shrink-0">
          <h3
            id={titleId}
            className="text-lg font-bold text-gray-900 dark:text-white"
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative w-full h-[42vh] min-h-[220px] sm:h-[60vh] bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteHandler}
            onZoomChange={setZoom}
          />
        </div>

        <div className="p-5 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-2 block">
              Zoom
            </label>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 hover:shadow-lg transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" /> Save Photo
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
