import { Suspense, lazy } from "react";
import { Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { AdminShell } from "@/routes/admin/AdminShell";
import { AdminSection } from "@/routes/admin/sections/_shared";
import AdminLogin from "@/routes/admin/AdminLogin";
import ForgotPassword from "@/routes/ForgotPassword";
import Login from "@/routes/Login";
import OAuthCallback from "@/routes/OAuthCallback";
import ResetPassword from "@/routes/ResetPassword";
import Register from "@/routes/Register";
import { useAuth } from "@/store/auth";

// Public marketing site — lazy, so logged-in users never download the landing
// page, blog, or pricing copy in the main bundle.
const PublicShell = lazy(() =>
  import("@/routes/public/PublicShell").then((m) => ({ default: m.PublicShell })),
);
const Landing = lazy(() => import("@/routes/public/Landing"));
const Features = lazy(() => import("@/routes/public/Features"));
const Pricing = lazy(() => import("@/routes/public/Pricing"));
const ContentPage = lazy(() => import("@/routes/public/ContentPage"));
const FreeTools = lazy(() => import("@/routes/public/FreeTools"));
const BlogTitleGenerator = lazy(() => import("@/routes/public/BlogTitleGenerator"));
const ContentChecker = lazy(() => import("@/routes/public/ContentChecker"));
const Contact = lazy(() => import("@/routes/public/Contact"));
const Blog = lazy(() => import("@/routes/public/Blog"));
const BlogPost = lazy(() => import("@/routes/public/BlogPost"));
const WebStories = lazy(() => import("@/routes/public/WebStories"));
const WebStoryViewer = lazy(() => import("@/routes/public/WebStoryViewer"));
const PillarGuide = lazy(() => import("@/routes/public/PillarGuide"));
const Glossary = lazy(() => import("@/routes/public/Glossary"));

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
// Admin sections (one lazy chunk per tab from routes/admin/)
const AdminOverview = lazy(() => import("@/routes/admin/OverviewTab").then((m) => ({ default: m.OverviewTab })));
const AdminUsers = lazy(() => import("@/routes/admin/UsersTab").then((m) => ({ default: m.UsersTab })));
const AdminBlogCategories = lazy(() => import("@/routes/admin/content/BlogCategoriesPage").then((m) => ({ default: m.BlogCategoriesPage })));
const AdminBlogs = lazy(() => import("@/routes/admin/content/BlogsPage").then((m) => ({ default: m.BlogsPage })));
const AdminBlogEdit = lazy(() => import("@/routes/admin/content/BlogEditPage").then((m) => ({ default: m.BlogEditPage })));
const AdminStoryCategories = lazy(() => import("@/routes/admin/content/StoryCategoriesPage").then((m) => ({ default: m.StoryCategoriesPage })));
const AdminStories = lazy(() => import("@/routes/admin/content/StoriesPage").then((m) => ({ default: m.StoriesPage })));
const AdminStoryEdit = lazy(() => import("@/routes/admin/content/StoryEditPage").then((m) => ({ default: m.StoryEditPage })));
const AdminPlans = lazy(() => import("@/routes/admin/PlansTab").then((m) => ({ default: m.PlansTab })));
const AdminBillingSec = lazy(() => import("@/routes/admin/BillingTab").then((m) => ({ default: m.BillingTab })));
const AdminSettings = lazy(() => import("@/routes/admin/SettingsTab").then((m) => ({ default: m.SettingsTab })));
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

/** The route tree, separate from the router built from it.
 *
 * createBrowserRouter touches history/location and cannot run under Node, but
 * the prerender step (scripts/prerender.mjs) needs these exact routes to render
 * each page to static HTML. Exporting the array means the prerender and the
 * browser share ONE definition — a second copy would drift, and the failure
 * mode is silent: pages would prerender against a stale tree and still look
 * fine until someone compared them. */
export const routes: RouteObject[] = [
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/oauth", element: <OAuthCallback /> },

  // Public marketing site — copy migrated from the seodada templates.
  // PublicShell and its pages are lazy; the Suspense here covers the shell,
  // and the one inside PublicShell covers per-page navigation.
  {
    element: (
      <Suspense fallback={<div className="min-h-screen" />}>
        <PublicShell />
      </Suspense>
    ),
    children: [
      { path: "/", element: <Landing /> },
      { path: "/features", element: <Features /> },
      // Public on purpose — NOT inside RequireAuth. These tools were gated,
      // so a visitor clicking a "free tool" was redirected to /login.
      { path: "/free-tools", element: <FreeTools /> },
      // Same URL as the seodada original so existing links and rankings hold.
      { path: "/blog-title-generator", element: <BlogTitleGenerator /> },
      { path: "/content-checker", element: <ContentChecker /> },
      { path: "/pricing", element: <Pricing /> },
      { path: "/about", element: <ContentPage slug="about" title="About seodada" /> },
      { path: "/help", element: <ContentPage slug="help" title="Help center" /> },
      { path: "/contact", element: <Contact /> },
      { path: "/blog", element: <Blog /> },
      { path: "/blog/:slug", element: <BlogPost /> },
      { path: "/webstories", element: <WebStories /> },
      { path: "/webstories/:slug", element: <WebStoryViewer /> },
      { path: "/guides/technical-seo", element: <PillarGuide /> },
      { path: "/glossary", element: <Glossary /> },
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
      { path: "/admin/content", element: <Navigate to="/admin/content/blogs" replace /> },
      { path: "/admin/content/blog-categories", element: <AdminSection perm="content_management" title="Blog categories" subtitle="Organise posts into categories."><AdminBlogCategories /></AdminSection> },
      { path: "/admin/content/blogs", element: <AdminSection perm="content_management" title="Blogs" subtitle="Blog posts and their publish state."><AdminBlogs /></AdminSection> },
      { path: "/admin/content/blogs/new", element: <AdminSection perm="content_management" title="New post" subtitle="Create a blog post."><AdminBlogEdit /></AdminSection> },
      { path: "/admin/content/blogs/:id", element: <AdminSection perm="content_management" title="Edit post" subtitle="Update a blog post."><AdminBlogEdit /></AdminSection> },
      { path: "/admin/content/story-categories", element: <AdminSection perm="content_management" title="Story categories" subtitle="Organise web stories into categories."><AdminStoryCategories /></AdminSection> },
      { path: "/admin/content/stories", element: <AdminSection perm="content_management" title="Stories" subtitle="Web stories and their publish state."><AdminStories /></AdminSection> },
      { path: "/admin/content/stories/new", element: <AdminSection perm="content_management" title="New story" subtitle="Create a web story."><AdminStoryEdit /></AdminSection> },
      { path: "/admin/content/stories/:id", element: <AdminSection perm="content_management" title="Edit story" subtitle="Update a web story."><AdminStoryEdit /></AdminSection> },
      { path: "/admin/plans", element: <AdminSection perm="subscription_management" title="Plans" subtitle="Subscription plans and pricing."><AdminPlans /></AdminSection> },
      { path: "/admin/billing", element: <AdminSection perm="payments" title="Billing" subtitle="Subscriptions, payments, and refunds."><AdminBillingSec /></AdminSection> },
      { path: "/admin/contact", element: <AdminSection perm="contact_submissions" title="Contact" subtitle="Inbound messages from the contact form."><AdminContact /></AdminSection> },
      { path: "/admin/emails", element: <AdminSection perm="email_logs" title="Emails" subtitle="Transactional email log and retries."><AdminEmails /></AdminSection> },
      { path: "/admin/usage", element: <AdminSection perm="search_history" title="Usage" subtitle="Search and API usage history."><AdminUsage /></AdminSection> },
      { path: "/admin/roles", element: <AdminSection perm="manage_roles" title="Roles" subtitle="Staff admins and their permissions."><AdminRoles /></AdminSection> },
      { path: "/admin/settings", element: <AdminSection perm="website_settings" title="Settings" subtitle="Company info, logo, and social links."><AdminSettings /></AdminSection> },
    ],
  },

  // Dev-only visual review sheet for the Aperture system. The lazy() lives
  // INSIDE the dead branch on purpose: a module-scope `lazy(() => import(…))`
  // keeps the dynamic import in the graph and still emits a chunk in
  // production, even when the route itself is conditional.
  ...(import.meta.env.DEV
    ? (() => {
        const DesignReview = lazy(() => import("@/routes/DesignReview"));
        return [
          {
            path: "/design",
            element: (
              <Suspense fallback={null}>
                <DesignReview />
              </Suspense>
            ),
          },
        ];
      })()
    : []),

  { path: "*", element: <Navigate to="/" replace /> },
];
