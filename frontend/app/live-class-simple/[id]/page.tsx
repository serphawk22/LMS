'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import AgoraRTC from 'agora-rtc-sdk-ng';

const AGORA_APP_ID = '4c80630e8a2142e0afdfa1143528891a';

export default function SimpleLiveClassPage() {
  const params = useParams();
  const classId = params?.id as string;
  
  const [isJoined, setIsJoined] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const clientRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const videoTrackRef = useRef<any>(null);
  const audioTrackRef = useRef<any>(null);

  useEffect(() => {
    if (!classId) return;

    const client = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8',
    });
    
    clientRef.current = client;

    client.on('user-published', async (user: any, mediaType: any) => {
      await client.subscribe(user, mediaType);
      
      if (mediaType === 'video') {
        const container = document.getElementById(`remote-${user.uid}`);
        if (container && user.videoTrack) {
          user.videoTrack.play(container);
        }
        setRemoteUsers(prev => [...prev.filter(u => u.uid !== user.uid), user]);
      }
      
      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }
    });

    client.on('user-left', (user: any) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    });

    return () => {
      leaveChannel();
    };
  }, [classId]);

  const joinChannel = async () => {
    if (!classId) return;

    try {
      setError(null);
      
      // Join without token (for testing)
      await clientRef.current.join(AGORA_APP_ID, classId, null, `user_${Date.now()}`);
      setIsJoined(true);

      // Create local tracks
      const [videoTrack, audioTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      videoTrackRef.current = videoTrack;
      audioTrackRef.current = audioTrack;

      // Play local video
      if (localVideoRef.current) {
        videoTrack.play(localVideoRef.current);
      }

      // Publish
      await clientRef.current.publish([videoTrack, audioTrack]);
    } catch (err) {
      console.error('Join failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to join');
    }
  };

  const leaveChannel = async () => {
    try {
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current.close();
      }
      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
        audioTrackRef.current.close();
      }
      await clientRef.current?.leave();
    } catch (e) {
      console.error('Leave error:', e);
    }
    setIsJoined(false);
    setRemoteUsers([]);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#fff', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>Live Class</h1>
        <p style={{ textAlign: 'center', color: '#888', marginBottom: '20px' }}>
          Channel: {classId}
        </p>

        {error && (
          <div style={{ background: '#722', padding: '10px', borderRadius: '5px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          {!isJoined ? (
            <button
              onClick={joinChannel}
              style={{ background: '#16a34a', color: '#fff', padding: '12px 24px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}
            >
              Join Class
            </button>
          ) : (
            <button
              onClick={leaveChannel}
              style={{ background: '#dc2626', color: '#fff', padding: '12px 24px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}
            >
              Leave
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {isJoined && (
            <div style={{ background: '#1f1f1f', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '8px', background: '#2a2a2a' }}>Your Video</div>
              <div ref={localVideoRef} style={{ aspectRatio: '16/9', background: '#000' }} />
            </div>
          )}
          
          {remoteUsers.map(user => (
            <div key={user.uid} style={{ background: '#1f1f1f', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '8px', background: '#2a2a2a' }}>User: {user.uid}</div>
              <div id={`remote-${user.uid}`} style={{ aspectRatio: '16/9', background: '#000' }} />
            </div>
          ))}
        </div>

        {isJoined && remoteUsers.length === 0 && (
          <p style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>
            Waiting for others to join...
          </p>
        )}
      </div>
    </div>
  );
}