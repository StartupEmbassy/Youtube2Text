import type { components } from "../../lib/apiTypes.gen";
import { apiGetJson } from "../../lib/api";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

type SettingsGetResponse = components["schemas"]["SettingsGetResponse"];

export default async function SettingsPage() {
  const settings = await apiGetJson<SettingsGetResponse>("/settings");
  return <SettingsForm initial={settings} />;
}

