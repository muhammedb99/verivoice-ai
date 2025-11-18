import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Square, Upload } from "lucide-react";
import { toast } from "sonner";

interface VoiceRecorderProps {
  onVoiceData: (base64Audio: string) => void;
  isProcessing: boolean;
  language: string;
}

export const VoiceRecorder = ({ onVoiceData, isProcessing, language }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Setup audio visualization
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      const visualize = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average / 255);
        
        animationFrameRef.current = requestAnimationFrame(visualize);
      };
      visualize();

      // Setup recording
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        
        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          const base64Data = base64Audio.split(',')[1];
          onVoiceData(base64Data);
        };
        reader.readAsDataURL(audioBlob);
        
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.success("Recording started");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Failed to access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      setAudioLevel(0);
      toast.success("Recording stopped");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large (max 10MB)");
        return;
      }
      
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result as string;
        const base64Data = base64Audio.split(',')[1];
        onVoiceData(base64Data);
        toast.success("Audio file uploaded");
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Card className="p-8 shadow-lg border-2">
      <div className="flex flex-col items-center gap-6">
        {/* Waveform Visualization */}
        <div className="w-full h-24 bg-muted/50 rounded-lg flex items-center justify-center gap-1 px-4 overflow-hidden">
          {isRecording ? (
            Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full transition-all duration-100"
                style={{
                  height: `${Math.max(10, audioLevel * 100 * (0.5 + Math.random() * 0.5))}%`,
                  opacity: 0.5 + audioLevel * 0.5,
                }}
              />
            ))
          ) : (
            <p className="text-muted-foreground text-sm">
              {isProcessing ? "Processing audio..." : "Press record to start"}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-4 items-center">
          {!isRecording ? (
            <>
              <Button
                size="lg"
                onClick={startRecording}
                disabled={isProcessing}
                className="h-16 w-16 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                <Mic className="w-6 h-6" />
              </Button>
              
              <div className="relative">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="Upload audio file"
                />
                <Button
                  variant="outline"
                  size="lg"
                  disabled={isProcessing}
                  className="h-16 w-16 rounded-full"
                >
                  <Upload className="w-6 h-6" />
                </Button>
              </div>
            </>
          ) : (
            <Button
              size="lg"
              onClick={stopRecording}
              variant="destructive"
              className="h-16 w-16 rounded-full shadow-lg animate-pulse"
            >
              <Square className="w-6 h-6" />
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground text-center">
          {isRecording
            ? "Recording... Click stop when finished"
            : "Click the microphone to start recording or upload an audio file"}
        </p>
      </div>
    </Card>
  );
};
