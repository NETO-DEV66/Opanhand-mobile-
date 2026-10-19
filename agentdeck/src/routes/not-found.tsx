import type { MetaFunction } from "react-router";
import { Link } from "react-router";

export const meta: MetaFunction = () => [{ title: "Not found" }];

export default function NotFoundRoute() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas-base px-6 text-center text-contrast">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted">
        The page you are looking for does not exist.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-xl border border-contrast/15 px-4 py-2 text-sm font-medium transition hover:bg-surface-raised"
      >
        Back to chat
      </Link>
    </div>
  );
}
