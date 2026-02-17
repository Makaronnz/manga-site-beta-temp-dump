// src/app/dashboard/uploads/page.tsx
"use client";
import { useMemo, useState } from "react";

type UploadInit = { uploadId: string; storagePrefix: string; uploadUrls: { path: string; url: string }[]; };

export default function UploadDashboard() {
  const [groupId, setGroupId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [chapterNumber, setChapterNumber] = useState("");
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);

  const fileArr = useMemo(
    () => (files ? Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : []),
    [files]
  );
  const addLog = (s: string) => setLog((p) => [...p, s]);

  async function startUpload() {
    if (!groupId || !seriesId || !chapterNumber || !fileArr.length) {
      alert("Fill required fields and select pages."); return;
    }
    setBusy(true); setLog([]); setResult(null);

    const fileMeta = fileArr.map(f => ({ name: f.name, type: f.type, size: f.size }));
    const initRes = await fetch("/api/chapters/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        groupId: Number(groupId),
        seriesId: Number(seriesId),
        chapterNumber: Number(chapterNumber),
        title: title || null,
        lang: lang || null,
        files: fileMeta,
      }),
    });
    const init: UploadInit | { error: string } = await initRes.json();
    if (!initRes.ok || "error" in init) { setBusy(false); alert((init as any).error || "Init error"); return; }

    // Validate we got enough URLs
    if (init.uploadUrls.length !== fileArr.length) {
      setBusy(false); alert("Server returned mismatching upload URLs"); return;
    }

    addLog(`Upload ID: ${(init as UploadInit).uploadId}`);
    addLog(`Uploading ${fileArr.length} pages…`);
    for (let i = 0; i < (init as UploadInit).uploadUrls.length; i++) {
      const u = (init as UploadInit).uploadUrls[i];
      const f = fileArr[i];
      const put = await fetch(u.url, { method: "PUT", body: f, headers: { "content-type": f.type || "application/octet-stream" } });
      if (!put.ok) { setBusy(false); alert(`Upload failed at page ${i + 1}`); return; }
      addLog(`Uploaded ${i + 1}/${fileArr.length}`);
    }

    addLog("Marking as uploaded…");
    const mark = await fetch("/api/chapters/upload", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uploadId: (init as UploadInit).uploadId, action: "markUploaded" }),
    });
    const mj: any = await mark.json();
    if (!mark.ok) { setBusy(false); alert(mj.error || "Mark error"); return; }

    addLog("Done. Waiting for review.");
    setResult({ uploadId: (init as UploadInit).uploadId, status: mj.status });
    setBusy(false);
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Group Chapter Upload</h1>

      <input className="w-full border p-2 rounded" placeholder="Group ID" value={groupId} onChange={(e) => setGroupId(e.target.value)} />
      <input className="w-full border p-2 rounded" placeholder="Series ID" value={seriesId} onChange={(e) => setSeriesId(e.target.value)} />
      <input className="w-full border p-2 rounded" placeholder="Chapter Number" value={chapterNumber} onChange={(e) => setChapterNumber(e.target.value)} />
      <input className="w-full border p-2 rounded" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="w-full border p-2 rounded" placeholder="Lang (e.g., en,tr,es...)" value={lang} onChange={(e) => setLang(e.target.value)} />

      <div className="space-y-2">
        <label className="block text-sm">Pages (multiple files)</label>
        <input multiple type="file" accept="image/*" onChange={(e) => setFiles(e.target.files)} />
        {fileArr.length > 0 && <div className="text-sm opacity-70">{fileArr.length} file(s) selected</div>}
      </div>

      <button disabled={busy} onClick={startUpload} className="px-4 py-2 rounded bg-black text-white">
        {busy ? "Uploading…" : "Start Upload"}
      </button>

      {log.length > 0 && <pre className="bg-neutral-900 text-neutral-100 p-3 rounded text-sm whitespace-pre-wrap">{log.join("\n")}</pre>}
      {result && <pre className="bg-neutral-900 text-neutral-100 p-3 rounded text-sm">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
