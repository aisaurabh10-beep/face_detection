"use client";

import Loader from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SuccessPopup } from "@/components/ui/success-popup";
import { CAMERAS, MAX_UPLOAD } from "@/lib/constants";
import { CLASSES, getDivisionsForClass } from "@/lib/helper";
import RTSPtoWebClient from "@/lib/RTSPtoWebClient";
import { X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StreamSource = "device" | "actual";

export default function RegisterStudentPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLVideoElement | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [source, setSource] = useState<StreamSource>("actual");
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(
    CAMERAS[0]?.id ?? null
  );
  const [capturedBlobs, setCapturedBlobs] = useState<Blob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [streamError, setStreamError] = useState<string>("");
  const streamInitializedRef = useRef(false);
  const [sampleImages, setSampleImages] = useState<string[]>([]);

  const [form, setForm] = useState({
    studentId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    class: "",
    division: "",
    rollNumber: "",
    photoFiles: [] as File[],
  });

  const canSubmit = useMemo(() => {
    return (
      !!form.studentId &&
      !!form.firstName &&
      !!form.lastName &&
      !!form.email &&
      !!form.phone &&
      !!form.class &&
      !!form.division &&
      !!form.rollNumber &&
      ((form.photoFiles && form.photoFiles.length > 0) ||
        capturedBlobs.length > 0)
    );
  }, [form, capturedBlobs]);

  // Load sample images for embedding guidance (from public/sample-images)
  useEffect(() => {
    const loadSamples = async () => {
      try {
        const res = await fetch("/api/sample-images");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.images)) {
          setSampleImages(data.images);
        }
      } catch {
        // ignore errors, samples are optional
      }
    };

    loadSamples();
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const existingCount = capturedBlobs.length + (form.photoFiles?.length || 0);
    const remainingSlots = Math.max(0, MAX_UPLOAD - existingCount);
    const nextFiles = [
      ...(form.photoFiles || []),
      ...files.slice(0, remainingSlots),
    ];
    setForm((prev) => ({ ...prev, photoFiles: nextFiles }));
  };

  const startCamera = useCallback(async () => {
    if (!videoRef.current || streamInitializedRef.current) return;

    // Device camera (only intended for development)
    if (source === "device") {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        videoRef.current.srcObject = media as MediaStream;
        await videoRef.current.play();
        setStreaming(true);
        setStreamError("");
      } catch (err) {
        console.error(err);
        setStreamError("Unable to access device camera");
      }
      return;
    }

    // Actual RTSP cameras
    if (!canvasRef.current) return;

    const cameraId = selectedCameraId || CAMERAS[0]?.id;
    const camera = CAMERAS.find((c) => c.id === cameraId);

    if (!camera) {
      setStreamError("No cameras available");
      return;
    }

    streamInitializedRef.current = true;
    setStreamError("");

    RTSPtoWebClient.setupStream(
      camera.id,
      videoRef.current,
      () => {
        setStreaming(true);

        // Mirror stream to preview video (second video element)
        setTimeout(() => {
          if (canvasRef.current && videoRef.current?.srcObject) {
            canvasRef.current.srcObject = videoRef.current.srcObject;
            canvasRef.current.play?.().catch(console.error);
          }
        }, 100);
      },
      (error) => {
        console.error("WebRTC stream setup error:", error);
        setStreamError(`WebRTC stream error: ${error.message}`);
        setStreaming(false);
        streamInitializedRef.current = false;
      }
    );
  }, [source, selectedCameraId]);

  const stopCamera = useCallback(() => {
    setStreaming(false);
    streamInitializedRef.current = false;
    setStreamError("");

    if (videoRef.current) {
      try {
        const mediaStream = videoRef.current.srcObject as MediaStream | null;
        if (mediaStream) {
          mediaStream.getTracks().forEach((t) => t.stop());
        }
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {}
    }

    if (canvasRef.current) {
      try {
        canvasRef.current.pause?.();
        canvasRef.current.srcObject = null;
      } catch {}
    }
  }, []);

  // Actual camera functions (old device camera & RTSP examples kept for reference)
  //
  // const startCamera = useCallback(async () => {
  //   if (!videoRef.current || !canvasRef.current || streamInitializedRef.current)
  //     return;

  //   const firstCamera = CAMERAS[1];
  //   if (!firstCamera) {
  //     setStreamError("No cameras available");
  //     return;
  //   }

  //   streamInitializedRef.current = true;
  //   setStreamError("");

  //   RTSPtoWebClient.setupStream(
  //     firstCamera.id,
  //     videoRef.current,
  //     () => {
  //       setStreaming(true);

  //       // Use setTimeout to ensure stream is fully established
  //       setTimeout(() => {
  //         // Also set the stream to the second video element
  //         if (canvasRef.current && videoRef.current?.srcObject) {
  //           canvasRef.current.srcObject = videoRef.current.srcObject;
  //           canvasRef.current.play().catch(console.error);
  //         } else {
  //         }
  //       }, 100);
  //     },
  //     (error) => {
  //       console.error("WebRTC stream setup error:", error);
  //       setStreamError(`WebRTC stream error: ${error.message}`);
  //       setStreaming(false);
  //       streamInitializedRef.current = false;
  //     }
  //   );
  // }, []);

  // const stopCamera = useCallback(() => {
  //   setStreaming(false);
  //   streamInitializedRef.current = false;
  //   setStreamError("");

  //   if (videoRef.current) {
  //     try {
  //       const mediaStream = videoRef.current.srcObject as MediaStream | null;
  //       if (mediaStream) {
  //         mediaStream.getTracks().forEach((t) => t.stop());
  //       }
  //       videoRef.current.pause();
  //       videoRef.current.srcObject = null;
  //     } catch {}
  //   }

  //   if (canvasRef.current) {
  //     try {
  //       canvasRef.current.pause();
  //       canvasRef.current.srcObject = null;
  //     } catch {}
  //   }
  // }, []);

  const captureFrame = useCallback(() => {
    if (!videoRef.current) return;
    const totalCount = (form.photoFiles?.length || 0) + capturedBlobs.length;
    if (totalCount >= MAX_UPLOAD) return;

    // Create a temporary canvas for capturing
    const tempCanvas = document.createElement("canvas");
    const video = videoRef.current;
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    tempCanvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlobs((prev) => {
            const combined = (form.photoFiles?.length || 0) + prev.length;
            if (combined >= MAX_UPLOAD) return prev;
            return [...prev, blob];
          });
        }
      },
      "image/jpeg",
      0.92
    );
  }, [form.photoFiles, capturedBlobs.length]);

  const removeCapturedAt = (idx: number) => {
    setCapturedBlobs((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeUploadedAt = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      photoFiles: prev.photoFiles.filter((_, i) => i !== idx),
    }));
  };

  // Combine uploaded files and captured blobs for display
  const allImages = useMemo(() => {
    const images: Array<{
      type: "file" | "blob";
      data: File | Blob;
      index: number;
    }> = [];

    // Add uploaded files
    form.photoFiles.forEach((file, idx) => {
      images.push({ type: "file", data: file, index: idx });
    });

    // Add captured blobs
    capturedBlobs.forEach((blob, idx) => {
      images.push({ type: "blob", data: blob, index: idx });
    });

    return images;
  }, [form.photoFiles, capturedBlobs]);

  const submitForm = useCallback(async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!canSubmit) {
      setErrorMsg("Please fill all fields and add a photo");
      return;
    }
    stopCamera();
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("studentId", form.studentId);
      fd.append("firstName", form.firstName);
      fd.append("lastName", form.lastName);
      fd.append("email", form.email);
      fd.append("phone", form.phone);
      fd.append("class", form.class);
      fd.append("division", form.division);
      fd.append("rollNumber", form.rollNumber);

      const toUpload: File[] = [];
      // Add captured blobs as Files
      if (capturedBlobs.length > 0) {
        capturedBlobs.forEach((blob, idx) => {
          const file = new File([blob], `capture_${idx + 1}.jpg`, {
            type: "image/jpeg",
          });
          toUpload.push(file);
        });
      } else if (form.photoFiles.length > 0) {
        form.photoFiles.forEach((file) => {
          toUpload.push(file);
        });
      }

      if (toUpload.length === 0) {
        setErrorMsg("Please add at least one photo");
        setSubmitting(false);
        return;
      }
      for (const f of toUpload) {
        fd.append("photos", f, f.name);
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
      const res = await fetch(`${baseUrl}/students/register`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      setSuccessMsg("Student registered successfully");
      setForm({
        studentId: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        class: "",
        division: "",
        rollNumber: "",
        photoFiles: [],
      });
      setCapturedBlobs([]);

      // Navigate back to students page after a short delay
      setTimeout(() => {
        router.push("/students");
      }, 1500);
    } catch (error) {
      setErrorMsg(JSON.parse(error?.message).message);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, form, capturedBlobs]);

  if (submitting) {
    return <Loader />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl font-semibold leading-none tracking-tight">
              Student Details
            </CardTitle>
          </CardHeader>
          {streamError && (
            <div className=" top-2 left-2 right-2 z-10 border mx-6 mb-4">
              <div className="bg-red-100 border border-red-300 text-red-500 rounded-md p-2">
                <p className="text-xs font-medium">Stream Error</p>
                <p className="text-xs mt-1">{streamError}</p>
              </div>
            </div>
          )}

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                name="studentId"
                placeholder="Student ID"
                value={form.studentId}
                onChange={handleInput}
              />
              <Input
                name="rollNumber"
                placeholder="Roll Number"
                value={form.rollNumber}
                onChange={handleInput}
              />
              <Input
                name="firstName"
                placeholder="First Name"
                value={form.firstName}
                onChange={handleInput}
              />
              <Input
                name="lastName"
                placeholder="Last Name"
                value={form.lastName}
                onChange={handleInput}
              />
              <Input
                name="email"
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={handleInput}
              />
              <Input
                name="phone"
                placeholder="Phone"
                value={form.phone}
                onChange={handleInput}
              />
              <div>
                <label className="text-xs text-muted-foreground">Class</label>
                <select
                  className="mt-1 h-9 w-full px-3 border rounded-md bg-background text-sm"
                  value={form.class}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      class: e.target.value,
                      division: "",
                    }))
                  }
                >
                  <option value="">Select Class</option>
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Division
                </label>
                <select
                  className="mt-1 h-9 w-full px-3 border rounded-md bg-background text-sm"
                  value={form.division}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, division: e.target.value }))
                  }
                  disabled={!form.class}
                >
                  <option value="">Select Division</option>
                  {getDivisionsForClass(form.class)?.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              {/* face encoding will be generated in backend */}
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Upload Photos (max {MAX_UPLOAD})
              </p>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoFiles}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 my-2">
              <div className="flex items-center gap-2">
                {process.env.NODE_ENV === "development" && (
                  <Button
                    type="button"
                    size="sm"
                    variant={source === "device" ? "default" : "outline"}
                    onClick={() => setSource("device")}
                    disabled={streaming}
                    className="h-8 px-2 text-xs"
                  >
                    Device
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={source === "actual" ? "default" : "outline"}
                  onClick={() => setSource("actual")}
                  disabled={streaming}
                  className="h-8 px-2 text-xs"
                >
                  Actual
                </Button>
              </div>

              {source === "actual" && (
                <div className="flex items-center gap-2">
                  <select
                    className="h-8 px-2 border rounded-md bg-background text-xs"
                    value={selectedCameraId ?? ""}
                    onChange={(e) =>
                      setSelectedCameraId(
                        e.target.value ? e.target.value : CAMERAS[0]?.id ?? null
                      )
                    }
                    disabled={streaming}
                  >
                    {CAMERAS.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 ml-auto">
                {allImages.length > 0 && (
                  <Badge variant="success">
                    {allImages.length}/{MAX_UPLOAD} images
                  </Badge>
                )}
                {allImages.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setCapturedBlobs([]);
                      setForm((prev) => ({ ...prev, photoFiles: [] }));
                    }}
                    className="h-8 px-2 text-xs"
                  >
                    Clear All
                  </Button>
                )}
                <Button
                  variant={streaming ? "secondary" : "default"}
                  onClick={streaming ? stopCamera : startCamera}
                  type="button"
                  className="h-8 px-2 text-xs"
                  size="sm"
                >
                  {streaming
                    ? "Stop Camera"
                    : source === "device"
                    ? "Start Device Camera"
                    : `Start ${
                        CAMERAS.find((c) => c.id === selectedCameraId)?.name ||
                        "Camera"
                      }`}
                </Button>
                <Button
                  onClick={captureFrame}
                  type="button"
                  disabled={
                    capturedBlobs.length >= MAX_UPLOAD ||
                    !streaming ||
                    (form.photoFiles && form.photoFiles.length > 0)
                  }
                  className="h-8 px-2 text-xs"
                >
                  Capture
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative w-full aspect-video bg-muted rounded-md overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  autoPlay
                />
              </div>
              <div className="relative w-full aspect-video rounded-md overflow-hidden">
                {/* <canvas ref={canvasRef} className="hidden" /> */}
                <video
                  ref={canvasRef}
                  className="w-full h-full object-cover border rounded-md bg-muted hidden"
                  muted
                  playsInline
                  autoPlay
                />
                <div className="grid grid-cols-3 gap-2 bg-muted rounded-md">
                  {allImages.length === 0 ? (
                    <div className="col-span-3 text-center text-sm text-muted-foreground py-8">
                      No images selected. Upload photos or capture from camera.
                    </div>
                  ) : (
                    allImages.map((item, idx) => (
                      <div
                        key={`${item.type}-${item.index}-${idx}`}
                        className="relative w-full aspect-square bg-background rounded-md overflow-hidden"
                      >
                        <Image
                          src={URL.createObjectURL(item.data)}
                          alt={
                            item.type === "file"
                              ? `Uploaded image ${item.index + 1}`
                              : `Captured image ${item.index + 1}`
                          }
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (item.type === "file") {
                              removeUploadedAt(item.index);
                            } else {
                              removeCapturedAt(item.index);
                            }
                          }}
                          className="absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                          aria-label="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className=" top-2 left-2 right-2 z-10 border mb-4 g-red-100 border border-red-300 text-red-500 rounded-md p-2">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <SuccessPopup
                message={successMsg}
                onClose={() => setSuccessMsg("")}
                autoClose={true}
                autoCloseDelay={3000}
              />
            )}

            <div className="flex  !mt-4">
              <Button
                onClick={submitForm}
                disabled={!canSubmit || submitting}
                className="w-2/4"
              >
                {submitting ? "Submitting..." : "Register Student"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <RegistrationInstructionsCard sampleImages={sampleImages} />
      </div>
    </div>
  );
}

function RegistrationInstructionsCard({
  sampleImages,
}: {
  sampleImages: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Picture Upload Guidelines</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          For best face embeddings, use clear, frontal face images with good
          lighting. Avoid images where the face is very small, heavily occluded,
          or turned away.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="font-medium text-foreground mb-1">Good examples</p>
            <div className="space-y-2">
              <p>
                - Single person in frame, face centered and clearly visible.
              </p>
              <p>- Neutral expression or slight smile.</p>
              <p>- No heavy shadows, sunglasses, or large obstructions.</p>
            </div>
          </div>

          <div>
            <p className="font-medium text-foreground mb-1">Bad examples</p>
            <div className="space-y-2">
              <p>- Multiple faces in the same image.</p>
              <p>- Face heavily tilted, turned away, or cropped.</p>
              <p>
                - Strong backlight, motion blur, masks, or large accessories.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-2">
          {sampleImages.map((src, idx) => (
            <div
              key={idx}
              className="w-22 h-21 rounded-md overflow-hidden bg-muted border"
            >
              <img
                src={src}
                alt={`Sample correct embedding ${idx + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const parent = e.currentTarget.parentElement as HTMLElement;
                  if (parent) parent.style.display = "none";
                }}
              />
            </div>
          ))}
          {sampleImages.length === 0 && (
            <div className="col-span-4 flex justify-center my-2">
              <div className="w-full max-w-2xl rounded-md overflow-hidden bg-muted border">
                <Image
                  src="/gudieline.png"
                  alt="Picture Upload Guidelines"
                  width={400}
                  height={400}
                  className="w-full h-auto max-h-[450px] object-contain"
                  unoptimized
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
