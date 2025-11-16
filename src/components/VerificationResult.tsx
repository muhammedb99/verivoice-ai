import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, Volume2, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface Citation {
  title: string;
  snippet: string;
  url: string;
  confidence: number;
}

interface VerificationResultProps {
  data: {
    transcript: string;
    verdict: "Supported" | "Refuted" | "Not Enough Info";
    explanation: string;
    citations: Citation[];
    audioUrl?: string;
  };
}

const verdictConfig = {
  Supported: {
    icon: CheckCircle2,
    color: "bg-success text-success-foreground",
    borderColor: "border-success/30",
    bgColor: "bg-success/10",
  },
  Refuted: {
    icon: XCircle,
    color: "bg-destructive text-destructive-foreground",
    borderColor: "border-destructive/30",
    bgColor: "bg-destructive/10",
  },
  "Not Enough Info": {
    icon: AlertCircle,
    color: "bg-warning text-warning-foreground",
    borderColor: "border-warning/30",
    bgColor: "bg-warning/10",
  },
};

export const VerificationResult = ({ data }: VerificationResultProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const config = verdictConfig[data.verdict];
  const Icon = config.icon;

  const playAudio = () => {
    if (data.audioUrl) {
      const audio = new Audio(data.audioUrl);
      audio.play();
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
      {/* Transcript */}
      <Card className="p-6 border-2">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Claim</h3>
        <p className="text-lg">{data.transcript}</p>
      </Card>

      {/* Verdict */}
      <Card className={`p-6 border-2 ${config.borderColor} ${config.bgColor}`}>
        <div className="flex items-start gap-4">
          <div className={`${config.color} p-3 rounded-xl`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <Badge className={config.color} variant="default">
                {data.verdict}
              </Badge>
              {data.audioUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={playAudio}
                  disabled={isPlaying}
                  className="gap-2"
                >
                  <Volume2 className="w-4 h-4" />
                  {isPlaying ? "Playing..." : "Listen"}
                </Button>
              )}
            </div>
            <p className="text-foreground">{data.explanation}</p>
          </div>
        </div>
      </Card>

      {/* Citations */}
      {data.citations.length > 0 && (
        <Card className="p-6 border-2">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Evidence Sources
            <Badge variant="secondary">{data.citations.length}</Badge>
          </h3>
          <div className="space-y-4">
            {data.citations.map((citation, index) => (
              <Collapsible key={index}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium text-primary">{citation.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {Math.round(citation.confidence * 100)}% confidence
                        </Badge>
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View source
                        </a>
                      </div>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        Details
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="pl-4 border-l-2 border-primary/20">
                      <p className="text-sm text-muted-foreground">{citation.snippet}</p>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
