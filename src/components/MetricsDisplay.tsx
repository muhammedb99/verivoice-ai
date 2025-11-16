import { Card } from "@/components/ui/card";
import { Clock, TrendingUp, FileText } from "lucide-react";

interface MetricsDisplayProps {
  metrics: {
    totalTime: number;
    confidence: number;
    sourcesFound: number;
  };
  className?: string;
}

export const MetricsDisplay = ({ metrics, className }: MetricsDisplayProps) => {
  return (
    <Card className={`p-6 border-2 ${className}`}>
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Performance Metrics</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Processing Time</p>
            <p className="text-xl font-semibold">{(metrics.totalTime / 1000).toFixed(2)}s</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-success/10 rounded-lg">
            <TrendingUp className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Confidence</p>
            <p className="text-xl font-semibold">{Math.round(metrics.confidence * 100)}%</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 rounded-lg">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Sources Found</p>
            <p className="text-xl font-semibold">{metrics.sourcesFound}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};
