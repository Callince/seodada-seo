export interface Meta {
  from_cache: boolean;
  cost_cents: number;
  source: string;
  latency_ms: number;
  fetched_at?: string | null;
}

export interface CursorPage {
  next_cursor: string | null;
  has_more: boolean;
}

export interface Page<T> {
  data: T[];
  pagination: CursorPage;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  org_id: string;
  is_admin?: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  org_id: string;
  org_name: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  month_cents: number;
  total_cents: number;
  calls: number;
  last_active: string | null;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total_month_cents: number;
  total_cents: number;
}

export interface Org {
  id: string;
  name: string;
  plan: string;
  monthly_quota_cents: number;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface UsageSummary {
  month_to_date_cents: number;
  quota_cents: number;
  remaining_cents: number;
  by_module: { endpoint: string; cost_cents: number }[];
  providers?: Record<string, string>;
}

// SERP
export interface SerpResult {
  position: number;
  serp_slot: number | null;
  featured: boolean;
  title: string;
  description: string | null;
  url: string;
  domain: string;
  brand_name: string;
  brand_volume: number | null;
}

export interface PaaItem {
  question: string;
  answer: string | null;
  url: string | null;
}

export interface SerpResponse {
  keyword: string;
  results: SerpResult[];
  paa: PaaItem[];
  meta: Meta;
}

export interface PaaResponse {
  keyword: string;
  paa: PaaItem[];
  meta: Meta;
}

// Keyword Research
export interface MonthlyPoint {
  year: number | null;
  month: number | null;
  volume: number | null;
}

export interface VolumeRow {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: number | null;
  competition_level: string | null;
  monthly_searches: MonthlyPoint[];
}

export interface VolumeResponse {
  rows: VolumeRow[];
  meta: Meta;
}

export interface TrendsPoint {
  date: string | null;
  values: (number | null)[];
}

export interface TrendsResponse {
  keywords: string[];
  graph: TrendsPoint[];
  meta: Meta;
}

export interface KeywordRow {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: number | null;
  keyword_difficulty: number | null;
  intent: string | null;
}

export interface KeywordListResponse {
  rows: KeywordRow[];
  meta: Meta;
}

// Domain Analytics
export interface RankedKeywordRow {
  keyword: string;
  position: number | null;
  search_volume: number | null;
  etv: number | null;
  url: string | null;
}

export interface RankedKeywordsResponse {
  target: string;
  rows: RankedKeywordRow[];
  meta: Meta;
}

export interface CompetitorRow {
  domain: string;
  common_keywords: number | null;
  avg_position: number | null;
  etv: number | null;
  keywords_count: number | null;
}

export interface CompetitorsResponse {
  target: string;
  rows: CompetitorRow[];
  meta: Meta;
}

export interface OverviewMetrics {
  count: number | null;
  etv: number | null;
  traffic_cost: number | null;
}

export interface OverviewResponse {
  target: string;
  organic: OverviewMetrics;
  paid: OverviewMetrics;
  meta: Meta;
}

export interface IntersectionRow {
  keyword: string;
  search_volume: number | null;
  target1_position: number | null;
  target2_position: number | null;
}

export interface IntersectionResponse {
  target1: string;
  target2: string;
  rows: IntersectionRow[];
  meta: Meta;
}

// On-Page
export interface Readability {
  ari: number | null;
  flesch_kincaid: number | null;
}

export interface DensityRow {
  keyword: string;
  frequency: number;
  density: number;
}

export interface SubScore {
  label: string;
  score: number;
  max: number;
  status: "good" | "warn" | "bad" | "n/a";
  note: string;
}

export interface KeywordAnalysis {
  keyword: string;
  frequency: number;
  density: number;
  health: "absent" | "low" | "optimal" | "high" | "stuffed";
  placements: Record<string, boolean>;
  placement_count: number;
}

export interface SnippetMeasure {
  text: string;
  pixels: number;
  limit_pixels: number;
  truncated: boolean;
  preview: string;
  fill_pct: number;
}

export interface SnippetPreview {
  url: string;
  title: SnippetMeasure;
  meta_description: SnippetMeasure;
}

export interface ImageItem {
  src: string;
  alt: string | null;
  has_alt: boolean;
}

export interface ImageAudit {
  total: number;
  missing_alt: number;
  with_keyword_alt: boolean;
  items: ImageItem[];
}

export interface Indexability {
  canonical: string | null;
  noindex: boolean;
  nofollow: boolean;
  robots: string | null;
  has_viewport: boolean;
  lang: string | null;
  open_graph: boolean;
  twitter_card: boolean;
  schema_types: string[];
}

export interface LinkAudit {
  internal: number;
  external: number;
}

export interface GapTerm {
  term: string;
  competitors_using: number;
  your_count: number;
}

export interface Benchmark {
  keyword: string;
  competitors_analyzed: number;
  word_count: { you: number; median: number; max: number };
  headings: { you: number; median: number };
  missing_terms: GapTerm[];
}

export interface OnPageResponse {
  url: string;
  content_score: number | null;
  technical_score: number | null;
  word_count: number | null;
  readability: Readability;
  keyword_density: DensityRow[];
  keyword_analysis: KeywordAnalysis | null;
  subscores: SubScore[];
  title: string | null;
  meta_description: string | null;
  h1: string[];
  h2: string[];
  issues: string[];
  recommendations: string[];
  snippet: SnippetPreview | null;
  images: ImageAudit | null;
  indexability: Indexability | null;
  links: LinkAudit | null;
  benchmark: Benchmark | null;
  meta: Meta;
}

// Content Analysis
export interface Sentiment {
  positive: number | null;
  negative: number | null;
  neutral: number | null;
}

export interface Connotations {
  anger: number | null;
  happiness: number | null;
  love: number | null;
  sadness: number | null;
  fun: number | null;
}

export interface Citation {
  domain: string | null;
  url: string | null;
  title: string | null;
  snippet: string | null;
}

export interface ContentResponse {
  keyword: string;
  total_count: number;
  sentiment: Sentiment;
  connotations: Connotations;
  top_citations: Citation[];
  meta: Meta;
}

// Projects
export interface Project {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  run_count: number;
}

export interface ProjectRun {
  id: string;
  module: string;
  params: Record<string, unknown>;
  created_at: string;
}

export interface ProjectDetail extends Project {
  runs: ProjectRun[];
}

export interface ProjectRunResult {
  id: string;
  module: string;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
  created_at: string;
}

// Rank tracking
export interface RankPoint {
  position: number | null;
  url: string | null;
  created_at: string;
}

export interface RankTrackResponse {
  keyword: string;
  domain: string;
  position: number | null;
  url: string | null;
  found: boolean;
  depth: number;
  history: RankPoint[];
  meta: Meta;
}

export interface TrackedItem {
  keyword: string;
  domain: string;
  location_code: number;
  language_code: string;
  device: string;
  latest_position: number | null;
  previous_position: number | null;
  delta: number | null;
  last_checked: string;
  observations: number;
}

export interface TrackedListResponse {
  items: TrackedItem[];
}

// Site Report (automated SEO audit)
export interface PageReport {
  url: string;
  content_score: number | null;
  word_count: number | null;
  title: string | null;
  issues: string[];
  recommendation: string | null;
}

export interface OverviewBlock {
  organic: OverviewMetrics;
  paid: OverviewMetrics;
}

export interface ReportRanking {
  keyword: string;
  position: number | null;
  url: string | null;
  found: boolean;
}

export interface SiteReportResponse {
  domain: string;
  keyword: string | null;
  location_code: number;
  language_code: string;
  health_score: number | null;
  overview: OverviewBlock;
  pages: PageReport[];
  top_keywords: RankedKeywordRow[];
  competitors: CompetitorRow[];
  ranking: ReportRanking | null;
  findings: string[];
  recommendations: string[];
  meta: Meta;
}

// Schedules (automation)
export interface ScheduleOut {
  id: string;
  kind: string;
  frequency: "daily" | "weekly" | "monthly";
  params: Record<string, unknown>;
  project_id: string;
  active: boolean;
  next_run_at: string;
  last_run_at: string | null;
  last_status: string | null;
  label: string;
}

export interface ScheduleListResponse {
  items: ScheduleOut[];
}

// AI insights
export interface AiSuggestion {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
}

export interface AiInsightsResponse {
  summary: string;
  suggestions: AiSuggestion[];
  model: string;
}


// ---- Backlinks & Domain Authority ----

export interface BacklinksSummary {
  rank: number | null;
  authority: number | null;
  backlinks: number | null;
  referring_domains: number | null;
  referring_main_domains: number | null;
  broken_backlinks: number | null;
  referring_ips: number | null;
  dofollow: number | null;
  nofollow: number | null;
  first_seen: string | null;
  global_rank: number | null;
}

export interface BacklinksSummaryResponse {
  target: string;
  summary: BacklinksSummary;
  source: string; // "dataforseo" | "openpagerank" (free authority fallback)
  meta: Meta;
}

export interface BacklinkRow {
  domain_from: string | null;
  url_from: string | null;
  url_to: string | null;
  anchor: string | null;
  dofollow: boolean;
  domain_from_rank: number | null;
  page_from_rank: number | null;
  first_seen: string | null;
  last_seen: string | null;
}

export interface BacklinksListResponse {
  target: string;
  rows: BacklinkRow[];
  meta: Meta;
}

export interface ReferringDomainRow {
  domain: string | null;
  rank: number | null;
  authority: number | null;
  backlinks: number | null;
  referring_pages: number | null;
  first_seen: string | null;
}

export interface ReferringDomainsResponse {
  target: string;
  rows: ReferringDomainRow[];
  meta: Meta;
}

export interface AnchorRow {
  anchor: string | null;
  backlinks: number | null;
  referring_domains: number | null;
  dofollow: boolean;
}

export interface AnchorsResponse {
  target: string;
  rows: AnchorRow[];
  meta: Meta;
}

// ---- Site Audit ----

export interface AuditStartResponse {
  task_id: string;
  cost_cents: number;
  max_crawl_pages: number;
}

export interface AuditIssue {
  check: string;
  label: string;
  severity: "error" | "warning" | "notice";
  count: number;
}

export interface AuditPageRow {
  url: string | null;
  status_code: number | null;
  onpage_score: number | null;
  title: string | null;
  word_count: number | null;
  internal_links: number | null;
  external_links: number | null;
  load_time_ms: number | null;
  failed_checks: string[];
}

export interface AuditStatusResponse {
  task_id: string;
  progress: "queued" | "in_progress" | "finished" | "error" | "unknown";
  error?: string | null;
  pages_crawled: number | null;
  pages_in_queue: number | null;
  max_crawl_pages: number | null;
  onpage_score: number | null;
  total_pages: number | null;
  ssl: boolean | null;
  cms: string | null;
  server: string | null;
  errors: number;
  warnings: number;
  notices: number;
  issues: AuditIssue[];
  pages: AuditPageRow[];
}

// ---- AI Visibility (Google AI Overview / AI Mode citations) ----
export interface AiVisibilityStartResponse {
  task_id: string;
}

export interface AiCitation {
  cited: boolean;
  url: string | null;
  position: number | null;
}

export interface AiKeywordRow {
  keyword: string;
  ai_overview_present: boolean;
  ai_overview: AiCitation;
  ai_mode_present: boolean;
  ai_mode: AiCitation;
  cited_domains: string[];
}

export interface AiVisibilitySummary {
  keywords: number;
  ai_overview_present: number;
  ai_overview_cited: number;
  ai_mode_cited: number;
  cost_cents: number;
}

export interface AiVisibilityStatusResponse {
  task_id: string;
  progress: "queued" | "in_progress" | "finished" | "error" | "unknown";
  error?: string | null;
  checked: number;
  total: number;
  domain: string | null;
  include_ai_mode: boolean;
  rows: AiKeywordRow[];
  summary: AiVisibilitySummary;
}
