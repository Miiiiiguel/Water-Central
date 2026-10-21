import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useEffect, useState } from "react";
import { Redirect, Route, Router, Switch, useLocation } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AppShell } from "@/components/layout/AppShell";
import { SupportWidget } from "@/components/SupportWidget";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useApp } from "@/lib/store";
import Home from "@/pages/Home";

const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Train = lazy(() => import("@/pages/Train"));
const ProgramDetail = lazy(() => import("@/pages/ProgramDetail"));
const WorkoutPlayer = lazy(() => import("@/pages/WorkoutPlayer"));
const WorkoutSummary = lazy(() => import("@/pages/WorkoutSummary"));
const Library = lazy(() => import("@/pages/Library"));
const ExerciseDetail = lazy(() => import("@/pages/ExerciseDetail"));
const Nutrition = lazy(() => import("@/pages/Nutrition"));
const Recipes = lazy(() => import("@/pages/Recipes"));
const RecipeDetail = lazy(() => import("@/pages/RecipeDetail"));
const ArticleDetail = lazy(() => import("@/pages/ArticleDetail"));
const Live = lazy(() => import("@/pages/Live"));
const LiveRoom = lazy(() => import("@/pages/LiveRoom"));
const Videos = lazy(() => import("@/pages/Videos"));
const VideoDetail = lazy(() => import("@/pages/VideoDetail"));
const CoachDetail = lazy(() => import("@/pages/CoachDetail"));
const Progress = lazy(() => import("@/pages/Progress"));
const Community = lazy(() => import("@/pages/Community"));
const Profile = lazy(() => import("@/pages/Profile"));
const Plans = lazy(() => import("@/pages/Plans"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Login = lazy(() => import("@/pages/Login"));
const Shop = lazy(() => import("@/pages/Shop"));
const Achievements = lazy(() => import("@/pages/Achievements"));
const HelpCenter = lazy(() => import("@/pages/HelpCenter"));
const ProductCheckout = lazy(() => import("@/pages/ProductCheckout"));
const History = lazy(() => import("@/pages/History"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const PaymentResult = lazy(() => import("@/pages/PaymentResult"));

function Fallback() {
  return (
    <div className="space-y-4 pt-2">
      <div className="skeleton h-10 w-2/3" />
      <div className="skeleton h-44 w-full" />
      <div className="skeleton h-24 w-full" />
    </div>
  );
}

/** Brand moment on launch, gone in under a second. */
function Splash() {
  const [show, setShow] = useState(() => {
    try {
      return !sessionStorage.getItem("af-splash");
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem("af-splash", "1");
    } catch {
      // Ignore.
    }
    const t = setTimeout(() => setShow(false), 950);
    return () => clearTimeout(t);
  }, [show]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-ink-950"
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="flex flex-col items-center gap-4"
          >
            <span className="grid size-24 place-items-center rounded-[28px] bg-gradient-brand shadow-[0_20px_60px_-10px_rgb(255_59_78/0.8)]">
              <svg viewBox="0 0 40 40" className="size-14" aria-hidden>
                <path d="M20 7.5l3.4 7.6 8.3.8-6.3 5.5 1.9 8.1L20 25.3l-7.3 4.2 1.9-8.1-6.3-5.5 8.3-.8z" fill="#fff" />
                <rect x="9" y="31.5" width="22" height="2.6" rx="1.3" fill="#fff" opacity="0.9" />
              </svg>
            </span>
            <span className="title-display text-4xl">
              American <span className="text-gradient-brand">Fit</span>
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ScrollToTop() {
  const [loc] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc]);
  return null;
}

// Sandboxed hosts (VITE_TARGET=artifact) can't use real URLs, so routing
// stays in memory there.
const memory = import.meta.env.VITE_TARGET === "artifact" ? memoryLocation({ path: "/" }) : null;

export default function App() {
  const app = (
    <AuthProvider>
      <Routes />
      <SupportWidget />
      <Splash />
    </AuthProvider>
  );
  return memory ? <Router hook={memory.hook}>{app}</Router> : app;
}

function Routes() {
  const { ready, user } = useAuth();
  const onboarded = useApp(s => !!s.profile);
  const [loc] = useLocation();

  if (!ready) return <div className="min-h-dvh bg-ink-950" />;
  if (!user) {
    return (
      <Suspense fallback={null}>
        <Login />
      </Suspense>
    );
  }
  if (!onboarded && loc !== "/bienvenida") return <Redirect to="/bienvenida" />;
  if (loc === "/bienvenida") {
    return (
      <Suspense fallback={null}>
        <Onboarding />
      </Suspense>
    );
  }

  return (
    <AppShell>
      <ScrollToTop />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={loc.split("/").slice(0, 3).join("/")}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <Suspense fallback={<Fallback />}>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/entrenar" component={Train} />
              <Route path="/entrenar/programa/:id" component={ProgramDetail} />
              <Route path="/entrenar/sesion" component={WorkoutPlayer} />
              <Route path="/entrenar/resumen/:id" component={WorkoutSummary} />
              <Route path="/tecnica" component={Library} />
              <Route path="/tecnica/:id" component={ExerciseDetail} />
              <Route path="/nutricion" component={Nutrition} />
              <Route path="/nutricion/recetas" component={Recipes} />
              <Route path="/nutricion/recetas/:id" component={RecipeDetail} />
              <Route path="/nutricion/guias/:id" component={ArticleDetail} />
              <Route path="/live" component={Live} />
              <Route path="/live/:id" component={LiveRoom} />
              <Route path="/videos" component={Videos} />
              <Route path="/videos/:id" component={VideoDetail} />
              <Route path="/coaches/:id" component={CoachDetail} />
              <Route path="/progreso" component={Progress} />
              <Route path="/comunidad" component={Community} />
              <Route path="/perfil" component={Profile} />
              <Route path="/planes" component={Plans} />
              <Route path="/historial" component={History} />
              <Route path="/pago/resultado" component={PaymentResult} />
              <Route path="/pago/resultado/:provider" component={PaymentResult} />
              <Route path="/pago/producto/:id" component={ProductCheckout} />
              <Route path="/pago/:plan/:period" component={Checkout} />
              <Route path="/tienda" component={Shop} />
              <Route path="/logros" component={Achievements} />
              <Route path="/ayuda" component={HelpCenter} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
