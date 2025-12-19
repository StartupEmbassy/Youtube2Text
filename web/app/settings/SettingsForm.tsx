"use client";

import { useEffect, useMemo, useState } from "react";
import type { components } from "../../lib/apiTypes.gen";

type SettingsGetResponse = components["schemas"]["SettingsGetResponse"];

type TriBool = "" | "true" | "false";
type FilenameStyleOpt = "" | "id" | "id_title" | "title_id";
type AudioFormatOpt = "" | "mp3" | "wav";
type LanguageDetectionOpt = "" | "auto" | "manual";

function toTriBool(v: unknown): TriBool {
  if (v === true) return "true";
  if (v === false) return "false";
  return "";
}

function parseTriBool(v: TriBool): boolean | null {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return NaN;
  return n;
}

function splitLines(raw: string): string[] {
  return raw
    .split(/\r?\n/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function SettingsForm({ initial }: { initial: SettingsGetResponse }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [data, setData] = useState<SettingsGetResponse>(initial);

  const initialForm = useMemo(() => {
    const s = data.settings ?? {};
    const filenameStyle: FilenameStyleOpt =
      s.filenameStyle === "id" || s.filenameStyle === "id_title" || s.filenameStyle === "title_id"
        ? s.filenameStyle
        : "";
    const audioFormat: AudioFormatOpt =
      s.audioFormat === "mp3" || s.audioFormat === "wav" ? s.audioFormat : "";
    const languageDetection: LanguageDetectionOpt =
      s.languageDetection === "auto" || s.languageDetection === "manual" ? s.languageDetection : "";
    return {
      filenameStyle,
      audioFormat,
      languageDetection,
      languageCode: (s.languageCode as string | undefined) ?? "",
      concurrency: s.concurrency === undefined ? "" : String(s.concurrency),
      maxNewVideos: s.maxNewVideos === undefined ? "" : String(s.maxNewVideos),
      afterDate: (s.afterDate as string | undefined) ?? "",
      csvEnabled: toTriBool(s.csvEnabled),
      commentsEnabled: toTriBool(s.commentsEnabled),
      commentsMax: s.commentsMax === undefined ? "" : String(s.commentsMax),
      pollIntervalMs: s.pollIntervalMs === undefined ? "" : String(s.pollIntervalMs),
      maxPollMinutes: s.maxPollMinutes === undefined ? "" : String(s.maxPollMinutes),
      downloadRetries: s.downloadRetries === undefined ? "" : String(s.downloadRetries),
      transcriptionRetries:
        s.transcriptionRetries === undefined ? "" : String(s.transcriptionRetries),
      catalogMaxAgeHours: s.catalogMaxAgeHours === undefined ? "" : String(s.catalogMaxAgeHours),
      ytDlpExtraArgs: Array.isArray(s.ytDlpExtraArgs) ? (s.ytDlpExtraArgs as string[]).join("\n") : "",
    };
  }, [data.settings]);

  const [form, setForm] = useState(initialForm);

  // When server updates `data.settings` (after a save), reset the form.
  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  async function save() {
    setSaving(true);
    setError(undefined);
    try {
      const concurrency = parseOptionalInt(form.concurrency);
      const maxNewVideos = parseOptionalInt(form.maxNewVideos);
      const commentsMax = parseOptionalInt(form.commentsMax);
      const pollIntervalMs = parseOptionalInt(form.pollIntervalMs);
      const maxPollMinutes = parseOptionalInt(form.maxPollMinutes);
      const downloadRetries = parseOptionalInt(form.downloadRetries);
      const transcriptionRetries = parseOptionalInt(form.transcriptionRetries);
      const catalogMaxAgeHours = parseOptionalInt(form.catalogMaxAgeHours);

      const badNums = [
        ["concurrency", concurrency],
        ["maxNewVideos", maxNewVideos],
        ["commentsMax", commentsMax],
        ["pollIntervalMs", pollIntervalMs],
        ["maxPollMinutes", maxPollMinutes],
        ["downloadRetries", downloadRetries],
        ["transcriptionRetries", transcriptionRetries],
        ["catalogMaxAgeHours", catalogMaxAgeHours],
      ].filter(([, v]) => typeof v === "number" && Number.isNaN(v));
      if (badNums.length > 0) {
        setError(`Invalid number: ${badNums.map(([k]) => k).join(", ")}`);
        return;
      }

      const payload: components["schemas"]["SettingsPatchRequest"] = {
        settings: {
          filenameStyle: form.filenameStyle === "" ? null : form.filenameStyle,
          audioFormat: form.audioFormat === "" ? null : form.audioFormat,
          languageDetection: form.languageDetection === "" ? null : form.languageDetection,
          languageCode: form.languageCode.trim().length === 0 ? null : form.languageCode.trim(),
          concurrency: concurrency === null ? null : concurrency,
          maxNewVideos: maxNewVideos === null ? null : maxNewVideos,
          afterDate: form.afterDate.trim().length === 0 ? null : form.afterDate.trim(),
          csvEnabled: parseTriBool(form.csvEnabled),
          commentsEnabled: parseTriBool(form.commentsEnabled),
          commentsMax: commentsMax === null ? null : commentsMax,
          pollIntervalMs: pollIntervalMs === null ? null : pollIntervalMs,
          maxPollMinutes: maxPollMinutes === null ? null : maxPollMinutes,
          downloadRetries: downloadRetries === null ? null : downloadRetries,
          transcriptionRetries: transcriptionRetries === null ? null : transcriptionRetries,
          catalogMaxAgeHours: catalogMaxAgeHours === null ? null : catalogMaxAgeHours,
          ytDlpExtraArgs:
            form.ytDlpExtraArgs.trim().length === 0 ? null : splitLines(form.ytDlpExtraArgs),
        },
      };

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`PATCH /settings failed: ${res.status} ${text}`);
      }
      const json = (await res.json()) as SettingsGetResponse;
      setData(json);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row">
          <h2 className="title">Settings</h2>
          <span className="pill">non-secret</span>
        </div>
        <p className="m0 muted break">
          Stored at <span className="mono">{data.settingsPath}</span>
          {data.updatedAt ? (
            <>
              {" "}
              <span className="pill">updated</span> <span className="mono">{data.updatedAt}</span>
            </>
          ) : null}
        </p>
        <div className="spacer14" />

        {error ? <p className="m0 textBad break">{error}</p> : null}

        <div className="spacer10" />

        <div className="grid">
          <div className="card">
            <h3 className="title">Core</h3>
            <div className="stackTight">
              <div className="formRow">
                <span className="formLabel">filenameStyle</span>
                <select
                  className="inputMd"
                  value={form.filenameStyle}
                  onChange={(e) =>
                    setForm({ ...form, filenameStyle: e.target.value as FilenameStyleOpt })
                  }
                >
                  <option value="">(inherit)</option>
                  <option value="title_id">title_id</option>
                  <option value="id_title">id_title</option>
                  <option value="id">id</option>
                </select>
              </div>

              <div className="formRow">
                <span className="formLabel">audioFormat</span>
                <select
                  className="inputMd"
                  value={form.audioFormat}
                  onChange={(e) =>
                    setForm({ ...form, audioFormat: e.target.value as AudioFormatOpt })
                  }
                >
                  <option value="">(inherit)</option>
                  <option value="mp3">mp3</option>
                  <option value="wav">wav</option>
                </select>
              </div>

              <div className="formRow">
                <span className="formLabel">concurrency</span>
                <input
                  className="inputXs"
                  inputMode="numeric"
                  value={form.concurrency}
                  onChange={(e) => setForm({ ...form, concurrency: e.target.value })}
                  placeholder="inherit"
                />
              </div>
            </div>

            <div className="spacer14" />

            <h3 className="title">Language</h3>
            <div className="stackTight">
              <div className="formRow">
                <span className="formLabel">languageDetection</span>
                <select
                  className="inputMd"
                  value={form.languageDetection}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      languageDetection: e.target.value as LanguageDetectionOpt,
                    })
                  }
                >
                  <option value="">(inherit)</option>
                  <option value="auto">auto</option>
                  <option value="manual">manual</option>
                </select>
              </div>
              <div className="formRow">
                <span className="formLabel">languageCode</span>
                <input
                  className="inputMd"
                  value={form.languageCode}
                  onChange={(e) => setForm({ ...form, languageCode: e.target.value })}
                  placeholder="en_us"
                />
                <span className="muted">when manual</span>
              </div>
            </div>

            <div className="spacer14" />

            <h3 className="title">Outputs</h3>
            <div className="stackTight">
              <div className="formRow">
                <span className="formLabel">csvEnabled</span>
                <select
                  className="inputSm"
                  value={form.csvEnabled}
                  onChange={(e) => setForm({ ...form, csvEnabled: e.target.value as TriBool })}
                >
                  <option value="">(inherit)</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>
              <div className="formRow">
                <span className="formLabel">commentsEnabled</span>
                <select
                  className="inputSm"
                  value={form.commentsEnabled}
                  onChange={(e) =>
                    setForm({ ...form, commentsEnabled: e.target.value as TriBool })
                  }
                >
                  <option value="">(inherit)</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>
              <div className="formRow">
                <span className="formLabel">commentsMax</span>
                <input
                  className="inputSm"
                  inputMode="numeric"
                  value={form.commentsMax}
                  onChange={(e) => setForm({ ...form, commentsMax: e.target.value })}
                  placeholder="inherit"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="title">Planning</h3>
            <div className="stackTight">
              <div className="formRow">
                <span className="formLabel">maxNewVideos</span>
                <input
                  className="inputSm"
                  inputMode="numeric"
                  value={form.maxNewVideos}
                  onChange={(e) => setForm({ ...form, maxNewVideos: e.target.value })}
                  placeholder="inherit"
                />
              </div>
              <div className="formRow">
                <span className="formLabel">afterDate</span>
                <input
                  className="inputMd"
                  value={form.afterDate}
                  onChange={(e) => setForm({ ...form, afterDate: e.target.value })}
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div className="formRow">
                <span className="formLabel">catalogMaxAgeHours</span>
                <input
                  className="inputSm"
                  inputMode="numeric"
                  value={form.catalogMaxAgeHours}
                  onChange={(e) => setForm({ ...form, catalogMaxAgeHours: e.target.value })}
                  placeholder="inherit"
                />
              </div>
            </div>

            <div className="spacer14" />

            <h3 className="title">Polling</h3>
            <div className="stackTight">
              <div className="formRow">
                <span className="formLabel">pollIntervalMs</span>
                <input
                  className="inputSm"
                  inputMode="numeric"
                  value={form.pollIntervalMs}
                  onChange={(e) => setForm({ ...form, pollIntervalMs: e.target.value })}
                  placeholder="inherit"
                />
              </div>
              <div className="formRow">
                <span className="formLabel">maxPollMinutes</span>
                <input
                  className="inputSm"
                  inputMode="numeric"
                  value={form.maxPollMinutes}
                  onChange={(e) => setForm({ ...form, maxPollMinutes: e.target.value })}
                  placeholder="inherit"
                />
              </div>
            </div>

            <div className="spacer14" />

            <h3 className="title">Retries</h3>
            <div className="stackTight">
              <div className="formRow">
                <span className="formLabel">downloadRetries</span>
                <input
                  className="inputXs"
                  inputMode="numeric"
                  value={form.downloadRetries}
                  onChange={(e) => setForm({ ...form, downloadRetries: e.target.value })}
                  placeholder="inherit"
                />
              </div>
              <div className="formRow">
                <span className="formLabel">transcriptionRetries</span>
                <input
                  className="inputXs"
                  inputMode="numeric"
                  value={form.transcriptionRetries}
                  onChange={(e) => setForm({ ...form, transcriptionRetries: e.target.value })}
                  placeholder="inherit"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="title">yt-dlp</h3>
            <div className="stackTight">
              <div className="formRow">
                <span className="formLabel">ytDlpExtraArgs</span>
                <span className="muted">one per line</span>
              </div>
              <textarea
                className="input"
                rows={6}
                value={form.ytDlpExtraArgs}
                onChange={(e) => setForm({ ...form, ytDlpExtraArgs: e.target.value })}
                placeholder="(inherit)"
              />
            </div>
          </div>
        </div>

        <div className="spacer14" />

        <div className="flexWrap">
          <button className="button" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <h2 className="title">Effective config (non-secret subset)</h2>
          <span className="pill">GET /settings</span>
        </div>
        <pre className="preWrap">{JSON.stringify(data.effective, null, 2)}</pre>
      </div>
    </div>
  );
}
