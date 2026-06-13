import { useState } from "react";
import { Menu, Bell, Search } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { Button } from "./ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex relative overflow-hidden">
      {/* Background Image Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/dashboard-background.webp"
          alt="Dashboard Background"
          className="w-full h-full object-cover opacity-60 dark:opacity-40 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-background/50 dark:bg-[#0a0a0c]/60 backdrop-blur-md" />
      </div>

      {/* Sidebar */}
      <div className="relative z-50">
        <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content area — flex column, takes remaining height */}
      <div className="relative z-10 flex-1 flex flex-col lg:ml-[18rem] min-w-0 transition-all duration-300 h-full overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 sticky top-0 z-20 flex items-center gap-4 border-b border-white/10 bg-background/60 backdrop-blur-md px-4 py-3 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1 flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground flex-1 max-w-xs">
              <Search className="h-4 w-4 shrink-0" />
              <span className="text-xs">Search...</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
            </Button>

            <div className="h-8 w-px bg-border" />

            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:block text-xs text-muted-foreground font-medium">PPF Abuja Cars</span>
            </div>
          </div>
        </header>

        {/* Page content — this is the ONLY scrollable area on mobile */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 min-h-0">
          <div className="page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
