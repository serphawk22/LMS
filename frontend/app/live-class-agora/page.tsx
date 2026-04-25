'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

// Agora SDK imports
import AgoraRTC from 'agora-rtc-sdk-ng';

// Agora configuration
const AGORA_APP_ID = '4c80630e8a2142e0afdfa1143528891a';
const CHANNEL_NAME = 'test';

// Define types for user tracks
interface UserTrack {
  uid: string;
  videoTrack: any;
  audioTrack: any;
}

export default function AgoraLiveClassPage() {
  const { role, userId } = useAuth();
  const [isJoined, setIsJoined] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<UserTrack[]>([]);
  const [localUid, setLocalUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Refs for Agora client and tracks
  const clientRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const videoTrackRef = useRef<any>(null);
  const audioTrackRef = useRef<any>(null);
  const remoteUsersRef = useRef<UserTrack[]>([]);

  // Initialize Agora client
  useEffect(() => {
    // Create Agora client
    const client = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8',
    });
    
    clientRef.current = client;

    // Set up event listeners
    client.on('user-published', async (user: any, mediaType: any) => {
      console.log('User published:', user.uid, mediaType);
      await client.subscribe(user, mediaType);
      
      if (mediaType === 'video') {
        const videoTrack = user.videoTrack;
        const remoteContainer = document.getElementById(`remote-video-${user.uid}`);
        if (remoteContainer && videoTrack) {
          videoTrack.play(remoteContainer);
        }
        
        // Update remote users state
        const existingUser = remoteUsersRef.current.find(u => u.uid === user.uid);
        if (existingUser) {
          existingUser.videoTrack = videoTrack;
        } else {
          remoteUsersRef.current.push({
            uid: user.uid,
            videoTrack: videoTrack,
            audioTrack: null,
          });
        }
        setRemoteUsers([...remoteUsersRef.current]);
      }
      
      if (mediaType === 'audio') {
        const audioTrack = user.audioTrack;
        if (audioTrack) {
          audioTrack.play();
          const existingUser = remoteUsersRef.current.find(u => u.uid === user.uid);
          if (existingUser) {
            existingUser.audioTrack = audioTrack;
          }
        }
      }
    });

    client.on('user-unpublished', (user: any, mediaType: any) => {
      console.log('User unpublished:', user.uid, mediaType);
      if (mediaType === 'video') {
        remoteUsersRef.current = remoteUsersRef.current.filter(u => u.uid !== user.uid);
        setRemoteUsers([...remoteUsersRef.current]);
      }
    });

    client.on('user-left', (user: any) => {
      console.log('User left:', user.uid);
      remoteUsersRef.current = remoteUsersRef.current.filter(u => u.uid !== user.uid);
      setRemoteUsers([...remoteUsersRef.current]);
    });

    client.on('connection-state-change', (curState: string, prevState: string) => {
      console.log('Connection state change:', prevState, '->', curState);
    });

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up Agora client');
      leaveChannel();
    };
  }, []);

  // Join channel function
  const joinChannel = async () => {
    try {
      setError(null);
      console.log('Joining channel:', CHANNEL_NAME);

      // Generate a random user ID based on role
      const uid = role === 'instructor' 
        ? `instructor_${Date.now()}` 
        : `student_${Date.now()}`;

      // Join the channel
      await clientRef.current.join(AGORA_APP_ID, CHANNEL_NAME, null, uid);
      setLocalUid(uid);
      setIsJoined(true);
      console.log('Joined channel successfully, uid:', uid);

      // Create microphone and camera tracks
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      audioTrackRef.current = audioTrack;
      videoTrackRef.current = videoTrack;

      // Play local video
      if (localVideoRef.current) {
        videoTrack.play(localVideoRef.current);
      }

      // Publish tracks to the channel
      await clientRef.current.publish([videoTrack, audioTrack]);
      setIsPublishing(true);
      console.log('Published tracks successfully');

    } catch (err) {
      console.error('Failed to join channel:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to join: ${errorMessage}`);
    }
  };

  // Leave channel function
  const leaveChannel = async () => {
    try {
      console.log('Leaving channel');
      
      // Stop local tracks
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current.close();
        videoTrackRef.current = null;
      }
      
      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
        audioTrackRef.current.close();
        audioTrackRef.current = null;
      }

      // Leave the channel
      if (clientRef.current) {
        await clientRef.current.leave();
      }

      setIsJoined(false);
      setIsPublishing(false);
      setRemoteUsers([]);
      remoteUsersRef.current = [];
      setLocalUid(null);
      
      console.log('Left channel successfully');
    } catch (err) {
      console.error('Failed to leave channel:', err);
    }
  };

  // Toggle mute function
  const toggleMute = async () => {
    if (audioTrackRef.current) {
      if (isMuted) {
        await audioTrackRef.current.setEnabled(true);
        setIsMuted(false);
      } else {
        await audioTrackRef.current.setEnabled(false);
        setIsMuted(true);
      }
    }
  };

  // Toggle video function
  const toggleVideo = async () => {
    if (videoTrackRef.current) {
      if (isVideoOff) {
        await videoTrackRef.current.setEnabled(true);
        setIsVideoOff(false);
      } else {
        await videoTrackRef.current.setEnabled(false);
        setIsVideoOff(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Live Video Class (Agora)</h1>
          <p className="text-gray-400">
            Channel: {CHANNEL_NAME} | App ID: {AGORA_APP_ID.substring(0, 8)}...
          </p>
          
          {/* Status */}
          <div className="mt-4 flex justify-center items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isJoined ? 'bg-green-400' : 'bg-red-400'} ${isJoined ? 'animate-pulse' : ''}`}></div>
              <span>{isJoined ? 'Connected' : 'Not Connected'}</span>
            </div>
            
            {isPublishing && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse"></div>
                <span>Publishing</span>
              </div>
            )}
            
            {localUid && (
              <div className="text-sm text-gray-400">
                Your ID: {localUid}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-900 bg-opacity-50 border border-red-500 rounded-lg max-w-md mx-auto">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-8">
          {!isJoined ? (
            <button
              onClick={joinChannel}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition"
            >
              🎥 Join Class
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`font-medium py-2 px-6 rounded-lg transition ${
                  isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {isMuted ? '🔇 Unmute' : '🔊 Mute'}
              </button>
              
              <button
                onClick={toggleVideo}
                className={`font-medium py-2 px-6 rounded-lg transition ${
                  isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {isVideoOff ? '📷 Turn On Video' : '📹 Turn Off Video'}
              </button>
              
              <button
                onClick={leaveChannel}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition"
              >
                ⏹ Leave Class
              </button>
            </>
          )}
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Local Video */}
          {isJoined && (
            <div className="bg-gray-800 rounded-lg overflow-hidden border-2 border-green-500">
              <div className="p-2 bg-gray-700 flex justify-between items-center">
                <span className="text-sm font-medium">Your Video (You)</span>
                <span className="text-xs text-green-400">Local</span>
              </div>
              <div 
                ref={localVideoRef} 
                className="aspect-video bg-black"
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* Remote Users */}
          {remoteUsers.map((user) => (
            <div key={user.uid} className="bg-gray-800 rounded-lg overflow-hidden border-2 border-blue-500">
              <div className="p-2 bg-gray-700 flex justify-between items-center">
                <span className="text-sm font-medium">User: {user.uid}</span>
                <span className="text-xs text-blue-400">Remote</span>
              </div>
              <div 
                id={`remote-video-${user.uid}`}
                className="aspect-video bg-black"
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>

        {/* Empty State */}
        {isJoined && remoteUsers.length === 0 && (
          <div className="text-center mt-8 text-gray-500">
            <p>Waiting for other users to join...</p>
            <p className="text-sm mt-2">Share the channel name "{CHANNEL_NAME}" with others to join</p>
          </div>
        )}

        {!isJoined && (
          <div className="text-center mt-8 text-gray-500">
            <p>Click "Join Class" to start the video call</p>
          </div>
        )}
      </div>
    </div>
  );
}