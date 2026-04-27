"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { updateLiveClass } from "@/services/live_classes";

const METERED_DOMAIN = process.env.NEXT_PUBLIC_METERED_DOMAIN || "";

interface MeetingRoom {
  roomName: string;
  joinUrl: string;
}

interface LiveClassInfo {
  id: number;
  title: string;
  provider_join_url?: string | null;
}

export default function LiveClassComponent() {
  const params = useParams();
  const classId = params?.id as string;

  const [liveClass, setLiveClass] = useState<LiveClassInfo | null>(null);
  const [isInstructor, setIsInstructor] = useState<boolean>(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [roomInfo, setRoomInfo] = useState<MeetingRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [joined, setJoined] = useState(false);

  // On mount: load live class details + current user role
  useEffect(() => {
    if (!classId) return;

    const fetchAll = async () => {
      try {
        const [classRes, meRes] = await Promise.all([
          api.get(`/live-classes/${classId}`),
          api.get("/auth/me"),
        ]);
        setLiveClass(classRes.data);

        // Log what /auth/me returns so we can verify the role field
        const me = meRes.data;
        console.log("[LiveClass] /auth/me response:", me);

        // Verify if user is the instructor for THIS class
        const isAdmin = ["organization_admin", "super_admin"].includes((me?.role ?? me?.role_name ?? "").toLowerCase());
        const userIsInstructorOrAdmin = me?.id === classRes.data.instructor_id || isAdmin;
        
        setIsInstructor(userIsInstructorOrAdmin);
        setUserName(me?.full_name ?? "Student");

        // If a room URL already exists, auto-join
        if (classRes.data?.provider_join_url) {
          const url = classRes.data.provider_join_url;
          setRoomInfo({ roomName: "", joinUrl: url });
          setJoined(true);
        }
      } catch (e) {
        console.error("[LiveClass] fetchAll error:", e);
        setError("Failed to load class information. Please try again.");
      } finally {
        setInitialLoading(false);
      }
    };

    fetchAll();
  }, [classId]);

  // Poll every 10s if student is waiting for instructor to start
  useEffect(() => {
    if (!classId || joined || isInstructor) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/live-classes/${classId}`);
        const url = res.data?.provider_join_url;
        if (url) {
          setRoomInfo({ roomName: "", joinUrl: url });
          setJoined(true);
          clearInterval(interval);
        }
      } catch {}
    }, 10_000);

    return () => clearInterval(interval);
  }, [classId, joined, isInstructor]);

  const createAndJoinRoom = async () => {
    if (!METERED_DOMAIN) {
      setError("Metered domain is not configured.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<MeetingRoom>("/metered/create-room");
      setRoomInfo(data);

      // Persist the join URL so students can join
      if (classId) {
        try {
          await updateLiveClass(parseInt(classId, 10), {
            provider_join_url: data.joinUrl,
          } as any);
        } catch {
          console.warn("Could not persist join URL");
        }
      }
      setJoined(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create meeting room.");
    } finally {
      setLoading(false);
    }
  };

  const leaveRoom = () => {
    setJoined(false);
    setRoomInfo(null);
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div style={styles.page}>
        <p style={{ color: "#94a3b8", fontSize: "1.1rem" }}>⏳ Loading class info...</p>
      </div>
    );
  }

  // Helper to append name and autoJoin to URL
  const getUrlWithName = (url: string) => {
    if (!url) return url;
    let newUrl = url;
    newUrl += newUrl.includes("?") ? "&" : "?";
    newUrl += "autoJoin=true";
    if (userName) {
      newUrl += `&name=${encodeURIComponent(userName)}`;
    }
    return newUrl;
  };

  // ─── Room embedded (both instructor & student once joined) ──────────────────
  if (joined && roomInfo) {
    const finalUrl = getUrlWithName(roomInfo.joinUrl);
    
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>📡 {liveClass?.title ?? "Live Class"}</h1>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.controls}>
          <a href={finalUrl} target="_blank" rel="noopener noreferrer" style={styles.btnGreen}>
            🔗 Open in New Tab
          </a>
          {isInstructor && (
            <button onClick={leaveRoom} style={styles.btnRed}>
              ⏹ End Class
            </button>
          )}
          {!isInstructor && (
            <button onClick={leaveRoom} style={styles.btnGray}>
              ← Leave Room
            </button>
          )}
        </div>

        <div style={styles.iframeWrap}>
          <iframe
            title="Live Class — Metered Video"
            src={finalUrl}
            allow="camera; microphone; display-capture; fullscreen"
            style={styles.iframe}
          />
        </div>

        {isInstructor && (
          <p style={styles.shareNote}>
            Share with students: <strong style={{ color: "#93c5fd" }}>{roomInfo.joinUrl}</strong>
          </p>
        )}
      </div>
    );
  }

  // ─── Instructor — start screen ──────────────────────────────────────────────
  if (isInstructor) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>📡 {liveClass?.title ?? "Live Class"}</h1>
        <p style={{ color: "#64748b", marginBottom: "32px" }}>Class ID: {classId}</p>

        {error && <div style={styles.error}>{error}</div>}

        {liveClass?.provider_join_url && (
          <div style={styles.infoBox}>
            <p style={{ color: "#93c5fd", fontSize: "0.9rem", marginBottom: "12px" }}>
              ✅ A room has already been created for this class.
            </p>
            <button
              onClick={() => {
                setRoomInfo({ roomName: "", joinUrl: liveClass.provider_join_url! });
                setJoined(true);
              }}
              style={styles.btnBlue}
            >
              🔗 Rejoin Existing Room
            </button>
          </div>
        )}

        <button onClick={createAndJoinRoom} disabled={loading} style={loading ? styles.btnDisabled : styles.btnPurple}>
          {loading ? "Creating Room..." : liveClass?.provider_join_url ? "🆕 Create New Room" : "🎥 Start Live Class"}
        </button>
      </div>
    );
  }

  // ─── Student — waiting screen ────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>📡 {liveClass?.title ?? "Live Class"}</h1>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.waitingBox}>
        <div style={{ fontSize: "3rem", marginBottom: "16px" }}>⏳</div>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "8px", color: "#e2e8f0" }}>
          Waiting for the instructor to start...
        </h2>
        <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
          This page will automatically update when the class begins.
        </p>
        <div style={styles.pulseDot} />
      </div>
    </div>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 16px",
  },
  heading: {
    fontSize: "2rem",
    fontWeight: 700,
    marginBottom: "8px",
    textAlign: "center",
  },
  error: {
    background: "#7f1d1d",
    border: "1px solid #ef4444",
    borderRadius: "8px",
    padding: "12px 20px",
    marginBottom: "24px",
    maxWidth: "560px",
    width: "100%",
    textAlign: "center",
  },
  controls: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  iframeWrap: {
    width: "100%",
    maxWidth: "1100px",
    borderRadius: "12px",
    overflow: "hidden",
    border: "2px solid #1e40af",
    background: "#000",
  },
  iframe: {
    width: "100%",
    height: "640px",
    border: "none",
  },
  shareNote: {
    color: "#64748b",
    fontSize: "0.85rem",
    marginTop: "12px",
    textAlign: "center",
    maxWidth: "700px",
  },
  infoBox: {
    background: "#1e3a5f",
    border: "1px solid #2563eb",
    borderRadius: "12px",
    padding: "16px 24px",
    textAlign: "center",
    maxWidth: "480px",
    marginBottom: "16px",
  },
  waitingBox: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "16px",
    padding: "48px 32px",
    textAlign: "center",
    maxWidth: "440px",
    width: "100%",
    marginTop: "20px",
  },
  pulseDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "#22c55e",
    margin: "24px auto 0",
    animation: "pulse 2s infinite",
  },
  btnBlue: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 28px",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnPurple: {
    background: "#7c3aed",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "14px 36px",
    fontSize: "1.1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnGreen: {
    background: "#059669",
    color: "#fff",
    padding: "10px 24px",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: 600,
  },
  btnRed: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 24px",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnGray: {
    background: "#334155",
    color: "#e2e8f0",
    border: "none",
    borderRadius: "8px",
    padding: "10px 24px",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnDisabled: {
    background: "#334155",
    color: "#94a3b8",
    border: "none",
    borderRadius: "8px",
    padding: "14px 36px",
    fontSize: "1.1rem",
    fontWeight: 600,
    cursor: "not-allowed",
  },
};