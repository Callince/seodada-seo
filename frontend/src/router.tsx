import { lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { AdminShell } from "@/routes/admin/AdminShell";
import { AdminSection } from "@/routes/admin/sections/_shared";
import AdminLogin from "@/routes/admin/AdminLogin";
import Blog from "@/routes/public/Blog";
import BlogPost from "@/routes/public/BlogPost";
import Contact from "@/routes/public/Contact";
import ContentPage from "@/routes/public/ContentPage";
import Features from "@/routes/public/Features";
import Landing from "@/routes/public/Landing";
import PillarGuide from "@/routes/public/PillarGuide";
import ForgotPassword from "@/routes/ForgotPassword";
import Login from "@/routes/Login";
import OAuthCallback from "@/routes/OAuthCallback";
import ResetPassword from "@/routes/ResetPassword";
import { PublicShell } from "@/routes/public/PublicShell";
import Pricing from "@/routes/public/Pricing";
import WebStories from "@/routes/public/WebStories";
import WebStoryViewer from "@/routes/public/WebStoryViewer";
import Register from "@/routes/Register";
import { useAuth } from "@/store/auth";

const Dashboard = lazy(() => import("@/routes/Dashboard"));
const Workspace = lazy(() => import("@/routes/Workspace"));
const SerpRanking = lazy(() => import("@/routes/SerpRanking"));
const KeywordResearch = lazy(() => import("@/routes/KeywordResearch"));
const DomainAnalytics = lazy(() => import("@/routes/DomainAnalytics"));
const Backlinks = lazy(() => import("@/routes/Backlinks"));
const LocalSeo = lazy(() => import("@/routes/LocalSeo"));
const OnPage = lazy(() => import("@/routes/OnPage"));
const ContentAnalysis = lazy(() => import("@/routes/ContentAnalysis"));
const RankTracking = lazy(() => import("@/routes/RankTracking"));
const SiteReport = lazy(() => import("@/routes/SiteReport"));
const Schedules = lazy(() => import("@/routes/Schedules"));
const Projects = lazy(() => import("@/routes/Projects"));
const ProjectDetail = lazy(() => import("@/routes/ProjectDetail"));
// Admin sections (share one lazy chunk from routes/Admin.tsx)
const AdminOverview = lazy(() => import("@/routes/Admin").then((m) => ({ default: m.OverviewTab })));
const AdminUsers = lazy(() => import("@/routes/Admin").then((m) => ({ default: m.UsersTab })));
const AdminContent = lazy(() => import("@/routes/Admin").then((m) => ({ default: m.ContentTab })));
const AdminPlans = lazy(() => import("@/routes/Admin").then((m) => ({ default: m.PlansTab })));
const AdminBillingSec = lazy(() => import("@/routes/Admin").then((m) => ({ default: m.BillingTab })));
const AdminSettings = lazy(() => import("@/routes/Admin").then((m) => ({ default: m.SettingsTab })));
const AdminContact = lazy(() => import("@/routes/admin/tabs/ContactTab").then((m) => ({ default: m.ContactTab })));
const AdminEmails = lazy(() => import("@/routes/admin/tabs/EmailsTab").then((m) => ({ default: m.EmailsTab })));
const AdminUsage = lazy(() => import("@/routes/admin/tabs/UsageTab").then((m) => ({ default: m.UsageTab })));
const AdminRoles = lazy(() => import("@/routes/admin/tabs/RolesTab").then((m) => ({ default: m.RolesTab })));
const Competitors = lazy(() => import("@/routes/Competitors"));
const SiteAudit = lazy(() => import("@/routes/SiteAudit"));
const AiVisibility = lazy(() => import("@/routes/AiVisibility"));
const Billing = lazy(() => import("@/routes/Billing/Billing"));
const AnalyzeTool = lazy(() => import("@/routes/Tools/AnalyzeTool"));
const AllInOne = lazy(() => import("@/routes/Tools/AllInOne"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/oauth", element: <OAuthCallback /> },

  // Public marketing site — copy migrated from the seodada templates.
  {
    element: <PublicShell />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/features", element: <Features /> },
      { path: "/pricing", element: <Pricing /> },
      { path: "/about", element: <ContentPage slug="about" title="About seodada" /> },
      { path: "/help", element: <ContentPage slug="help" title="Help center" /> },
      { path: "/contact", element: <Contact /> },
      { path: "/blog", element: <Blog /> },
      { path: "/blog/:slug", element: <BlogPost /> },
      { path: "/webstories", element: <WebStories /> },
      { path: "/webstories/:slug", element: <WebStoryViewer /> },
      { path: "/guides/technical-seo", element: <PillarGuide /> },
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
      { path: "/backlinks", element: <Backlinks /> },
      { path: "/local", element: <LocalSeo /> },
      { path: "/onpage", element: <OnPage /> },
      { path: "/content", element: <ContentAnalysis /> },
      { path: "/rank", element: <RankTracking /> },
      { path: "/report", element: <SiteReport /> },
      { path: "/schedules", element: <Schedules /> },
      { path: "/projects", element: <Projects /> },
      { path: "/projects/:id", element: <ProjectDetail /> },
      { path: "/competitors", element: <Competitors /> },
      { path: "/audit", element: <SiteAudit /> },
      { path: "/ai-visibility", element: <AiVisibility /> },
      { path: "/billing", element: <Billing /> },
      { path: "/tools", element: <AllInOne /> },
      { path: "/tools/url", element: <AnalyzeTool tool="url" /> },
      { path: "/tools/keyword", element: <AnalyzeTool tool="keyword" /> },
      { path: "/tools/heading", element: <AnalyzeTool tool="heading" /> },
      { path: "/tools/image", element: <AnalyzeTool tool="image" /> },
      { path: "/tools/meta", element: <AnalyzeTool tool="meta" /> },
      { path: "/tools/sitemap", element: <AnalyzeTool tool="sitemap" /> },
    ],
  },

  // Separate admin portal — its own login + shell, gated inside AdminShell.
  { path: "/admin/login", element: <AdminLogin /> },
  {
    element: <AdminShell />,
    children: [
      { path: "/admin", element: <AdminSection perm="dashboard" title="Overview" subtitle="Platform health — users, revenue, and recent activity."><AdminOverview /></AdminSection> },
      { path: "/admin/users", element: <AdminSection perm="user_management" title="Users" subtitle="Accounts, spend, and access."><AdminUsers /></AdminSection> },
      { path: "/admin/content", element: <AdminSection perm="content_management" title="Content" subtitle="Blog posts, categories, and web stories."><AdminContent /></AdminSection> },
      { path: "/admin/plans", element: <AdminSection perm="subscription_management" title="Plans" subtitle="Subscription plans and pricing."><AdminPlans /></AdminSection> },
      { path: "/admin/billing", element: <AdminSection perm="payments" title="Billing" subtitle="Subscriptions, payments, and refunds."><AdminBillingSec /></AdminSection> },
      { path: "/admin/contact", element: <AdminSection perm="contact_submissions" title="Contact" subtitle="Inbound messages from the contact form."><AdminContact /></AdminSection> },
      { path: "/admin/emails", element: <AdminSection perm="email_logs" title="Emails" subtitle="Transactional email log and retries."><AdminEmails /></AdminSection> },
      { path: "/admin/usage", element: <AdminSection perm="search_history" title="Usage" subtitle="Search and API usage history."><AdminUsage /></AdminSection> },
      { path: "/admin/roles", element: <AdminSection perm="manage_roles" title="Roles" subtitle="Staff admins and their permissions."><AdminRoles /></AdminSection> },
      { path: "/admin/settings", element: <AdminSection perm="website_settings" title="Settings" subtitle="Company info, logo, and social links."><AdminSettings /></AdminSection> },
    ],
  },

  { path: "*", element: <Navigate to="/" replace /> },
]);
