import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "./pages/Home";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/Terms"));
const PaymentResult = lazy(() => import("./pages/PaymentResult"));
const ChatbotWidget = lazy(() => import("./components/ChatbotWidget"));

function PageFallback() {
  return <div className="min-h-screen bg-white" />;
}

// Native-style page transition: a soft slide + fade instead of an
// instant hard swap, so moving between screens feels like an app
// rather than a website reloading a new page.
const pageTransition = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
};

function Router() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={location} {...pageTransition}>
        <Switch location={location}>
          <Route path={"/"} component={Home} />
          <Route path={"/login"}>
            <Suspense fallback={<PageFallback />}>
              <Login />
            </Suspense>
          </Route>
          <Route path={"/registro"}>
            <Suspense fallback={<PageFallback />}>
              <Register />
            </Suspense>
          </Route>
          <Route path={"/dashboard"}>
            <Suspense fallback={<PageFallback />}>
              <Dashboard />
            </Suspense>
          </Route>
          <Route path={"/privacidad"}>
            <Suspense fallback={<PageFallback />}>
              <PrivacyPolicy />
            </Suspense>
          </Route>
          <Route path={"/terminos"}>
            <Suspense fallback={<PageFallback />}>
              <Terms />
            </Suspense>
          </Route>
          <Route path={"/pago/exito"}>
            <Suspense fallback={<PageFallback />}>
              <PaymentResult status="success" />
            </Suspense>
          </Route>
          <Route path={"/pago/cancelado"}>
            <Suspense fallback={<PageFallback />}>
              <PaymentResult status="cancelled" />
            </Suspense>
          </Route>
          <Route path={"/404"} component={NotFound} />
          {/* Final fallback route */}
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider
          defaultTheme="light"
          // switchable
        >
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
              <Suspense fallback={null}>
                <ChatbotWidget />
              </Suspense>
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
