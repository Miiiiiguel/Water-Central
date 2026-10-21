import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useEffect } from "react";
import { Redirect, Route, Router, Switch, useLocation } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AppShell } from "@/components/layout/AppShell";
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

function Fallback() {
  return (
    <div className="space-y-4 pt-2">
      <div className="skeleton h-10 w-2/3" />
      <div className="skeleton h-44 w-full" />
      <div className="skeleton h-24 w-full" />
    </div>
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
  return memory ? (
    <Router hook={memory.hook}>
      <Routes />
    </Router>
  ) : (
    <Routes />
  );
}

function Routes() {
  const onboarded = useApp(s => !!s.profile);
  const [loc] = useLocation();

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
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
