"use client";

import React, { useEffect, useRef, useState } from "react";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { useParams } from "next/navigation";

const APP_ID = "4c80630e8a2142e0afdfa1143528891a";
const TOKEN = null; // Use null for testing with a temporary token

export default function LiveClassComponent() {
  const params = useParams();
  const classId = params?.id;

  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localTracks, setLocalTracks] = useState<{
    audioTrack: IMicrophoneAudioTrack | null;
    videoTrack: ICameraVideoTrack | null;
  }>({ audioTrack: null, videoTrack: null });
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const localVideoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!classId) return;

    const initAgora = async () => {
      const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      setClient(agoraClient);

      const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      setLocalTracks({ audioTrack: microphoneTrack, videoTrack: cameraTrack });

      agoraClient.on("user-published", async (user, mediaType) => {
        await agoraClient.subscribe(user, mediaType);
        if (mediaType === "video" && user.videoTrack) {
          const remoteVideoTrack = user.videoTrack;
          const remoteVideoContainer = document.createElement("div");
          remoteVideoContainer.id = user.uid.toString();
          remoteVideoContainer.style.width = "200px";
          remoteVideoContainer.style.height = "150px";
          const remoteVideosContainer = document.getElementById("remote-videos");
          if (remoteVideosContainer) {
            remoteVideosContainer.appendChild(remoteVideoContainer);
            remoteVideoTrack.play(remoteVideoContainer);
          }
        }
        if (mediaType === "audio" && user.audioTrack) {
          const remoteAudioTrack = user.audioTrack;
          remoteAudioTrack.play();
        }
      });

      agoraClient.on("user-unpublished", (user) => {
        const remoteVideoContainer = document.getElementById(user.uid.toString());
        if (remoteVideoContainer) {
          remoteVideoContainer.remove();
        }
      });

      await agoraClient.join(APP_ID, classId as string, TOKEN, null);
      await agoraClient.publish([microphoneTrack, cameraTrack]);

      if (localVideoRef.current) {
        cameraTrack.play(localVideoRef.current);
      }
    };

    initAgora();

    return () => {
      const cleanup = async () => {
        if (localTracks.audioTrack) localTracks.audioTrack.close();
        if (localTracks.videoTrack) localTracks.videoTrack.close();
        if (client) {
          await client.leave();
        }
      };
      cleanup();
    };
  }, [classId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <h1>Live Class</h1>
      <div id="local-video" ref={localVideoRef} style={{ width: "400px", height: "300px", backgroundColor: "black" }}></div>
      <div id="remote-videos" style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "20px" }}></div>
    </div>
  );
}