import { lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import ContentPage from "@/routes/public/ContentPage";
import Landing from "@/routes/public/Landing";
import Login from "@/routes/Login";
import OAuthCallback from "@/routes/OAuthCallback";
import { PublicShell } from "@/routes/public/PublicShell";
import Pricing from "@/routes/public/Pricing";
import Register from "@/routes/Register";
import { useAuth } from "@/store/auth";

const Dashboard = lazy(() => import("@/routes/Dashboard"));
const Workspace = lazy(() => import("@/routes/Workspace"));
const SerpRanking = lazy(() => import("@/routes/SerpRanking"));
const KeywordResearch = lazy(() => import("@/routes/KeywordResearch"));
const DomainAnalytics = lazy(() => import("@/routes/DomainAnalytics"));
const OnPage = lazy(() => import("@/routes/OnPage"));
const ContentAnalysis = lazy(() => import("@/routes/ContentAnalysis"));
const RankTracking = lazy(() => import("@/routes/RankTracking"));
const SiteReport = lazy(() => import("@/routes/SiteReport"));
const Schedules = lazy(() => import("@/routes/Schedules"));
const Projects = lazy(() => import("@/routes/Projects"));
const ProjectDetail = lazy(() => import("@/routes/ProjectDetail"));
const Admin = lazy(() => import("@/routes/Admin"));
const Competitors = lazy(() => import("@/routes/Competitors"));
const SiteAudit = lazy(() => import("@/routes/SiteAudit"));
const AiVisibility = lazy(() => import("@/routes/AiVisibility"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/oauth", element: <OAuthCallback /> },

  // Public marketing site — copy migrated from the seodada templates.
  {
    element: <PublicShell />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/features", element: <Landing /> },
      { path: "/pricing", element: <Pricing /> },
      { path: "/about", element: <ContentPage slug="about" title="About seodada" /> },
      { path: "/help", element: <ContentPage slug="help" title="Help center" /> },
      { path: "/contact", element: <ContentPage slug="contact" title="Contact us" /> },
      { path: "/blog", element: <ContentPage slug="blogs" title="Blog" /> },
      { path: "/privacy", element: <ContentPage slug="privacy" /> },
      { path: "/terms", element: <ContentPage slug="terms" /> },
      { path: "/cookies", element: <ContentPage slug="cookie_policy" /> },
    ],
  },

  // Authenticated application — a pathless layout route so every app page keeps
  // its absolute path (/serp, /keywords, …) unchanged; only the home moved to
  // /dashboard so the marketing landing can own "/".
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/workspace", element: <Workspace /> },
      { path: "/serp", element: <SerpRanking /> },
      { path: "/keywords", element: <KeywordResearch /> },
      { path: "/domains", element: <DomainAnalytics /> },
      { path: "/onpage", element: <OnPage /> },
      { path: "/content", element: <ContentAnalysis /> },
      { path: "/rank", element: <RankTracking /> },
      { path: "/report", element: <SiteReport /> },
      { path: "/schedules", element: <Schedules /> },
      { path: "/projects", element: <Projects /> },
      { path: "/projects/:id", element: <ProjectDetail /> },
      { path: "/admin", element: <Admin /> },
      { path: "/competitors", element: <Competitors /> },
      { path: "/audit", element: <SiteAudit /> },
      { path: "/ai-visibility", element: <AiVisibility /> },
    ],
  },

  { path: "*", element: <Navigate to="/" replace /> },
]);
