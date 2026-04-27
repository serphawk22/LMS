'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

// Agora SDK imports
import AgoraRTC from 'agora-rtc-sdk-ng';

// Agora configuration
const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";

// Define types for user tracks
interface UserTrack {
  uid: string;
  videoTrack: any;
  audioTrack: any;
}

// Role type
type UserRole = 'instructor' | 'student';

// Participant type
interface Participant {
  uid: string;
  userId: string;
  name: string;
  role: 'instructor' | 'student';
  hasAudio: boolean;
  hasVideo: boolean;
  isMuted: boolean;
}

export default function AgoraLiveClassPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  // Don't call useAuth on page load to avoid 401 errors
  // Use only query param for role, default to student
  const classId = params?.id as string;
  
  // Get role from query param only - no auth required
  const queryRole = searchParams?.get('role') as UserRole | null;
  const userRole: UserRole = queryRole || 'student';
  
  const [isJoined, setIsJoined] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<UserTrack[]>([]);
  const [localUid, setLocalUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenTrack, setScreenTrack] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Refs for Agora client and tracks
  const clientRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLDivElement>(null);
  const screenVideoRef = useRef<HTMLDivElement>(null);
  const videoTrackRef = useRef<any>(null);
  const audioTrackRef = useRef<any>(null);
  const screenTrackRef = useRef<any>(null);
  const remoteUsersRef = useRef<UserTrack[]>([]);
  const participantsRef = useRef<Participant[]>([]);

  // Initialize Agora client
  useEffect(() => {
    if (!classId) return;

    // Create Agora client
    const client = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8',
    });
    
    clientRef.current = client;

    // Set up event listeners
    client.on('user-joined', (user: any) => {
      console.log('User joined:', user.uid);
      // Add to participants when they join
      const isInstructor = user.uid.toString().startsWith('instructor_');
      const newParticipant: Participant = {
        uid: user.uid,
        userId: user.uid.toString(),
        name: isInstructor ? 'Instructor' : `Student ${user.uid.toString().slice(-4)}`,
        role: isInstructor ? 'instructor' : 'student',
        hasAudio: false,
        hasVideo: false,
        isMuted: false,
      };
      if (!participantsRef.current.find(p => p.uid === user.uid)) {
        participantsRef.current = [...participantsRef.current, newParticipant];
        setParticipants([...participantsRef.current]);
      }
    });

    client.on('user-published', async (user: any, mediaType: any) => {
      console.log('User published:', user.uid, mediaType);
      await client.subscribe(user, mediaType);
      
      // Add to participants when they publish
      const isInstructor = user.uid.toString().startsWith('instructor_');
      const newParticipant: Participant = {
        uid: user.uid,
        userId: user.uid.toString(),
        name: isInstructor ? 'Instructor' : `Student ${user.uid.toString().slice(-4)}`,
        role: isInstructor ? 'instructor' : 'student',
        hasAudio: mediaType === 'audio' || mediaType === 'video',
        hasVideo: mediaType === 'video',
        isMuted: false,
      };
      
      // Update or add participant
      const existingIndex = participantsRef.current.findIndex(p => p.uid === user.uid);
      if (existingIndex >= 0) {
        participantsRef.current = participantsRef.current.map((p, i) => 
          i === existingIndex ? { ...p, hasAudio: true, hasVideo: p.hasVideo || mediaType === 'video' } : p
        );
        setParticipants([...participantsRef.current]);
      } else {
        participantsRef.current = [...participantsRef.current, newParticipant];
        setParticipants([...participantsRef.current]);
      }
      
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
      // Update participant's media status
      participantsRef.current = participantsRef.current.map(p => 
        p.uid === user.uid 
          ? { ...p, hasVideo: mediaType === 'video' ? false : p.hasVideo, hasAudio: mediaType === 'audio' ? false : p.hasAudio }
          : p
      );
      setParticipants([...participantsRef.current]);
    });

    client.on('user-left', (user: any) => {
      console.log('User left:', user.uid);
      remoteUsersRef.current = remoteUsersRef.current.filter(u => u.uid !== user.uid);
      setRemoteUsers([...remoteUsersRef.current]);
      // Remove from participants
      participantsRef.current = participantsRef.current.filter(p => p.uid !== user.uid);
      setParticipants([...participantsRef.current]);
    });

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up Agora client');
      leaveChannel();
    };
  }, [classId]);

  // Join channel function
  const joinChannel = async () => {
    if (!classId) {
      setError('No class ID provided');
      return;
    }

    try {
      setError(null);
      console.log('Joining channel:', classId, 'as', userRole);

      // Generate user ID based on role
      const uid = userRole === 'instructor' 
        ? `instructor_${Date.now()}` 
        : `student_${Date.now()}`;

      // Join the channel
      await clientRef.current.join(AGORA_APP_ID, classId, null, uid);
      setLocalUid(uid);
      setIsJoined(true);
      console.log('Joined channel successfully, uid:', uid, 'role:', userRole);

      // Add self to participants
      const selfParticipant: Participant = {
        uid: uid,
        userId: uid,
        name: userRole === 'instructor' ? 'You (Instructor)' : 'You',
        role: userRole,
        hasAudio: true,
        hasVideo: userRole === 'instructor',
        isMuted: false,
      };
      participantsRef.current = [selfParticipant];
      setParticipants([selfParticipant]);

      // Role-based logic: Instructor publishes, Student only subscribes
      if (userRole === 'instructor') {
        // Instructor: create and publish tracks
        console.log('Creating tracks as instructor...');
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
      } else {
        // Student: only subscribe, no publishing
        console.log('Joining as student - will only subscribe to remote users');
        setIsPublishing(false);
      }

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
      participantsRef.current = [];
      setParticipants([]);
      
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

  // Screen sharing functions
  const startScreenShare = async () => {
    if (!clientRef.current || !isJoined) {
      console.error('Cannot start screen share: client not initialized');
      return;
    }

    try {
      console.log('Starting screen share...');
      
      // Create screen video track using AgoraRTC
      const screenTrackResult = await AgoraRTC.createScreenVideoTrack({
        optimizationMode: 'detail',
        encoderConfig: {
          width: 1920,
          height: 1080,
          frameRate: 15,
          bitrateMin: 600,
          bitrateMax: 2000,
        },
      });

      const screenTrack = Array.isArray(screenTrackResult) ? screenTrackResult[0] : screenTrackResult;

      // Unpublish camera video first (if publishing)
      if (videoTrackRef.current && userRole === 'instructor') {
        await clientRef.current.unpublish(videoTrackRef.current);
      }

      // Publish the screen track
      await clientRef.current.publish(screenTrack);
      
      // Play screen share in the dedicated element
      if (screenVideoRef.current) {
        screenTrack.play(screenVideoRef.current);
      }
      
      screenTrackRef.current = screenTrack;
      setScreenTrack(screenTrack);
      setIsScreenSharing(true);
      
      console.log('Screen share started successfully');
    } catch (err) {
      console.error('Failed to start screen share:', err);
    }
  };

  const stopScreenShare = async () => {
    if (!clientRef.current || !isJoined) {
      console.error('Cannot stop screen share: client not initialized');
      return;
    }

    try {
      console.log('Stopping screen share...');
      
      if (screenTrackRef.current) {
        // Unpublish the screen track
        await clientRef.current.unpublish(screenTrackRef.current);
        
        // Stop and close the screen track
        screenTrackRef.current.stop();
        screenTrackRef.current.close();
        screenTrackRef.current = null;
      }

      setScreenTrack(null);
      setIsScreenSharing(false);
      
      // Switch back to camera for instructor
      if (videoTrackRef.current && userRole === 'instructor') {
        // Play camera in local video element
        if (localVideoRef.current) {
          videoTrackRef.current.play(localVideoRef.current);
        }
        // Publish camera track again
        await clientRef.current.publish(videoTrackRef.current);
      }
      
      console.log('Screen share stopped successfully');
    } catch (err) {
      console.error('Failed to stop screen share:', err);
    }
  };

  // Participant management functions
  const muteStudent = async (participantUid: string) => {
    try {
      console.log('Muting student:', participantUid);
      
      // Find the participant in remote users
      const remoteUser = remoteUsersRef.current.find(u => u.uid === participantUid);
      
      if (remoteUser && remoteUser.audioTrack) {
        // Actually stop the student's audio track
        await remoteUser.audioTrack.setEnabled(false);
        console.log('Stopped audio for student:', participantUid);
      }
      
      // Update participant state
      setParticipants(prev => prev.map(p => 
        p.uid === participantUid ? { ...p, isMuted: true } : p
      ));
    } catch (err) {
      console.error('Failed to mute student:', err);
    }
  };

  const unmuteStudent = async (participantUid: string) => {
    try {
      console.log('Unmuting student:', participantUid);
      
      // Find the participant in remote users
      const remoteUser = remoteUsersRef.current.find(u => u.uid === participantUid);
      
      if (remoteUser && remoteUser.audioTrack) {
        // Re-enable the student's audio track
        await remoteUser.audioTrack.setEnabled(true);
        console.log('Re-enabled audio for student:', participantUid);
      }
      
      setParticipants(prev => prev.map(p => 
        p.uid === participantUid ? { ...p, isMuted: false } : p
      ));
    } catch (err) {
      console.error('Failed to unmute student:', err);
    }
  };

  const removeStudent = async (participantUid: string) => {
    try {
      console.log('Removing student:', participantUid);
      
      // Find the participant
      const participant = participants.find(p => p.uid === participantUid);
      if (!participant) {
        console.error('Participant not found');
        return;
      }

      const confirmed = confirm(`Are you sure you want to remove ${participant.name || participantUid} from the class?`);
      
      if (confirmed) {
        // Find the remote user and unsubscribe from their tracks
        const remoteUser = remoteUsersRef.current.find(u => u.uid === participantUid);
        
        if (remoteUser) {
          // Stop and close their video track
          if (remoteUser.videoTrack) {
            remoteUser.videoTrack.stop();
            remoteUser.videoTrack.close();
          }
          // Stop and close their audio track
          if (remoteUser.audioTrack) {
            remoteUser.audioTrack.stop();
            remoteUser.audioTrack.close();
          }
          
          // Unsubscribe from the user
          await clientRef.current.unsubscribe(participantUid);
          console.log('Unsubscribed from student:', participantUid);
        }
        
        // Remove from local participants list
        setParticipants(prev => prev.filter(p => p.uid !== participantUid));
        
        // Also remove from remote users
        remoteUsersRef.current = remoteUsersRef.current.filter(u => u.uid !== participantUid);
        setRemoteUsers([...remoteUsersRef.current]);
        
        console.log('Removed student:', participantUid);
      }
    } catch (err) {
      console.error('Failed to remove student:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Live Video Class</h1>
          <p className="text-gray-400">
            Channel: {classId || 'Loading...'} | App ID: {AGORA_APP_ID.substring(0, 8)}...
          </p>
          
          {/* Role Badge */}
          <div className="mt-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              userRole === 'instructor' 
                ? 'bg-purple-600 text-white' 
                : 'bg-blue-600 text-white'
            }`}>
              {userRole === 'instructor' ? '🎓 Instructor' : '🎓 Student'}
            </span>
          </div>
          
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
              disabled={!classId}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg transition"
            >
              🎥 Join Class {userRole === 'instructor' ? '(Publish)' : '(View Only)'}
            </button>
          ) : (
            <>
              {/* Instructor-only controls: Mute and Video */}
              {userRole === 'instructor' && (
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
                    onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                    className={`font-medium py-2 px-6 rounded-lg transition ${
                      isScreenSharing 
                        ? 'bg-orange-600 hover:bg-orange-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isScreenSharing ? '🛑 Stop Screen Share' : '🖥️ Start Screen Share'}
                  </button>
                </>
              )}
              
              <button
                onClick={leaveChannel}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition"
              >
                ⏹ Leave Class
              </button>
            </>
          )}
        </div>

        {/* Participants Panel - Only for Instructor */}
        {isJoined && userRole === 'instructor' && (
          <div className="mt-6 bg-gray-800 rounded-lg p-4 max-w-md">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              👥 Participants ({participants.length})
            </h3>
            
            {participants.length === 0 ? (
              <p className="text-gray-400 text-sm">No participants yet</p>
            ) : (
              <ul className="space-y-2">
                {participants.map((participant) => (
                  <li 
                    key={participant.uid} 
                    className="flex items-center justify-between bg-gray-700 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                        {participant.role === 'instructor' ? '👨‍🏫' : '👤'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{participant.name}</p>
                        <p className="text-xs text-gray-400">
                          {participant.uid}
                          {participant.isMuted && <span className="text-red-400 ml-2">🔇 Muted</span>}
                        </p>
                      </div>
                    </div>
                    
                    {/* Instructor controls for students */}
                    {participant.role === 'student' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => participant.isMuted ? unmuteStudent(participant.uid) : muteStudent(participant.uid)}
                          className={`text-xs px-2 py-1 rounded ${
                            participant.isMuted 
                              ? 'bg-green-600 hover:bg-green-700' 
                              : 'bg-yellow-600 hover:bg-yellow-700'
                          }`}
                          title={participant.isMuted ? 'Unmute student' : 'Mute student'}
                        >
                          {participant.isMuted ? '🔊' : '🔇'}
                        </button>
                        <button
                          onClick={() => removeStudent(participant.uid)}
                          className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded"
                          title="Remove from class"
                        >
                          🚫
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Local Video - Only shown for instructor */}
          {isJoined && userRole === 'instructor' && (
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

          {/* Screen Share Display */}
          {isScreenSharing && screenTrack && (
            <div className="bg-gray-800 rounded-lg overflow-hidden border-2 border-orange-500">
              <div className="p-2 bg-gray-700 flex justify-between items-center">
                <span className="text-sm font-medium">🖥️ Screen Share</span>
                <span className="text-xs text-orange-400">Live</span>
              </div>
              <div 
                ref={screenVideoRef} 
                className="aspect-video bg-black"
                style={{ width: '100%' }}
              />
            </div>
          )}
        </div>

        {/* Empty State */}
        {isJoined && remoteUsers.length === 0 && (
          <div className="text-center mt-8 text-gray-500">
            <p>Waiting for other users to join...</p>
            <p className="text-sm mt-2">Share the channel name "{classId}" with others to join</p>
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