import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { AdminUser, AdminUsersResponse } from "@/types";

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data } = await api.get<AdminUsersResponse>("/admin/users");
      return data;
    },
    staleTime: 15_000,
  });
}

export interface AdminUpdateUserInput {
  id: string;
  full_name?: string;
  role?: "member" | "owner";
  password?: string;
  is_active?: boolean;
  unlimited_usage?: boolean;
  org_name?: string;
}

export function useAdminUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: AdminUpdateUserInput) => {
      const { data } = await api.patch<AdminUser>(`/admin/users/${id}`, patch);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

// ---------------------------------------------------------------- dashboard

export interface AdminStats {
  total_users: number;
  active_users: number;
  total_orgs: number;
  active_subscriptions: number;
  revenue_cents: number;
  mrr_cents: number;
  plan_distribution: { plan: string; count: number }[];
  recent_signups: { email: string; created_at: string }[];
  revenue_series: { date: string; cents: number }[];
  signups_series: { date: string; count: number }[];
  payment_status: { status: string; count: number }[];
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => (await api.get<AdminStats>("/admin/stats")).data,
  });
}

/** Live DataForSEO account balance. Amounts are USD cents (DataForSEO bills in
 *  dollars — unlike the INR revenue figures elsewhere in admin). */
export interface DfsAccount {
  login: string | null;
  balance_cents: number;
  spent_total_cents: number;
  limit_minute: number | null;
  from_cache: boolean;
  error: string | null;
}

export function useDfsAccount() {
  return useQuery({
    queryKey: ["admin", "dfs-account"],
    queryFn: async () => (await api.get<DfsAccount>("/admin/dfs-account")).data,
    // The backend caches upstream for 5 min; match it so tab-switches are free.
    staleTime: 5 * 60_000,
  });
}

// ============================================================= RBAC / roles
export interface AdminMe {
  email: string;
  is_super: boolean;
  permissions: string[];
  all_permissions: string[];
}
export function useAdminMe() {
  return useQuery({
    queryKey: ["admin", "me"],
    queryFn: async () => (await api.get<AdminMe>("/admin/me")).data,
    staleTime: 60_000,
  });
}

