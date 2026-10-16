// Pages Functions entry: every /api/* request. Static files are served by Pages itself.
import { handleApi } from "../../src/worker/api";
import type { Env } from "../../src/worker/env";

export const onRequest: PagesFunction<Env> = ({ request, env }) => handleApi(request, env);
