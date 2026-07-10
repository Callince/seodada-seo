import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { usePublicBlog } from "@/api/hooks/useContentPublic";
import { PublicHero } from "@/components/public/PublicHero";
import { Seo, SITE_URL } from "@/lib/seo";
import { Button } from "@/components/ui/button";

export default function BlogPost() {
  const { slug = "" } = useParams();
  const { data: post, isLoading, isError } = usePublicBlog(slug);

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-24 text-center text-text-muted sm:px-6">Loading…</div>;
  }
  if (isError || !post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <Seo title="Post not found" noindex />
        <h1 className="text-2xl font-bold">Post not found</h1>
        <Link to="/blog" className="mt-6 inline-block">
          <Button variant="secondary">Back to blog</Button>
        </Link>
      </div>
    );
  }

  const jsonLd: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.meta_description || post.excerpt,
      author: { "@type": "Organization", name: post.author || "seodada" },
      datePublished: post.published_at,
      mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    },
  ];
  if (post.faqs.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  return (
    <div>
      <Seo
        title={post.meta_title || post.title}
        description={post.meta_description || post.excerpt}
        type="article"
        path={`/blog/${post.slug}`}
        jsonLd={jsonLd}
      />
      <PublicHero
        align="left"
        normalCase
        compact
        eyebrow={
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white">
            <ArrowLeft size={14} /> Blog
          </Link>
        }
        title={post.title}
      >
        <p className="text-sm text-white/60">By {post.author}</p>
      </PublicHero>

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="pillar-prose" dangerouslySetInnerHTML={{ __html: post.body_html }} />
        {post.faqs.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight">Frequently asked questions</h2>
            <div className="mt-4 space-y-3">
              {post.faqs.map((f, i) => (
                <div key={i} className="rounded-xl border border-border p-4">
                  <p className="font-semibold text-text">{f.question}</p>
                  <p className="mt-1 text-sm text-text-muted">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