export interface AdminRole {
  id: string;
  email: string;
  full_name: string;
  is_super: boolean;
  is_active: boolean;
  permissions: string[];
  created_at: string;
}
export function useAdminRoles() {
  return useQuery({
    queryKey: ["admin", "roles"],
    queryFn: async () => (await api.get<AdminRole[]>("/admin/roles")).data,
  });
}
function useInvalidateRoles() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin", "roles"] });
}
export function useCreateRole() {
  const inv = useInvalidateRoles();
  return useMutation({
    mutationFn: async (body: { email: string; password?: string; full_name?: string; permissions: string[] }) =>
      (await api.post<AdminRole>("/admin/roles", body)).data,
    onSuccess: inv,
  });
}
export function useUpdateRole() {
  const inv = useInvalidateRoles();
  return useMutation({
    mutationFn: async ({ id, ...b }: { id: string; permissions?: string[]; is_active?: boolean; full_name?: string }) =>
      (await api.patch<AdminRole>(`/admin/roles/${id}`, b)).data,
    onSuccess: inv,
  });
}
export function useRevokeRole() {
  const inv = useInvalidateRoles();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/admin/roles/${id}`); },
    onSuccess: inv,
  });
}

// -------------------------------------------------------------------- plans

export interface AdminPlan {
  id: string;
  name: string;
  slug: string;
  price_cents: number;
  currency: string;
  period_days: number;
  usage_per_day: number;
  tier: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export function useAdminPlans() {
  return useQuery({
    queryKey: ["admin", "plans"],
    queryFn: async () => (await api.get<AdminPlan[]>("/admin/plans")).data,
  });
}

function useInvalidatePlans() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin", "plans"] });
}

export function useCreatePlan() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationFn: async (body: Partial<AdminPlan>) => (await api.post<AdminPlan>("/admin/plans", body)).data,
    onSuccess: invalidate,
  });
}

export function useUpdatePlan() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AdminPlan> & { id: string }) =>
      (await api.patch<AdminPlan>(`/admin/plans/${id}`, patch)).data,
    onSuccess: invalidate,
  });
}

export function useArchivePlan() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete<AdminPlan>(`/admin/plans/${id}`)).data,
    onSuccess: invalidate,
  });
}

// ------------------------------------------------------- subscriptions/payments

export interface AdminSubscription {
  id: string;
  org_name: string;
  plan_name: string;
  status: string;
  current_period_end: string | null;
}
export interface AdminPayment {
  id: string;
  org_name: string;
  amount_cents: number;
  tax_cents: number;
  currency: string;
  status: string;
  invoice_number: string;
  created_at: string;
}

export function useAdminSubscriptions() {
  return useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: async () => (await api.get<AdminSubscription[]>("/admin/subscriptions")).data,
  });
}
export function useAdminPayments() {
  return useQuery({
    queryKey: ["admin", "payments"],
    queryFn: async () => (await api.get<AdminPayment[]>("/admin/payments")).data,
  });
}

// ---------------------------------------------------------------- site config

export interface WebsiteSettings {
  company_name: string;
  support_email: string;
  tagline: string;
  logo_url: string;
  favicon_url: string;
  facebook_url: string;
  linkedin_url: string;
  instagram_url: string;
  youtube_url: string;
}

export function useWebsiteSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => (await api.get<WebsiteSettings>("/admin/settings")).data,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<WebsiteSettings>) =>
      (await api.put<WebsiteSettings>("/admin/settings", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "settings"] }),
  });
}

// -------------------------------------------------------------- content mod

export interface AdminBlog {
  id: string;
  title: string;
  slug: string;
  status: string;
  author: string;
  category_id: string | null;
  published_at: string | null;
  updated_at: string;
}
export interface AdminWebStory {
  id: string;
  title: string;
  slug: string;
  status: string;
  category_id: string | null;
  published_at: string | null;
}

export function useAdminBlogs() {
  return useQuery({ queryKey: ["admin", "blogs"], queryFn: async () => (await api.get<AdminBlog[]>("/admin/blogs")).data });
}
export function useAdminWebstories() {
  return useQuery({ queryKey: ["admin", "webstories"], queryFn: async () => (await api.get<AdminWebStory[]>("/admin/webstories")).data });
}

export function useSetContentStatus(kind: "blogs" | "webstories") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "published" | "draft" }) =>
      (await api.patch(`/admin/${kind}/${id}`, { status })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", kind] });
      qc.invalidateQueries({ queryKey: kind === "blogs" ? ["pub-blogs"] : ["pub-stories"] });
    },
  });
}

export function useDeleteContent(kind: "blogs" | "webstories") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/${kind}/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", kind] });
      qc.invalidateQueries({ queryKey: kind === "blogs" ? ["pub-blogs"] : ["pub-stories"] });
    },
  });
}

// ===================================================================== users
export interface AdminUserDetail extends AdminUser {
  subscriptions: { id: string; plan_name: string; status: string; started_at: string; current_period_end: string | null }[];
  payments: { id: string; amount_cents: number; tax_cents: number; currency: string; status: string; invoice_number: string; created_at: string }[];
  recent_usage: { endpoint: string; cost_cents: number; from_cache: boolean; created_at: string }[];
}

export function useUserDetail(id: string | null) {
  return useQuery({
    queryKey: ["admin", "user", id],
    enabled: !!id,
    queryFn: async () => (await api.get<AdminUserDetail>(`/admin/users/${id}`)).data,
  });
}

function useInvalidateUsers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin", "users"] });
}

export function useCreateUser() {
  const inv = useInvalidateUsers();
  return useMutation({
    mutationFn: async (body: { email: string; password: string; full_name?: string; role?: string; org_name?: string }) =>
      (await api.post<AdminUser>("/admin/users", body)).data,
    onSuccess: inv,
  });
}

export function useDeleteUser() {
  const inv = useInvalidateUsers();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/admin/users/${id}`); },
    onSuccess: inv,
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: async (id: string) => (await api.post<{ password: string }>(`/admin/users/${id}/reset-password`)).data,
  });
}

// ============================================================ subscriptions
function useInvalidateBilling() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    qc.invalidateQueries({ queryKey: ["admin", "payments"] });
    qc.invalidateQueries({ queryKey: ["admin", "stats"] });
  };
}

export function useAssignSubscription() {
  const inv = useInvalidateBilling();
  return useMutation({
    mutationFn: async (body: { org_name: string; plan_id: string; days?: number }) =>
      (await api.post<AdminSubscription>("/admin/subscriptions", body)).data,
    onSuccess: inv,
  });
}

export function useExtendSubscription() {
  const inv = useInvalidateBilling();
  return useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) =>
      (await api.post<AdminSubscription>(`/admin/subscriptions/${id}/extend`, { days })).data,
    onSuccess: inv,
  });
}

export function useSetSubscriptionStatus() {
  const inv = useInvalidateBilling();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await api.patch<AdminSubscription>(`/admin/subscriptions/${id}`, { status })).data,
    onSuccess: inv,
  });
}

// ================================================================= payments
export function useSetPaymentStatus() {
  const inv = useInvalidateBilling();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await api.patch<AdminPayment>(`/admin/payments/${id}`, { status })).data,
    onSuccess: inv,
  });
}

