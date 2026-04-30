import React, { useState, useEffect, useRef } from 'react';

const VideoPlayer = ({ courseId, videoSrc }) => {
  const [subtitles, setSubtitles] = useState({});
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const videoRef = useRef(null);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'te', name: 'Telugu' },
    { code: 'ta', name: 'Tamil' },
    { code: 'kn', name: 'Kannada' }
  ];

  useEffect(() => {
    const fetchSubtitles = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
        const response = await fetch(`${apiUrl}/subtitles/${courseId}`);
        if (response.ok) {
          const data = await response.json();
          setSubtitles(data);
        } else {
          console.error('Failed to fetch subtitles');
        }
      } catch (error) {
        console.error('Error fetching subtitles:', error);
      }
    };

    if (courseId) {
      fetchSubtitles();
    }
  }, [courseId]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && subtitles[selectedLanguage]) {
      const currentTime = video.currentTime;
      const segment = subtitles[selectedLanguage].find(
        seg => currentTime >= seg.start && currentTime <= seg.end
      );
      setCurrentSubtitle(segment ? segment.text : '');
    }
  };

  const handleLanguageChange = (e) => {
    setSelectedLanguage(e.target.value);
    setCurrentSubtitle(''); // Reset subtitle on language change
  };

  return (
    <div className="video-container relative w-full max-w-4xl mx-auto">
      <video
        ref={videoRef}
        src={videoSrc}
        controls
        onTimeUpdate={handleTimeUpdate}
        className="w-full h-auto"
      />
      {currentSubtitle && (
        <div className="subtitle-overlay absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg text-center transition-opacity duration-300">
          {currentSubtitle}
        </div>
      )}
      <div className="mt-4 flex justify-center">
        <select
          value={selectedLanguage}
          onChange={handleLanguageChange}
          className="px-4 py-2 border rounded"
        >
          {languages.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default VideoPlayer;