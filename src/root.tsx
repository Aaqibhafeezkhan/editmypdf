import { Editor } from "./App.tsx";
import { Landing } from "./Landing.tsx";
import { usePath } from "./router.ts";

export function Root() {
  const path = usePath();
  const edit = path.match(/^\/edit\/([^/]+)\/?$/);
  if (edit?.[1]) {
    const sessionId = decodeURIComponent(edit[1]);
    return <Editor key={sessionId} sessionId={sessionId} />;
  }
  return <Landing />;
}
