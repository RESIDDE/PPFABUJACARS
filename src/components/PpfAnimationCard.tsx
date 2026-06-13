import { Card, CardContent } from "@/components/ui/card";

export function PpfAnimationCard() {
  return (
    <Card className="relative overflow-hidden border-primary/20 col-span-full bg-card dark:bg-[#0a0a0c]">
      <CardContent className="p-0 h-48 sm:h-56 flex items-center justify-center relative">

        {/* Background mesh grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.07)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_70%,transparent_100%)]" />

        {/* Corner accents */}
        <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />

        {/* Welcome Text */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 whitespace-nowrap z-20 welcome-text">
          <h2 className="text-xl sm:text-2xl font-black tracking-[0.15em] uppercase text-black dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-primary dark:to-cyan-400">
            Welcome — PPF Abuja Cars
          </h2>
        </div>

        {/* ── Race Track Scene ── */}
        <div className="absolute inset-0 flex flex-col justify-end">
          {/* Track ground */}
          <div className="relative w-full h-14 bg-gradient-to-b from-slate-700 to-slate-800 dark:from-slate-800 dark:to-slate-900 border-t-2 border-slate-600">
            {/* Dashed centre line */}
            <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 flex gap-4 px-4 overflow-hidden">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="h-full w-10 flex-shrink-0 bg-yellow-400/70 rounded centre-stripe" style={{ animationDelay: `${i * -0.1}s` }} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Sport Car + Smoke ── */}
        <div className="absolute car-scene" style={{ bottom: "52px", left: 0, right: 0 }}>
          {/* Smoke puffs — behind car */}
          <div className="absolute smoke-wrap" style={{ left: "calc(50% - 110px)", bottom: "6px" }}>
            <div className="smoke smoke-1" />
            <div className="smoke smoke-2" />
            <div className="smoke smoke-3" />
            <div className="smoke smoke-4" />
          </div>

          {/* SVG Sport Car */}
          <svg
            className="sport-car"
            viewBox="0 0 200 70"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: 180, height: 64, position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 0 }}
          >
            {/* Shadow */}
            <ellipse cx="100" cy="67" rx="80" ry="4" fill="rgba(0,0,0,0.3)" />

            {/* Body bottom */}
            <rect x="10" y="40" width="180" height="18" rx="6" fill="#7c3aed" />

            {/* Side sill */}
            <rect x="22" y="52" width="156" height="7" rx="3" fill="#5b21b6" />

            {/* Splitter / front lip */}
            <rect x="155" y="55" width="30" height="5" rx="2" fill="#4c1d95" />

            {/* Rear diffuser */}
            <rect x="8" y="54" width="20" height="5" rx="2" fill="#4c1d95" />

            {/* Main cabin (swept coupe shape) */}
            <path d="M 40 40 Q 60 10 90 8 L 145 8 Q 170 8 178 40 Z" fill="#6d28d9" />

            {/* Windshield */}
            <path d="M 100 12 Q 118 11 138 15 L 170 40 L 100 40 Z" fill="#a5f3fc" fillOpacity="0.5" />

            {/* Rear window */}
            <path d="M 58 40 L 70 17 Q 80 10 96 10 L 100 40 Z" fill="#a5f3fc" fillOpacity="0.45" />

            {/* Window divider pillar */}
            <line x1="100" y1="10" x2="100" y2="40" stroke="#4c1d95" strokeWidth="2" />

            {/* Rear wing */}
            <rect x="12" y="26" width="28" height="4" rx="2" fill="#c4b5fd" />
            <rect x="16" y="26" width="3" height="14" rx="1" fill="#c4b5fd" />
            <rect x="33" y="26" width="3" height="14" rx="1" fill="#c4b5fd" />

            {/* Door line detail */}
            <path d="M 85 42 Q 120 40 155 42" stroke="#9333ea" strokeWidth="1" fill="none" />

            {/* Headlight */}
            <ellipse cx="178" cy="45" rx="8" ry="5" fill="#fef3c7" />
            <ellipse cx="178" cy="45" rx="5" ry="3" fill="#fde68a" />
            {/* Headlight glow */}
            <ellipse cx="183" cy="45" rx="10" ry="4" fill="#fef08a" fillOpacity="0.3" />

            {/* Tail light */}
            <rect x="10" y="41" width="10" height="10" rx="3" fill="#f87171" />
            <rect x="10" y="41" width="10" height="10" rx="3" fill="#ef4444" fillOpacity="0.6" />

            {/* Wheels */}
            {/* Rear */}
            <circle cx="48" cy="56" r="12" fill="#1e293b" />
            <circle cx="48" cy="56" r="8" fill="#334155" />
            <circle cx="48" cy="56" r="4" fill="#94a3b8" />
            {/* spokes */}
            {[0, 60, 120, 180, 240, 300].map(a => {
              const rad = (a * Math.PI) / 180;
              return <line key={a} x1={48 + Math.cos(rad) * 4} y1={56 + Math.sin(rad) * 4} x2={48 + Math.cos(rad) * 8} y2={56 + Math.sin(rad) * 8} stroke="#94a3b8" strokeWidth="1.5" />;
            })}

            {/* Front */}
            <circle cx="152" cy="56" r="12" fill="#1e293b" />
            <circle cx="152" cy="56" r="8" fill="#334155" />
            <circle cx="152" cy="56" r="4" fill="#94a3b8" />
            {[0, 60, 120, 180, 240, 300].map(a => {
              const rad = (a * Math.PI) / 180;
              return <line key={a} x1={152 + Math.cos(rad) * 4} y1={56 + Math.sin(rad) * 4} x2={152 + Math.cos(rad) * 8} y2={56 + Math.sin(rad) * 8} stroke="#94a3b8" strokeWidth="1.5" />;
            })}

            {/* PPF branding stripe */}
            <path d="M 55 38 L 148 38 L 145 42 L 58 42 Z" fill="#c4b5fd" fillOpacity="0.25" />

            {/* Exhaust pipe */}
            <rect x="16" y="55" width="10" height="4" rx="2" fill="#64748b" />
          </svg>
        </div>

        {/* Branding pill */}
        <div className="absolute bottom-5 left-6 flex items-center gap-3 z-10">
          <div className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary dark:bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary dark:bg-cyan-500" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-foreground dark:text-white tracking-[0.2em] uppercase">Paint Protection Film</p>
            <p className="text-[10px] text-muted-foreground dark:text-white/50 tracking-wider uppercase">Abuja Cars</p>
          </div>
        </div>

        {/* Speed lines */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden speed-lines-wrap">
          {[15, 30, 45, 60, 72].map((top, i) => (
            <div
              key={i}
              className="speed-line"
              style={{ top: `${top}%`, animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          /* ── Welcome text ── */
          .welcome-text {
            opacity: 0;
            animation: fade-up 0.9s ease-out 0.3s forwards;
          }
          @keyframes fade-up {
            from { opacity: 0; transform: translate(-50%, 12px); }
            to   { opacity: 1; transform: translate(-50%, 0); }
          }

          /* ── Car continous drive ── */
          .sport-car {
            animation: car-drive 0.18s ease-in-out infinite alternate;
          }
          @keyframes car-drive {
            from { transform: translateX(-50%) translateY(0); }
            to   { transform: translateX(-50%) translateY(-3px); }
          }

          /* ── Smoke puffs ── */
          .smoke-wrap { position: absolute; }
          .smoke {
            position: absolute;
            border-radius: 50%;
            background: rgba(200,200,200,0.55);
            filter: blur(4px);
            animation: smoke-rise 1.4s ease-out infinite;
          }
          .smoke-1 { width: 18px; height: 18px; left: 0;    animation-delay: 0s;    animation-duration: 1.6s; }
          .smoke-2 { width: 24px; height: 24px; left: -8px; animation-delay: 0.4s;  animation-duration: 1.8s; }
          .smoke-3 { width: 14px; height: 14px; left: 6px;  animation-delay: 0.8s;  animation-duration: 1.4s; }
          .smoke-4 { width: 20px; height: 20px; left: -14px;animation-delay: 1.1s;  animation-duration: 1.9s; }

          @keyframes smoke-rise {
            0%   { transform: translateY(0)    scale(0.4); opacity: 0.8; }
            40%  { transform: translateY(-20px) scale(1);  opacity: 0.5; }
            100% { transform: translateY(-55px) scale(1.8); opacity: 0; }
          }

          /* ── Centre track stripe ── */
          .centre-stripe {
            animation: stripe-scroll 0.7s linear infinite;
          }
          @keyframes stripe-scroll {
            from { transform: translateX(0); }
            to   { transform: translateX(-56px); }
          }

          /* ── Speed lines ── */
          .speed-lines-wrap {}
          .speed-line {
            position: absolute;
            left: -100%;
            height: 1px;
            width: 40%;
            background: linear-gradient(to right, transparent, rgba(139,92,246,0.4), transparent);
            animation: speed-line-move 0.9s linear infinite;
          }
          @keyframes speed-line-move {
            from { left: 110%; }
            to   { left: -60%; }
          }
        `}} />
      </CardContent>
    </Card>
  );
}
