'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getLiveClass, LiveClass } from '@/services/live_classes';
import { useAuth } from '@/hooks/useAuth';
import RecordingList from '@/components/RecordingList';

interface LiveClassPageProps {
  params: {
    id: string;
  };
}

export default function LiveClassPage({ params }: LiveClassPageProps) {
  const router = useRouter();
  const { role, userId, tenantId } = useAuth();
  const [liveClass, setLiveClass] = useState<LiveClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  // Media streams
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLiveClassStarted, setIsLiveClassStarted] = useState(false);

  // WebSocket and streaming
  const [isConnected, setIsConnected] = useState(false);
  const [streamChunks, setStreamChunks] = useState<Blob[]>([]);
  const websocketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchLiveClass();
  }, [params.id]);

  useEffect(() => {
    // Connect to WebSocket when liveClass is loaded
    if (liveClass) {
      connectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [liveClass, userId]);

  const fetchLiveClass = async () => {
    try {
      setLoading(true);
      const lc = await getLiveClass(parseInt(params.id));
      setLiveClass(lc);

      // Check if class is currently ongoing
      const now = new Date();
      const classStart = new Date(lc.scheduled_at);
      const duration = lc.duration_minutes || 60;
      const classEnd = new Date(classStart.getTime() + duration * 60000);

      setIsLive(now >= classStart && now <= classEnd);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live class');
      console.error('Error fetching live class:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    if (!liveClass || !userId) return;

    disconnectWebSocket();

    const token = localStorage.getItem('access_token');
    if (!token) return;

    const storedTenantId = typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null;
    const wsTenantId = tenantId || storedTenantId || null;
    const encodedTenantId = wsTenantId ? encodeURIComponent(wsTenantId) : '';

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
    const wsProtocol = apiUrl.startsWith('https://') ? 'wss' : 'ws';
    const apiHost = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsUrl = `${wsProtocol}://${apiHost}/live-classes/ws/${params.id}?token=${encodeURIComponent(token)}${encodedTenantId ? `&x-tenant-id=${encodedTenantId}` : ''}`;

    const ws = new WebSocket(wsUrl);
    websocketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'video_chunk') {
        // Handle incoming video chunk for students
        handleVideoChunk(data.data);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
  };

  const disconnectWebSocket = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    setIsConnected(false);
  };

  const handleVideoChunk = (chunkData: string) => {
    // Convert base64 string back to blob
    const byteCharacters = atob(chunkData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'video/webm' });

    setStreamChunks((prev) => {
      const newChunks = [...prev, blob];

      if (videoRef.current) {
        const combinedBlob = new Blob(newChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(combinedBlob);
        const videoElement = videoRef.current;
        const previousSrc = videoElement.src;
        videoElement.src = url;
        videoElement.load();
        videoElement.play().catch((err) => {
          console.log('Auto-play failed:', err);
        });

        if (previousSrc && previousSrc.startsWith('blob:')) {
          URL.revokeObjectURL(previousSrc);
        }
      }

      return newChunks;
    });
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);

      // Handle when user stops sharing via browser UI
      screenStream.getTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });

      updateCombinedStream();
    } catch (err) {
      console.error('Screen share error:', err);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    updateCombinedStream();
  };

  const startCamera = async () => {
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      cameraStreamRef.current = cameraStream;
      setIsCameraActive(true);
      updateCombinedStream();
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
    updateCombinedStream();
  };

  const updateCombinedStream = () => {
    // Stop previous combined stream
    if (combinedStreamRef.current) {
      combinedStreamRef.current.getTracks().forEach(track => track.stop());
    }

    const streams: MediaStream[] = [];
    if (screenStreamRef.current) streams.push(screenStreamRef.current);
    if (cameraStreamRef.current) streams.push(cameraStreamRef.current);

    if (streams.length === 0) {
      // No streams active
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return;
    }

    // For instructors, show their own stream
    // For students, they'll receive chunks via WebSocket
    const displayStream = streams[0];
    combinedStreamRef.current = displayStream;

    if (isInstructor && videoRef.current) {
      videoRef.current.srcObject = displayStream;
    }
  };

  const startLiveClass = async () => {
    try {
      await startScreenShare();
      await startCamera();
      setIsLiveClassStarted(true);

      // Start recording and streaming for instructors
      if (isInstructor) {
        startRecordingAndStreaming();
      }
    } catch (err) {
      console.error('Failed to start live class:', err);
    }
  };

  const stopLiveClass = () => {
    stopScreenShare();
    stopCamera();
    setIsLiveClassStarted(false);

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  const startRecordingAndStreaming = () => {
    if (!combinedStreamRef.current) return;

    const mediaRecorder = new MediaRecorder(combinedStreamRef.current, {
      mimeType: 'video/webm;codecs=vp9',
    });

    recordedChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);

        // Convert chunk to base64 and send via WebSocket
        const reader = new FileReader();
        reader.onload = () => {
          const base64Data = (reader.result as string).split(',')[1];
          if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({
              type: 'video_chunk',
              data: base64Data,
              timestamp: Date.now()
            }));
          }
        };
        reader.readAsDataURL(event.data);
      }
    };

    mediaRecorder.start(1000); // Collect data every second
    mediaRecorderRef.current = mediaRecorder;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLiveClass();
      disconnectWebSocket();
    };
  }, []);

  const isInstructor = role === 'instructor' || role === 'organization_admin' || role === 'super_admin' || role === 'admin';
  const isStudent = role === 'student';

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-100">
        <div className="text-gray-600">Loading live class...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-100">
        <div className="max-w-md p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!liveClass) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-100">
        <div className="max-w-md p-6 bg-white rounded-lg shadow">
          <p className="text-gray-700">Live class not found</p>
          <button
            onClick={() => router.back()}
            className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Live Class</h1>
          <p className="text-xl text-gray-300">{liveClass.title}</p>
          <p className="text-sm text-gray-400 mt-1">
            {liveClass.course_name} • Instructor: {liveClass.instructor?.full_name || 'Instructor'}
          </p>
          {/* Connection Status */}
          <div className="mt-4 flex justify-center items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-gray-800 rounded-lg overflow-hidden shadow-2xl">
          {/* Video Area */}
          <div className="aspect-video bg-black relative">
            {isInstructor && isLiveClassStarted ? (
              // Instructor view - shows their own stream
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                muted
              />
            ) : isStudent ? (
              // Student view - shows instructor stream received via WebSocket
              streamChunks.length > 0 ? (
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  autoPlay
                  playsInline
                  controls={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📺</div>
                    <p className="text-gray-400 text-xl mb-2">Waiting for instructor to start streaming...</p>
                    <p className="text-gray-500 text-sm">Make sure you're connected to the internet</p>
                  </div>
                </div>
              )
            ) : (
              // Not started or no role
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">📺</div>
                  <p className="text-gray-400 text-xl">Live Class Not Started</p>
                </div>
              </div>
            )}

            {/* Status Overlay */}
            {isStudent && streamChunks.length > 0 && (
              <div className="absolute top-4 left-4 bg-black bg-opacity-70 px-3 py-1 rounded">
                <p className="text-green-400 font-medium">Watching Live...</p>
              </div>
            )}

            {/* Instructor Status Overlay */}
            {isInstructor && isLiveClassStarted && (
              <div className="absolute top-4 left-4 bg-black bg-opacity-70 px-3 py-1 rounded">
                <p className="text-red-400 font-medium">Streaming Live</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-6 bg-gray-800">
            {isInstructor ? (
              // Instructor Controls
              <div className="space-y-4">
                <div className="flex gap-4 justify-center">
                  {!isLiveClassStarted ? (
                    <button
                      onClick={startLiveClass}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition flex items-center gap-2"
                    >
                      🎥 Start Live Class
                    </button>
                  ) : (
                    <button
                      onClick={stopLiveClass}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg transition flex items-center gap-2"
                    >
                      ⏹ Stop Live Class
                    </button>
                  )}
                </div>

                {isLiveClassStarted && (
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                      className={`font-medium py-2 px-6 rounded-lg transition ${
                        isScreenSharing
                          ? 'bg-orange-600 hover:bg-orange-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {isScreenSharing ? 'Stop Screen Share' : 'Start Screen Share'}
                    </button>

                    <button
                      onClick={isCameraActive ? stopCamera : startCamera}
                      className={`font-medium py-2 px-6 rounded-lg transition ${
                        isCameraActive
                          ? 'bg-orange-600 hover:bg-orange-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {isCameraActive ? 'Stop Camera' : 'Start Camera'}
                    </button>
                  </div>
                )}

                <div className="text-center text-sm text-gray-400">
                  Status: {isScreenSharing && 'Screen Sharing'} {isCameraActive && '• Camera Active'} {isConnected && '• Connected'}
                  {!isConnected && '• Disconnected'}
                </div>
              </div>
            ) : isStudent ? (
              // Student View - Show connection and stream status
              <div className="text-center space-y-2">
                <div className="flex justify-center items-center gap-4 text-sm">
                  <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                    {isConnected ? '✓ Connected' : '✗ Disconnected'}
                  </span>
                  <span className={streamChunks.length > 0 ? 'text-green-400' : 'text-gray-500'}>
                    {streamChunks.length > 0 ? '📺 Streaming' : '⏸ Waiting for stream'}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">
                  {streamChunks.length > 0
                    ? 'You are watching the live class stream'
                    : 'The instructor will start streaming soon'
                  }
                </p>
              </div>
            ) : (
              // Unknown role or not authenticated
              <div className="text-center">
                <p className="text-gray-400">Please log in to access the live class</p>
              </div>
            )}
          </div>
        </div>

        {/* Back Button */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.back()}
            className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded-lg transition"
          >
            ← Back to Dashboard
          </button>
        </div>

        {!isLive && new Date(liveClass.scheduled_at) < new Date() && (
          <div className="mt-8">
            <RecordingList courseId={liveClass.course_id} liveSessionId={liveClass.id} />
          </div>
        )}
      </div>
    </div>
  );
}
