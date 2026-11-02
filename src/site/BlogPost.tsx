import { Link, useParams } from "react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import { formatDate, postBySlug, POSTS } from "../data/posts.ts";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { Markdown } from "./Markdown.tsx";
import { readingTime } from "./markdown.ts";
import { NotFound } from "./NotFound.tsx";
import { breadcrumbs, useMeta } from "./useMeta.ts";

export function BlogPost() {
  const { slug = "" } = useParams();
  const post = postBySlug(slug);
  if (!post) return <NotFound />;
  return <Article slug={slug} />;
}

function Article({ slug }: { slug: string }) {
  const post = postBySlug(slug)!;
  const minutes = readingTime(post.body);
  useMeta({
    title: post.title,
    description: post.description,
    type: "article",
    keywords: post.tags,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.date,
        author: { "@type": "Organization", name: PRODUCT.name },
        publisher: { "@type": "Organization", name: PRODUCT.name },
        keywords: post.tags.join(", "),
        timeRequired: `PT${minutes}M`,
      },
      breadcrumbs([
        { name: "Blog", path: ROUTES.blog },
        { name: post.title, path: ROUTES.post(post.slug) },
      ]),
    ],
  });
  const index = POSTS.findIndex((item) => item.slug === slug);
  const next = POSTS[index + 1] ?? POSTS[0];
  return (
    <article className="section container post tone-violet">
      <header className="post-header">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to={ROUTES.home}>{PRODUCT.name}</Link>
          <ChevronRight aria-hidden="true" />
          <Link to={ROUTES.blog}>Blog</Link>
        </nav>
        <h1 className="display">{post.title}</h1>
        <p className="lede">{post.description}</p>
        <div className="post-meta">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span>{minutes} min read</span>
          {post.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      </header>
      <Markdown source={post.body} />
      <footer className="post-footer">
        <h2>Read next</h2>
        {next && next.slug !== slug && (
          <Link to={ROUTES.post(next.slug)} className="post-card">
            <div>
              <time dateTime={next.date}>{formatDate(next.date)}</time>
              <div className="post-meta">{readingTime(next.body)} min read</div>
            </div>
            <div>
              <h2>{next.title}</h2>
              <p>{next.description}</p>
            </div>
          </Link>
        )}
        <p className="actions">
          <Link to={ROUTES.app} className="btn btn-primary">
            Try it on a PDF <ArrowRight aria-hidden="true" />
          </Link>
          <Link to={ROUTES.blog} className="btn btn-secondary">
            All posts
          </Link>
        </p>
      </footer>
    </article>
  );
}
