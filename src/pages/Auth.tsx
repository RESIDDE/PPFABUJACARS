import { useState } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:justify-center lg:items-center relative overflow-hidden">
      
      {/* Image Section */}
      <div className="relative w-full h-[40vh] lg:absolute lg:inset-0 lg:h-full z-0">
        <img 
          src="/auth-hero.jpg" 
          alt="PPF Abuja Cars" 
          className="w-full h-full object-cover opacity-80 lg:opacity-100"
        />
        {/* Subtle background glow for mobile */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 blur-[100px] rounded-full -z-10 lg:hidden" />
        {/* Dark overlay for desktop to ensure form readability */}
        <div className="hidden lg:block absolute inset-0 bg-black/10" />
      </div>

      {/* Auth Form Container (Bottom Sheet Style on Mobile, Centered Card on Desktop) */}
      <div className="flex-1 w-full lg:flex-none lg:w-[480px] lg:my-8 bg-card/80 lg:bg-card/30 backdrop-blur-3xl rounded-t-[40px] lg:rounded-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] lg:shadow-2xl dark:shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-10 p-8 flex flex-col animate-in slide-in-from-bottom-full lg:fade-in lg:zoom-in duration-700 ease-out border-t lg:border border-border">
        
        <div className="max-w-md w-full mx-auto flex-1 flex flex-col">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              {mode === "login" ? "Welcome Back!" : "Get Started Free"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "welcome back we missed you" : "Free Forever. No Credit Card Needed"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-muted-foreground ml-1">
                {mode === "login" ? "Email Address" : "Email Address"}
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-4 h-5 w-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  required
                  className="w-full bg-muted/50 border border-border rounded-2xl h-14 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-medium text-muted-foreground ml-1">Password</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-4 h-5 w-5 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-muted/50 border border-border rounded-2xl h-14 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
              {mode === "login" && (
                <div className="flex justify-end mt-2">
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full h-14 mt-4 rounded-2xl font-bold text-[15px] text-primary-foreground bg-primary hover:opacity-90 transition-opacity shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.3)] flex items-center justify-center disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (mode === "login" ? "Sign in" : "Sign up")}
            </button>
          </form>

          {/* Social Links */}
          <div className="mt-8">
            <div className="relative flex items-center justify-center mb-6">
              <div className="absolute w-full h-px bg-border" />
              <span className="relative bg-card px-4 text-xs text-muted-foreground">
                Or {mode === "login" ? "continue" : "sign up"} with
              </span>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button className="h-12 w-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </button>
              <button className="h-12 w-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-foreground" fill="currentColor">
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.43.987 3.96.948 1.637-.026 2.62-1.496 3.603-2.998 1.156-1.677 1.631-3.298 1.654-3.385-.038-.013-3.176-1.22-3.195-4.873-.014-3.056 2.493-4.524 2.61-4.605-1.428-2.083-3.628-2.368-4.41-2.42-1.761-.17-3.58 1.037-4.537 1.037zm-1.043-4.62c.844-1.026 1.411-2.454 1.256-3.882-1.225.05-2.709.816-3.578 1.833-.78.88-1.463 2.333-1.284 3.74 1.365.105 2.766-.667 3.606-1.692z" />
                </svg>
              </button>
              <button className="h-12 w-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#1877F2]" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-8 text-center pb-4">
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
