import { useNavigate } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <Shield className="h-8 w-8 text-muted-foreground opacity-40" />
      </div>
      <h1 className="text-4xl font-bold gradient-text mb-2">404</h1>
      <p className="text-lg font-medium text-foreground mb-1">Page Not Found</p>
      <p className="text-sm text-muted-foreground mb-8">The page you're looking for doesn't exist.</p>
      <Button onClick={() => navigate("/dashboard")}>
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Button>
    </div>
  );
}
