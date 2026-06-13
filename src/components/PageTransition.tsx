import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";

// Paper fold variants — desktop only.
// On mobile we fall back to a simple fade so the heavy 3-D math never runs.
const isMobile = () => window.innerWidth < 1024;

const paperFold = {
  initial: {
    opacity: 0,
    rotateX: -35,
    scaleY: 0.88,
    transformOrigin: "top center",
    filter: "brightness(0.7)",
  },
  animate: {
    opacity: 1,
    rotateX: 0,
    scaleY: 1,
    transformOrigin: "top center",
    filter: "brightness(1)",
    transition: {
      duration: 0.52,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    rotateX: 25,
    scaleY: 0.9,
    transformOrigin: "bottom center",
    filter: "brightness(0.6)",
    transition: {
      duration: 0.38,
      ease: [0.55, 0, 1, 0.45],
    },
  },
};

const simpleFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25 } },
  exit:    { opacity: 0, transition: { duration: 0.2 } },
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const variants = isMobile() ? simpleFade : paperFold;

  return (
    // perspective on the parent is what makes rotateX look 3-D
    <div style={{ perspective: "1200px" }} className="w-full h-full">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="w-full h-full"
          style={{ transformStyle: "preserve-3d", willChange: "transform, opacity" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
