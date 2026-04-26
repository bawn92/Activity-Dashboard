// Entry point referenced by @remotion/bundler. Calls registerRoot to register
// the composition catalog with Remotion at bundle time.
import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
