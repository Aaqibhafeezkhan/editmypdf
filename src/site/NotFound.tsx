import { Link } from "react-router";
import { ROUTES } from "../data/product.ts";
import { useMeta } from "./useMeta.ts";

export function NotFound() {
  useMeta({ title: "Page not found", description: "There is nothing at this address.", noindex: true });
  return (
    <section className="section container page-narrow">
      <p className="eyebrow">404</p>
      <h1 className="display">Nothing here.</h1>
      <p className="lede">
        This address does not match a page. If you followed a link to a document, that document only
        exists in the browser that opened it.
      </p>
      <p className="actions">
        <Link to={ROUTES.home} className="btn btn-secondary">
          Back to the start
        </Link>
        <Link to={ROUTES.app} className="btn btn-primary">
          Open the editor
        </Link>
      </p>
    </section>
  );
}
