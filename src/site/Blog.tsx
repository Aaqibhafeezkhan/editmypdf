import { Link } from "react-router";
import { BookOpen } from "lucide-react";
import { formatDate, POSTS } from "../data/posts.ts";
import { PRODUCT, ROUTES } from "../data/product.ts";
import { readingTime } from "./markdown.ts";
import { useMeta } from "./useMeta.ts";

export function Blog() {
  useMeta({
    title: "Blog",
    description: `Engineering notes from building ${PRODUCT.name}: fonts, spacing, content streams, and why editing a PDF in place is hard.`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: `${PRODUCT.name} blog`,
      blogPost: POSTS.map((post) => ({
        "@type": "BlogPosting",
        headline: post.title,
        datePublished: post.date,
        url: `${ROUTES.post(post.slug)}`,
      })),
    },
  });
  return (
    <section className="section container tone-violet">
      <div className="section-head">
        <p className="eyebrow">
          <BookOpen aria-hidden="true" /> Blog
        </p>
        <h1 className="display">Notes from the inside of a PDF.</h1>
        <p className="lede">
          What it takes to edit a page in place, written from the code that does it. No roadmap posts, no
          announcements, just the engineering.
        </p>
      </div>
      <div className="post-list">
        {POSTS.map((post) => (
          <Link key={post.slug} to={ROUTES.post(post.slug)} className="post-card">
            <div>
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <div className="post-meta">{readingTime(post.body)} min read</div>
            </div>
            <div>
              <h2>{post.title}</h2>
              <p>{post.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
