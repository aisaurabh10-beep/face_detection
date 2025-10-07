"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CLASSES, getDivisionsForClass } from "@/lib/helper";
import { MAX_UPLOAD } from "@/lib/constants";

export default function RegisterStudentPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [capturedBlobs, setCapturedBlobs] = useState<Blob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  console.log("capturedBlobs", capturedBlobs);

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
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = media as MediaStream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch (err) {
      setErrorMsg("Unable to access camera");
    }
  }, []);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | undefined;
    stream?.getTracks().forEach((t) => t.stop());
    setStreaming(false);
  }, []);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const totalCount = (form.photoFiles?.length || 0) + capturedBlobs.length;
    if (totalCount >= MAX_UPLOAD) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
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

  console.log("form.photoFiles", form.photoFiles);

  const removeCapturedAt = (idx: number) => {
    setCapturedBlobs((prev) => prev.filter((_, i) => i !== idx));
  };

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
          console.log("adding file", file);
          toUpload.push(file);
        });
      } else if (form.photoFiles.length > 0) {
        console.log("adding form.photoFiles", form.photoFiles);
        form.photoFiles.forEach((file, idx) => {
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
    } catch (e) {
      setErrorMsg("Registration failed. Please verify inputs.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, form, capturedBlobs]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Student Details</CardTitle>
            </CardHeader>
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
                  Upload Photos (max 3)
                </p>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoFiles}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={streaming ? "secondary" : "default"}
                  onClick={streaming ? stopCamera : startCamera}
                  type="button"
                >
                  {streaming ? "Stop Camera" : "Start Camera"}
                </Button>
                <Button
                  onClick={captureFrame}
                  type="button"
                  disabled={
                    capturedBlobs.length >= MAX_UPLOAD ||
                    !streaming ||
                    (form.photoFiles && form.photoFiles.length > 0)
                  }
                >
                  Capture
                </Button>
                {capturedBlobs.length > 0 && (
                  <Badge variant="success">
                    {capturedBlobs.length}/{MAX_UPLOAD} captured
                  </Badge>
                )}
                {capturedBlobs.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCapturedBlobs([])}
                  >
                    Clear Captures
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative w-full aspect-video bg-muted rounded-md overflow-hidden">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                </div>
                <div className="relative w-full aspect-video rounded-md overflow-hidden p-3">
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="grid grid-cols-3 gap-3">
                    {capturedBlobs.map((blob, idx) => (
                      <div
                        key={`cap-${idx}`}
                        className="relative w-full aspect-square bg-background rounded-md overflow-hidden"
                      >
                        <img
                          src={URL.createObjectURL(blob)}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeCapturedAt(idx)}
                          className="absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white"
                          aria-label="Remove capture"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="text-sm text-red-500">{errorMsg}</div>
              )}
              {successMsg && (
                <div className="text-sm text-green-500">{successMsg}</div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={submitForm}
                  disabled={!canSubmit || submitting}
                >
                  {submitting ? "Submitting..." : "Register Student"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instructions (POC)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>- You can either upload a photo or capture from webcam.</p>
              <p>- Face encoding will be generated by backend automatically.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
