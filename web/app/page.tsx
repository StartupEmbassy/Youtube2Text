import { apiGetJson } from "../lib/api";
import type { RunsResponse, RunRecord } from "../lib/apiSchema";
import { CreateRunForm } from "./CreateRunForm";
import { RunsLive } from "./RunsLive";

export default async function Page() {
  const data = await apiGetJson<RunsResponse>("/runs");
  return (
    <div>
      <h1 className="title">Runs</h1>
      <CreateRunForm />
      <RunsLive initialRuns={data.runs as RunRecord[]} />
    </div>
  );
}
