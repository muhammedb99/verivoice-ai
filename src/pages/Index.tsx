import { useState } from "react";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { VerificationResult } from "@/components/VerificationResult";
import { LanguageSelector } from "@/components/LanguageSelector";
import { MetricsDisplay } from "@/components/MetricsDisplay";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Type } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Language = "en" | "he" | "ar";

interface Metrics {
  totalTime: number;
  confidence: number;
  sourcesFound: number;
}

interface VerificationData {
  transcript: string;
  verdict: "Supported" | "Refuted" | "Not Enough Info";
  explanation: string;
  citations: Array<{
    title: string;
    snippet: string;
    url: string;
    confidence: number;
  }>;
  audioUrl?: string;
}

const Index = () => {
  const [inputMode, setInputMode] = useState<"voice" | "text">("voice");
  const [language, setLanguage] = useState<Language>("en");
  const [textInput, setTextInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const handleVoiceData = async (audioBlob: Blob) => {
    console.log("Processing voice data:", audioBlob.size, "bytes");
    setIsProcessing(true);
    const startTime = Date.now();

    try {
      // Step 1: Transcribe audio
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('language', language);

      const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('transcribe', {
        body: formData,
      });

      if (transcribeError) {
        throw new Error('Transcription failed');
      }

      const { text } = transcribeData;
      console.log('Transcription:', text);

      // Step 2: Verify claim
      const { data: verificationData, error: verifyError } = await supabase.functions.invoke('verify-claim', {
        body: { claim: text },
      });

      if (verifyError) {
        throw new Error('Verification failed');
      }
      
      setVerificationData(verificationData);
      setMetrics({
        totalTime: Date.now() - startTime,
        confidence: verificationData.confidence,
        sourcesFound: verificationData.citations.length,
      });
    } catch (error) {
      console.error('Error processing voice:', error);
      toast.error('Failed to process voice input');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    
    console.log("Processing text input:", textInput);
    setIsProcessing(true);
    const startTime = Date.now();

    try {
      const { data: verificationData, error: verifyError } = await supabase.functions.invoke('verify-claim', {
        body: { claim: textInput },
      });

      if (verifyError) {
        throw new Error('Verification failed');
      }
      
      setVerificationData(verificationData);
      setMetrics({
        totalTime: Date.now() - startTime,
        confidence: verificationData.confidence,
        sourcesFound: verificationData.citations.length,
      });
    } catch (error) {
      console.error('Error processing text:', error);
      toast.error('Failed to verify claim');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <header className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4 shadow-lg">
            <Mic className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Smart Voice Fact-Checker
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Multilingual voice assistant that verifies claims using evidence-based research. 
            Speak your claim or type it, and get instant fact-checking with source citations.
          </p>
          
          {/* Warning Banner */}
          <div className="mt-6 p-4 bg-warning/10 border border-warning/30 rounded-lg max-w-2xl mx-auto">
            <p className="text-sm text-warning-foreground/80">
              ⚠️ <strong>Important:</strong> AI-generated outputs may contain inaccuracies. 
              Always verify critical information with primary sources.
            </p>
          </div>
        </header>

        {/* Language & Mode Selection */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <LanguageSelector value={language} onChange={(val) => setLanguage(val as Language)} />
          
          <div className="flex gap-2">
            <Button
              variant={inputMode === "voice" ? "default" : "outline"}
              onClick={() => setInputMode("voice")}
              className="gap-2"
            >
              <Mic className="w-4 h-4" />
              Voice Input
            </Button>
            <Button
              variant={inputMode === "text" ? "default" : "outline"}
              onClick={() => setInputMode("text")}
              className="gap-2"
            >
              <Type className="w-4 h-4" />
              Text Input
            </Button>
          </div>
        </div>

        {/* Input Area */}
        <div className="mb-8">
          {inputMode === "voice" ? (
            <VoiceRecorder 
              onVoiceData={handleVoiceData}
              isProcessing={isProcessing}
              language={language}
            />
          ) : (
            <div className="space-y-4">
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your claim here..."
                className="min-h-[120px] text-lg resize-none"
                disabled={isProcessing}
              />
              <Button
                onClick={handleTextSubmit}
                disabled={isProcessing || !textInput.trim()}
                className="w-full sm:w-auto"
                size="lg"
              >
                {isProcessing ? "Verifying..." : "Verify Claim"}
              </Button>
            </div>
          )}
        </div>

        {/* Metrics Display */}
        {metrics && (
          <MetricsDisplay metrics={metrics} className="mb-8" />
        )}

        {/* Verification Result */}
        {verificationData && (
          <VerificationResult data={verificationData} />
        )}
      </div>
    </div>
  );
};

export default Index;
