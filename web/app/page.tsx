import { apiBaseUrlClient, apiGetJson } from "../lib/api";
import type { RunsResponse, RunRecord } from "../lib/apiSchema";
import { CreateRunForm } from "./CreateRunForm";
import { RunsLive } from "./RunsLive";

export default async function Page() {
  const data = await apiGetJson<RunsResponse>("/runs");
  const base = apiBaseUrlClient();
  return (
    <div>
      <h1 className="title">Runs</h1>
      <CreateRunForm apiBaseUrl={base} />
      <RunsLive apiBaseUrl={base} initialRuns={data.runs as RunRecord[]} />
    </div>
  );
}
