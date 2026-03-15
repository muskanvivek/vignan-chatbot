import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const VoiceOutput = ({ text, language, isPlaying, onToggle }) => {
  const [synth, setSynth] = useState(null);
  const [utterance, setUtterance] = useState(null);

  useEffect(() => {
    if (window.speechSynthesis) {
      setSynth(window.speechSynthesis);
    }
  }, []);

  useEffect(() => {
    if (!synth || !text) return;

    const newUtterance = new SpeechSynthesisUtterance(text);
    newUtterance.lang = language === 'te' ? 'te-IN' : (language === 'hi' ? 'hi-IN' : 'en-US');
    
    newUtterance.onend = () => {
      onToggle(false);
    };

    setUtterance(newUtterance);

    return () => {
      synth.cancel();
    };
  }, [text, language, synth, onToggle]);

  useEffect(() => {
    if (!synth || !utterance) return;

    if (isPlaying) {
      synth.speak(utterance);
    } else {
      synth.cancel();
    }
  }, [isPlaying, utterance, synth]);

  if (!synth) return null;

  return (
    <button
      onClick={() => onToggle(!isPlaying)}
      className={`voice-btn voice-output-btn ${isPlaying ? 'playing' : ''}`}
      title={isPlaying ? 'Stop Speaking' : 'Read Aloud'}
    >
      {isPlaying ? <VolumeX size={20} /> : <Volume2 size={20} />}
    </button>
  );
};

export default VoiceOutput;
