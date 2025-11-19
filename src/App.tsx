import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { SmileGate } from "@/components/SmileGate";

const queryClient = new QueryClient();

const App = () => {
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const accessGranted = localStorage.getItem("smile_access_granted");
    if (accessGranted === "true") {
      setHasAccess(true);
    }
  }, []);

  const handleAccessGranted = () => {
    localStorage.setItem("smile_access_granted", "true");
    setHasAccess(true);
  };

  if (!hasAccess) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <SmileGate onAccessGranted={handleAccessGranted} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
