import { apiBaseUrl, apiGetJson } from "../lib/api";
import type { RunsResponse, RunRecord } from "../lib/types";
import { CreateRunForm } from "./CreateRunForm";
import { RunsLive } from "./RunsLive";

export default async function Page() {
  const data = await apiGetJson<RunsResponse>("/runs");
  const base = apiBaseUrl();
  return (
    <div>
      <h1 style={{ margin: "0 0 12px 0" }}>Runs</h1>
      <CreateRunForm apiBaseUrl={process.env.NEXT_PUBLIC_Y2T_API_BASE_URL ?? base} />
      <RunsLive apiBaseUrl={process.env.NEXT_PUBLIC_Y2T_API_BASE_URL ?? base} initialRuns={data.runs as RunRecord[]} />
    </div>
  );
}
