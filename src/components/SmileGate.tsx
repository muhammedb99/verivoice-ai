import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Smile, Camera } from "lucide-react";
import { toast } from "sonner";

interface SmileGateProps {
  onAccessGranted: () => void;
}

export const SmileGate = ({ onAccessGranted }: SmileGateProps) => {
  const [isChecking, setIsChecking] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      console.log("Requesting camera access...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 }
      });
      console.log("Camera access granted, stream:", mediaStream);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        console.log("Video started playing");
      }
    } catch (error: any) {
      console.error("Camera access error:", error);
      let errorMessage = "Unable to access camera. ";
      
      if (error.name === "NotAllowedError") {
        errorMessage += "Please allow camera permissions in your browser settings.";
      } else if (error.name === "NotFoundError") {
        errorMessage += "No camera found on your device.";
      } else if (error.name === "NotReadableError") {
        errorMessage += "Camera is already in use by another application.";
      } else if (error.name === "OverconstrainedError") {
        errorMessage += "Camera doesn't support the required settings.";
      } else {
        errorMessage += `Error: ${error.message || "Unknown error"}`;
      }
      
      toast.error(errorMessage);
    }
  };

  const captureAndCheck = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isChecking) return;

    setIsChecking(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL("image/jpeg", 0.8);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-smile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ imageData }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to check smile");
      }

      const data = await response.json();

      if (data.isSmiling) {
        toast.success("Smile detected! Welcome! 😊");
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        setTimeout(() => {
          onAccessGranted();
        }, 1000);
      } else {
        toast.error("No smile detected. Please smile! 😊");
      }
    } catch (error) {
      console.error("Error checking smile:", error);
      toast.error("Failed to verify smile. Please try again.");
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, onAccessGranted, stream]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8 space-y-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Smile className="w-16 h-16 text-primary animate-pulse" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Smile to Enter
          </h1>
          <p className="text-muted-foreground text-lg">
            Show us your beautiful smile to access the Voice Fact-Checker
          </p>
        </div>

        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <Button
          onClick={captureAndCheck}
          disabled={isChecking || !stream}
          size="lg"
          className="w-full"
        >
          <Camera className="mr-2 h-5 w-5" />
          {isChecking ? "Checking..." : "Verify My Smile"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Your image is only used for verification and is not stored
        </p>
      </Card>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
};