export function useRefundPayment() {
  const inv = useInvalidateBilling();
  return useMutation({
    mutationFn: async ({ id, amount_cents, reason }: { id: string; amount_cents?: number; reason?: string }) =>
      (await api.post<AdminPayment>(`/admin/payments/${id}/refund`, { amount_cents, reason })).data,
    onSuccess: inv,
  });
}

/** Fetch a protected file (invoice PDF / CSV) via the JWT client and save it. */
export async function downloadAdminFile(url: string, filename: string, params?: Record<string, unknown>) {
  const res = await api.get(url, { params, responseType: "blob" });
  const href = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

// =========================================================== blog authoring
export interface BlogCategory { id: string; name: string; slug: string; sort_order: number }
export interface AdminBlogDetail {
  id: string; title: string; slug: string; body_html: string; excerpt: string;
  meta_title: string; meta_description: string; meta_keywords: string; cover_image_url: string;
  image_alt: string; author: string; category_id: string | null;
  faqs: { question: string; answer: string }[];
  tldr: string; key_takeaways: string[]; reading_time_minutes: number; is_pillar: boolean;
  status: string; published_at: string | null; updated_at: string;
}
export type BlogInput = Partial<Omit<AdminBlogDetail, "id" | "updated_at" | "published_at">>;

export function useAdminBlogCategories() {
  return useQuery({ queryKey: ["admin", "blog-categories"], queryFn: async () => (await api.get<BlogCategory[]>("/admin/blog-categories")).data });
}
function useInvalidateCategories() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin", "blog-categories"] });
}
export function useCreateCategory() {
  const inv = useInvalidateCategories();
  return useMutation({ mutationFn: async (body: { name: string; sort_order?: number }) => (await api.post<BlogCategory>("/admin/blog-categories", body)).data, onSuccess: inv });
}
export function useUpdateCategory() {
  const inv = useInvalidateCategories();
  return useMutation({ mutationFn: async ({ id, ...b }: { id: string; name?: string; sort_order?: number }) => (await api.patch<BlogCategory>(`/admin/blog-categories/${id}`, b)).data, onSuccess: inv });
}
export function useDeleteCategory() {
  const inv = useInvalidateCategories();
  return useMutation({ mutationFn: async (id: string) => { await api.delete(`/admin/blog-categories/${id}`); }, onSuccess: inv });
}

export function useAdminBlogDetail(id: string | null) {
  return useQuery({
    queryKey: ["admin", "blog", id],
    enabled: !!id,
    queryFn: async () => (await api.get<AdminBlogDetail>(`/admin/blogs/${id}`)).data,
  });
}
function useInvalidateBlogs() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ["admin", "blogs"] }); qc.invalidateQueries({ queryKey: ["pub-blogs"] }); };
}
export function useCreateBlog() {
  const inv = useInvalidateBlogs();
  return useMutation({ mutationFn: async (body: BlogInput) => (await api.post<AdminBlogDetail>("/admin/blogs", body)).data, onSuccess: inv });
}
export function useUpdateBlog() {
  const inv = useInvalidateBlogs();
  return useMutation({ mutationFn: async ({ id, ...body }: BlogInput & { id: string }) => (await api.patch<AdminBlogDetail>(`/admin/blogs/${id}`, body)).data, onSuccess: inv });
}
export function useUploadBlogImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.post<{ url: string }>("/admin/blogs/upload-image", fd)).data;
    },
  });
}

// ======================================================== web story authoring
export interface WebStorySlide {
  image: string; image_alt: string; heading: string; text: string; learn_more_url: string;
}
export interface AdminWebStoryDetail {
  id: string; title: string; slug: string; meta_description: string; cover_image_url: string;
  category_id: string | null;
  slides: WebStorySlide[]; status: string; published_at: string | null;
}
export type WebStoryInput = {
  title?: string; slug?: string; meta_description?: string; cover_image_url?: string;
  category_id?: string | null;
  slides?: WebStorySlide[]; status?: string;
};

export interface WebStoryCategory { id: string; name: string; slug: string; sort_order: number }

export function useAdminWebstoryCategories() {
  return useQuery({ queryKey: ["admin", "webstory-categories"], queryFn: async () => (await api.get<WebStoryCategory[]>("/admin/webstory-categories")).data });
}
function useInvalidateWebstoryCategories() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin", "webstory-categories"] });
}
export function useCreateWebstoryCategory() {
  const inv = useInvalidateWebstoryCategories();
  return useMutation({ mutationFn: async (body: { name: string; sort_order?: number }) => (await api.post<WebStoryCategory>("/admin/webstory-categories", body)).data, onSuccess: inv });
}
export function useUpdateWebstoryCategory() {
  const inv = useInvalidateWebstoryCategories();
  return useMutation({ mutationFn: async ({ id, ...b }: { id: string; name?: string; sort_order?: number }) => (await api.patch<WebStoryCategory>(`/admin/webstory-categories/${id}`, b)).data, onSuccess: inv });
}
export function useDeleteWebstoryCategory() {
  const inv = useInvalidateWebstoryCategories();
  return useMutation({ mutationFn: async (id: string) => { await api.delete(`/admin/webstory-categories/${id}`); }, onSuccess: inv });
}

