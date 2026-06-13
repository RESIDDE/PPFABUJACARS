import { Car } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function PpfAnimationCard() {
  return (
    <Card className="relative overflow-hidden border-primary/20 group col-span-full bg-card dark:bg-[#0a0a0c]">
      <CardContent className="p-0 h-48 sm:h-56 flex items-center justify-center relative">
        {/* Deep background mesh grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.1)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

        {/* Decorative corner accents */}
        <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />

        {/* The Cars Container */}
        <div className="relative w-full max-w-sm h-full flex items-center justify-center drive-in">
          
          {/* Welcome Text */}
          <div className="absolute top-2 sm:top-0 left-1/2 -translate-x-1/2 whitespace-nowrap welcome-text z-20">
            <h2 className="text-xl sm:text-2xl font-black tracking-[0.15em] uppercase text-black dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-primary dark:to-cyan-400 dark:drop-shadow-[0_0_15px_rgba(139,92,246,0.3)]">
              Welcome Abuja Cars
            </h2>
          </div>
          {/* Moving Car Wrapper */}
          <div className="absolute inset-0 flex items-center justify-center car-bounce">
            {/* Base Car - Matte / Unwrapped */}
            <div className="absolute inset-0 flex items-center justify-center opacity-40">
              <Car className="w-32 h-32 sm:w-48 sm:h-48 text-slate-400 dark:text-slate-500" strokeWidth={1} />
            </div>

            {/* Animated Wrapped Car Container */}
            <div className="absolute inset-0 flex items-center justify-center ai-wrap-mask">
              {/* The "Wrapped" Car - Glowing / Vibrant */}
              <Car 
                className="w-32 h-32 sm:w-48 sm:h-48 text-black dark:text-primary dark:drop-shadow-[0_0_20px_rgba(139,92,246,0.6)]" 
                strokeWidth={1.5} 
              />
            </div>

            {/* Scanning Laser Line */}
            <div className="absolute top-1/2 -translate-y-1/2 h-32 sm:h-48 w-[2px] bg-primary dark:bg-cyan-400 shadow-[0_0_15px_3px_rgba(139,92,246,0.6)] dark:shadow-[0_0_15px_3px_rgba(34,211,238,0.8)] ai-scan-line rounded-full z-10" />
          </div>
        </div>

        {/* Overlay Text */}
        <div className="absolute bottom-5 left-6 flex items-center gap-3">
          <div className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary dark:bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary dark:bg-cyan-500"></span>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-foreground dark:text-white tracking-[0.2em] uppercase">Paint Protection Film</p>
            <p className="text-[10px] text-muted-foreground dark:text-white/50 tracking-wider uppercase">Abuja Cars</p>
          </div>
        </div>

        {/* Encapsulated Styles for the animation */}
        <style dangerouslySetInnerHTML={{__html: `
          .drive-in {
            animation: drive-in-anim 1.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          }

          .welcome-text {
            opacity: 0;
            animation: text-fade-in 1s ease-out 1.2s forwards;
          }

          .car-bounce {
            animation: bounce-anim 0.5s ease-in-out 3;
          }

          @keyframes bounce-anim {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }

          @keyframes drive-in-anim {
            0% { transform: translateX(-150%); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
          }

          @keyframes text-fade-in {
            0% { opacity: 0; transform: translate(-50%, 15px) scale(0.95); filter: blur(5px); }
            100% { opacity: 1; transform: translate(-50%, 0) scale(1); filter: blur(0); }
          }

          .ai-wrap-mask {
            mask-image: linear-gradient(to right, black 50%, transparent 50%);
            -webkit-mask-image: linear-gradient(to right, black 50%, transparent 50%);
            mask-size: 200% 100%;
            -webkit-mask-size: 200% 100%;
            animation: scan-mask 4s ease-in-out infinite;
          }

          .ai-scan-line {
            animation: scan-line 4s ease-in-out infinite;
          }

          @keyframes scan-mask {
            0% {
              mask-position: 200% 0;
              -webkit-mask-position: 200% 0;
            }
            100% {
              mask-position: -20% 0;
              -webkit-mask-position: -20% 0;
            }
          }

          @keyframes scan-line {
            0% {
              left: 10%;
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            90% {
              opacity: 1;
            }
            100% {
              left: 90%;
              opacity: 0;
            }
          }
        `}} />
      </CardContent>
    </Card>
  );
}
