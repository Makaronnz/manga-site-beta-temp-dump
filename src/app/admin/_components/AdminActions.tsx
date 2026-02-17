// src/app/admin/_components/AdminActions.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function GroupActions({ groupId }: { groupId: number }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function approve() {
    try {
      setBusy(true);
      const res = await fetch(`/api/admin/groups/${groupId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) throw new Error(((await res.json()) as any).error || "Approve failed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    try {
      setBusy(true);
      const res = await fetch(`/api/admin/groups/${groupId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (!res.ok) throw new Error(((await res.json()) as any).error || "Reject failed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button onClick={approve} disabled={busy} className="px-3 py-2 rounded-lg bg-black text-white">
        Approve
      </button>
      <button onClick={reject} disabled={busy} className="px-3 py-2 rounded-lg border">
        Reject
      </button>
    </div>
  );
}

function UploadActions({ groupId, uploadId }: { groupId: number; uploadId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function approveBoth() {
    try {
      setBusy(true);
      const res = await fetch(`/api/admin/review/combo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ groupId, uploadId, approveGroup: true, approveUpload: true }),
      });
      if (!res.ok) throw new Error(((await res.json()) as any).error || "Combo approve failed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function approveUploadOnly() {
    try {
      setBusy(true);
      const res = await fetch(`/api/admin/chapters/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId, action: "approve" }),
      });
      if (!res.ok) throw new Error(((await res.json()) as any).error || "Approve upload failed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function rejectUpload() {
    try {
      setBusy(true);
      const res = await fetch(`/api/admin/chapters/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadId, action: "reject", notes: "Rejected by admin" }),
      });
      if (!res.ok) throw new Error(((await res.json()) as any).error || "Reject upload failed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={approveBoth} disabled={busy} className="px-3 py-2 rounded-lg bg-black text-white">
        Approve Group + Publish Chapter
      </button>
      <button onClick={approveUploadOnly} disabled={busy} className="px-3 py-2 rounded-lg border">
        Publish Chapter
      </button>
      <button onClick={rejectUpload} disabled={busy} className="px-3 py-2 rounded-lg border">
        Reject Upload
      </button>
    </div>
  );
}

const AdminActions = { GroupActions, UploadActions };
export default AdminActions;