export function useAdminWebstoryDetail(id: string | null) {
  return useQuery({
    queryKey: ["admin", "webstory", id],
    enabled: !!id,
    queryFn: async () => (await api.get<AdminWebStoryDetail>(`/admin/webstories/${id}`)).data,
  });
}
function useInvalidateStories() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ["admin", "webstories"] }); qc.invalidateQueries({ queryKey: ["pub-stories"] }); };
}
export function useCreateWebstory() {
  const inv = useInvalidateStories();
  return useMutation({ mutationFn: async (body: WebStoryInput) => (await api.post<AdminWebStoryDetail>("/admin/webstories", body)).data, onSuccess: inv });
}
export function useUpdateWebstory() {
  const inv = useInvalidateStories();
  return useMutation({ mutationFn: async ({ id, ...body }: WebStoryInput & { id: string }) => (await api.patch<AdminWebStoryDetail>(`/admin/webstories/${id}`, body)).data, onSuccess: inv });
}

// ============================================================ contact inbox
export interface ContactSubmission {
  id: string; name: string; email: string; message: string; status: string;
  admin_notes: string; ip: string; created_at: string; responded_at: string | null;
}
export interface ContactList {
  items: ContactSubmission[]; total: number; new_count: number; responded_count: number; today_count: number;
}
export function useContactSubmissions(filters: { status_filter?: string; q?: string }) {
  return useQuery({
    queryKey: ["admin", "contact", filters],
    queryFn: async () => (await api.get<ContactList>("/admin/contact-submissions", { params: filters })).data,
  });
}
function useInvalidateContact() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin", "contact"] });
}
export function useUpdateContact() {
  const inv = useInvalidateContact();
  return useMutation({ mutationFn: async ({ id, ...b }: { id: string; status?: string; admin_notes?: string }) => (await api.patch<ContactSubmission>(`/admin/contact-submissions/${id}`, b)).data, onSuccess: inv });
}
export function useReplyContact() {
  const inv = useInvalidateContact();
  return useMutation({ mutationFn: async ({ id, subject, message }: { id: string; subject: string; message: string }) => (await api.post<ContactSubmission>(`/admin/contact-submissions/${id}/reply`, { subject, message })).data, onSuccess: inv });
}
export function useDeleteContact() {
  const inv = useInvalidateContact();
  return useMutation({ mutationFn: async (id: string) => { await api.delete(`/admin/contact-submissions/${id}`); }, onSuccess: inv });
}

// =============================================================== email logs
export interface EmailLog {
  id: string; to_email: string; to_name: string; email_type: string; subject: string;
  status: string; error: string; user_id: string | null; created_at: string;
}
export interface EmailLogList {
  items: EmailLog[]; total: number; sent_count: number; failed_count: number; today_count: number; types: string[];
}
export function useEmailLogs(filters: { type_filter?: string; status_filter?: string; q?: string; days?: number }) {
  return useQuery({
    queryKey: ["admin", "email-logs", filters],
    queryFn: async () => (await api.get<EmailLogList>("/admin/email-logs", { params: filters })).data,
  });
}
export function useRetryEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<EmailLog>(`/admin/email-logs/${id}/retry`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "email-logs"] }),
  });
}

export interface ScheduledEmail {
  id: string; recipient: string; owner_email: string; domain: string; keyword: string | null;
  frequency: string; next_run_at: string; last_run_at: string | null; last_status: string | null;
}
export interface ScheduledEmailList {
  items: ScheduledEmail[]; total: number;
}
export function useScheduledEmails() {
  return useQuery({
    queryKey: ["admin", "scheduled-emails"],
    queryFn: async () => (await api.get<ScheduledEmailList>("/admin/scheduled-emails")).data,
  });
}
export function useCancelScheduledEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<ScheduledEmail>(`/admin/scheduled-emails/${id}/cancel`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "scheduled-emails"] }),
  });
}

// ============================================================ usage history
export interface UsageRow {
  id: string; user_email: string; org_name: string; endpoint: string;
  cost_cents: number; from_cache: boolean; created_at: string;
}
export interface UsageHistory {
  items: UsageRow[]; total: number; billed_count: number; cached_count: number;
  total_cost_cents: number; tools: string[];
}
export function useUsageHistory(filters: { user?: string; tool?: string; days?: number }) {
  return useQuery({
    queryKey: ["admin", "usage-history", filters],
    queryFn: async () => (await api.get<UsageHistory>("/admin/usage-history", { params: filters })).data,
  });
}
