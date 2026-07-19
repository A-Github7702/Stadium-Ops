import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Image, Upload, FileCode, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';

export default function AIInputHub({ onVoiceCommand, onVisionCommand, sosActive }) {
  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef(null);

  // Vision State
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [visionResponse, setVisionResponse] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsListening(true);
      setVoiceText('Listening for stadium commands...');
    };

    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceText(transcript);
      processVoiceCommand(transcript);
    };

    rec.onerror = (e) => {
      console.error(e);
      setVoiceText('Speech error. Click microphone to try again.');
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
  }, []);

  // Process Voice commands
  const processVoiceCommand = (text) => {
    const cleanText = text.toLowerCase();
    
    // Check for Exits / SOS / Evacuations
    if (
      cleanText.includes('exit') || 
      cleanText.includes('evacuate') || 
      cleanText.includes('emergency') || 
      cleanText.includes('sos') || 
      cleanText.includes('fastest route') || 
      cleanText.includes('route out')
    ) {
      onVoiceCommand({ type: 'sos', message: 'SOS triggered by voice command: ' + text });
      return;
    }

    // Check for specific Gates
    if (cleanText.includes('gate a')) {
      onVoiceCommand({ type: 'focus', key: 'gateA', label: 'Gate A - North Access' });
    } else if (cleanText.includes('gate b')) {
      onVoiceCommand({ type: 'focus', key: 'gateB', label: 'Gate B - North East Entrance' });
    } else if (cleanText.includes('gate c')) {
      onVoiceCommand({ type: 'focus', key: 'gateC', label: 'Gate C - East Plaza' });
    } else if (cleanText.includes('gate d')) {
      onVoiceCommand({ type: 'focus', key: 'gateD', label: 'Gate D - South East Entry' });
    } else if (cleanText.includes('gate e')) {
      onVoiceCommand({ type: 'focus', key: 'gateE', label: 'Gate E - South Plaza' });
    } else if (cleanText.includes('gate f')) {
      onVoiceCommand({ type: 'focus', key: 'gateF', label: 'Gate F - West Entrance' });
    } else if (cleanText.includes('gate g')) {
      onVoiceCommand({ type: 'focus', key: 'gateG', label: 'Gate G - North West Plaza' });
    }
    // Check for Transit Hubs
    else if (cleanText.includes('metro') || cleanText.includes('train')) {
      onVoiceCommand({ type: 'focus', key: 'metro', label: 'Stadium Metro Terminal' });
    } else if (cleanText.includes('bus') || cleanText.includes('shuttle')) {
      onVoiceCommand({ type: 'focus', key: 'bus', label: 'Central Bus Loop' });
    } else if (cleanText.includes('parking') || cleanText.includes('car')) {
      onVoiceCommand({ type: 'focus', key: 'parking', label: 'Main Parking Lot P1' });
    } else if (cleanText.includes('reset') || cleanText.includes('overview') || cleanText.includes('stadium')) {
      onVoiceCommand({ type: 'reset' });
    } else {
      setVoiceText(`Command unrecognized: "${text}". Try speaking: "Focus Gate A", "Show Metro Station" or "Find the fastest route out".`);
    }
  };

  const toggleListening = () => {
    if (!speechSupported) {
      // Simulation fallback for browsers/systems that don't support speech
      simulateVoiceInput();
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Fallback simulator for voice instructions
  const simulateVoiceInput = () => {
    const simulations = [
      'Focus Gate C',
      'Show me the nearest exit',
      'Focus Metro Station',
      'Find the fastest route out',
      'Focus Gate F',
      'Reset overview'
    ];
    const randomChoice = simulations[Math.floor(Math.random() * simulations.length)];
    setIsListening(true);
    setVoiceText('Simulating input...');
    
    setTimeout(() => {
      setIsListening(false);
      setVoiceText(`(Simulated) "${randomChoice}"`);
      processVoiceCommand(randomChoice);
    }, 1200);
  };

  // Handle Vision Files
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processVisionFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processVisionFile(file);
    }
  };

  const processVisionFile = (file) => {
    setFileName(file.name);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    setVisionResponse('Connecting to Gemini Multimodal Agent...');

    // Simulate Gemini analysis delay
    setTimeout(() => {
      setIsUploading(false);
      const nameLower = file.name.toLowerCase();

      let instruction = '';
      let actionObj = null;

      if (nameLower.includes('gate') || nameLower.includes('sign') || nameLower.includes('entrance')) {
        instruction = 'Gemini analysis: Photo recognized as Gate G perimeter area. Heavy queues forming. Rerouting 3D waypoint tracker coordinates to Gate A instead.';
        actionObj = { type: 'reroute', source: 'gateG', target: 'gateA' };
      } else if (nameLower.includes('crowd') || nameLower.includes('corridor') || nameLower.includes('hall')) {
        instruction = 'Gemini analysis: High congestion level (91%) detected in South corridor. Evacuation route dynamic override recommended. Path updated.';
        actionObj = { type: 'crowd', source: 'gateD', target: 'parking' };
      } else if (nameLower.includes('fire') || nameLower.includes('smoke') || nameLower.includes('emergency') || nameLower.includes('hazard')) {
        instruction = 'Gemini analysis: Hazard indicator recognized. Fire alarm or obstruction detected in Sector 4. Recommending exit path restrictions via Gate F. Directing flow to West Safety Zone.';
        actionObj = { type: 'hazard', sector: 4, restrictGate: 'gateF' };
      } else {
        instruction = `Gemini analysis: Image metadata parsed successfully (Format: ${file.type}, Size: ${(file.size / 1024).toFixed(1)} KB). General status: Queue building at West entrance. Adjusting telemetry warning thresholds.`;
        actionObj = { type: 'normal' };
      }

      setVisionResponse(instruction);
      onVisionCommand(actionObj);
    }, 2000);
  };

  return (
    <div className="glass-panel p-5 rounded-2xl flex flex-col gap-5 border-slate-800">
      {/* Header */}
      <div>
        <h2 className="font-semibold text-base text-slate-100 tracking-wide">
          MULTIMODAL AI INPUT HUB
        </h2>
        <p className="text-xs text-slate-400">Instruct and analyze with Voice + Vision</p>
      </div>

      {/* Voice Assistant */}
      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-900 flex items-center gap-4">
        <button
          onClick={toggleListening}
          aria-label="Toggle voice assistant microphone recording"
          title="Voice Assistant Mic control"
          className={`p-4 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 transform active:scale-90 ${
            isListening
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/25 status-glow-red'
              : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/35 hover:scale-105'
          }`}
        >
          {isListening ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">Voice Assistant</span>
            {!speechSupported && (
              <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">
                Simulation Mode
              </span>
            )}
          </div>
          <p className={`text-xs truncate ${isListening ? 'text-slate-100 italic' : 'text-slate-300'}`}>
            {voiceText || 'Click mic to say: "Focus Gate C", "Show nearest exit"...'}
          </p>

          {isListening && (
            <div className="flex gap-1 items-end mt-2 h-4">
              <span className="w-[3px] bg-red-400 audio-bar" style={{ animationDelay: '0.1s' }}></span>
              <span className="w-[3px] bg-red-400 audio-bar" style={{ animationDelay: '0.3s' }}></span>
              <span className="w-[3px] bg-red-400 audio-bar" style={{ animationDelay: '0.5s' }}></span>
              <span className="w-[3px] bg-red-400 audio-bar" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-[3px] bg-red-400 audio-bar" style={{ animationDelay: '0.4s' }}></span>
            </div>
          )}
        </div>
      </div>

      {/* Vision Dropzone */}
      <div 
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="p-4 rounded-xl border border-dashed border-slate-800 hover:border-cyan-500/40 bg-slate-950/40 transition-colors flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">Gemini Vision Node</span>
          {imagePreview && (
            <button 
              onClick={() => {
                setImagePreview(null);
                setVisionResponse('');
                setFileName('');
              }}
              aria-label="Clear uploaded image and analysis output"
              title="Clear vision panel"
              className="text-[9px] text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {!imagePreview ? (
          <div 
            onClick={() => fileInputRef.current.click()}
            className="flex flex-col items-center justify-center py-6 cursor-pointer hover:bg-slate-900/20 rounded-lg group"
          >
            <Upload className="w-8 h-8 text-slate-500 group-hover:text-cyan-400 mb-2 transition-colors" />
            <p className="text-xs text-slate-300 font-medium">Drag & drop stadium sign or corridor photo</p>
            <p className="text-[10px] text-slate-500 mt-1">or click to browse local files</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              aria-label="Upload stadium situational photo or sign image"
              title="Upload situational photo"
              onChange={handleFileChange} 
            />
          </div>
        ) : (
          <div className="flex gap-4 items-start">
            <img 
              src={imagePreview} 
              alt="Preview" 
              className="w-16 h-16 object-cover rounded-lg border border-slate-800 bg-slate-900" 
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-300 truncate">{fileName}</p>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald-400 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Uploaded</span>
              </div>
            </div>
          </div>
        )}

        {isUploading && (
          <div className="flex items-center gap-2 text-xs text-cyan-400 justify-center py-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Processing multimodal data...</span>
          </div>
        )}

        {visionResponse && (
          <div className="p-3 bg-slate-900/90 border border-slate-850 rounded-lg text-xs leading-relaxed">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-slate-300">{visionResponse}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
