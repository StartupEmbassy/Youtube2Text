import { apiGetJson } from "../lib/api";
import type { RunsResponse, RunRecord } from "../lib/apiSchema";
import { CreateRunForm } from "./CreateRunForm";
import { RunsLive } from "./RunsLive";

export default async function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const data = await apiGetJson<RunsResponse>("/runs");
  const urlParam = searchParams?.url;
  const initialUrl = typeof urlParam === "string" ? urlParam : Array.isArray(urlParam) ? urlParam[0] : undefined;
  return (
    <div>
      <h1 className="title">Runs</h1>
      <CreateRunForm initialUrl={initialUrl} />
      <RunsLive initialRuns={data.runs as RunRecord[]} />
    </div>
  );
}
