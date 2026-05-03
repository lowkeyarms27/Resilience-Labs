import React, { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import { BootScreen } from "@/components/boot-screen";

if (typeof window !== "undefined") {
  document.documentElement.classList.add("dark");
}

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [booted, setBooted] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {!booted && <BootScreen onComplete={() => setBooted(true)} />}
        <div
          className={`transition-opacity duration-700 ${booted ? "opacity-100" : "opacity-0"}`}
        >
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </div>
        <Toaster />
        <SonnerToaster position="bottom-right" theme="dark" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
