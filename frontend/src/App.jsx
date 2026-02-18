import { useState, useEffect, useRef } from 'react'
import { uploadAudio, checkStatus, getDownloadUrl, transcribeLink, getHistory, login, register, getMe, logout } from './api'
import './index.css'

const LANGUAGES = [
    { code: 'auto', name: 'Auto Detect' },
    { code: 'en', name: 'English' },
    { code: 'si', name: 'Sinhala' },
    { code: 'ta', name: 'Tamil' },
    { code: 'hi', name: 'Hindi' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
];

const MODELS = [
    { id: 'tiny', name: 'Tiny (Fastest)' },
    { id: 'base', name: 'Base (Quick)' },
    { id: 'small', name: 'Small (Recommended)' },
    { id: 'medium', name: 'Medium (Accurate)' },
    { id: 'large', name: 'Large (Ultimate)' },
];

function Auth({ onAuthSuccess }) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setLoading(true);

        try {
            if (isLogin) {
                const user = await login(username, password);
                onAuthSuccess(user);
            } else {
                await register(username, password, email);
                setSuccessMessage("Account created successfully! Please log in.");
                setIsLogin(true); // Switch to login view
                setPassword(''); // Clear password for security
            }
        } catch (err) {
            setError(err.response?.data || "Authentication failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <h1 className="title">Echo Script</h1>
            <div className="auth-card">
                <h2 className="auth-title">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                <p className="auth-subtitle">
                    {isLogin ? 'Sign in to continue your transcriptions' : 'Join us to start transcribing your audio'}
                </p>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {successMessage && (
                        <div className="status-badge status-COMPLETED" style={{ width: '100%', marginBottom: '1rem', boxSizing: 'border-box' }}>
                            {successMessage}
                        </div>
                    )}
                    <div className="input-group">
                        <label>Username</label>
                        <input
                            type="text"
                            className="auth-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    {!isLogin && (
                        <div className="input-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                className="auth-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <div className="input-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="auth-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <div className="error-message" style={{ fontSize: '0.85rem' }}>{error}</div>}

                    <button type="submit" disabled={loading}>
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div className="auth-switch">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                    <span className="auth-link" onClick={() => setIsLogin(!isLogin)}>
                        {isLogin ? 'Sign Up' : 'Log In'}
                    </span>
                </div>
            </div>
        </div>
    );
}

function App() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    const [file, setFile] = useState(null);
    const [url, setUrl] = useState('');
    const [activeTab, setActiveTab] = useState('file'); // 'file', 'link', or 'history'
    const [jobId, setJobId] = useState(null);
    const [status, setStatus] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [transcript, setTranscript] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [history, setHistory] = useState([]);
    const [copied, setCopied] = useState(false);

    const resultRef = useRef(null);

    // Options
    const [language, setLanguage] = useState('auto');
    const [model, setModel] = useState('small');
    const [task, setTask] = useState('transcribe');

    const pollInterval = useRef(null);

    useEffect(() => {
        const checkAuth = async () => {
            const currentUser = await getMe();
            setUser(currentUser);
            setAuthLoading(false);
        };
        checkAuth();

        return () => {
            if (pollInterval.current) {
                if (pollInterval.current instanceof EventSource) {
                    pollInterval.current.close();
                } else {
                    clearInterval(pollInterval.current);
                }
            }
        };
    }, []);

    useEffect(() => {
        if (user && activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, user]);

    const handleLogout = async () => {
        try {
            await logout();
        } catch (err) {
            console.error("Logout request failed", err);
        }
        setUser(null);
        setActiveTab('file');
        setHistory([]);
    };

    const fetchHistory = async () => {
        try {
            const data = await getHistory();
            setHistory(data);
        } catch (err) {
            console.error("Failed to fetch history", err);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            setStatus(null);
            setTranscript(null);
            setJobId(null);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type.startsWith('audio/')) {
            setFile(droppedFile);
            setError(null);
            setStatus(null);
            setTranscript(null);
            setJobId(null);
        } else {
            setError("Please drop a valid audio file.");
        }
    };

    const startRealtimeUpdates = (id) => {
        if (pollInterval.current) {
            if (pollInterval.current instanceof EventSource) pollInterval.current.close();
            else clearInterval(pollInterval.current);
        }

        const eventSource = new EventSource(`/api/status/events/${id}`);

        eventSource.addEventListener('status-update', async (event) => {
            const data = JSON.parse(event.data);
            setStatus(data.status);
            if (data.message) setStatusMessage(data.message);

            if (data.status === 'COMPLETED') {
                try {
                    const finalData = await checkStatus(id);
                    setTranscript(finalData.transcript);
                    // Scroll to result after a short delay for state update
                    setTimeout(() => {
                        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 500);
                } catch (err) {
                    console.error("Error fetching final result", err);
                }
                setLoading(false);
                setStatusMessage('');
                eventSource.close();
            } else if (data.status === 'FAILED') {
                setError(`Transcription failed: ${data.message || 'Unknown error'}`);
                setLoading(false);
                setStatusMessage('');
                eventSource.close();
            }
        });

        eventSource.onerror = (err) => {
            console.error("SSE Connection Error:", err);
            eventSource.close();
        };

        pollInterval.current = eventSource;
    };

    const handleUpload = async () => {
        if (activeTab === 'file' && !file) {
            setError("Please select a file first.");
            return;
        }
        if (activeTab === 'link' && !url) {
            setError("Please enter a URL first.");
            return;
        }

        setLoading(true);
        setError(null);
        setTranscript(null);
        setStatus('UPLOADING');

        try {
            const options = {
                language: language === 'auto' ? null : language,
                model,
                task
            };

            let data;
            if (activeTab === 'file') {
                data = await uploadAudio(file, options);
            } else {
                setStatus('PROCESSING');
                data = await transcribeLink(url, options);
            }

            setJobId(data.jobId);
            setStatus(data.status);
            startRealtimeUpdates(data.jobId);
        } catch (err) {
            console.error("Transcription Start Error:", err);
            const errorMessage = err.response?.data || err.message || "Failed to start processing. Check backend connection.";
            setError(typeof errorMessage === 'string' ? errorMessage : "An unexpected error occurred. Please try again.");
            setLoading(false);
            setStatus(null);
        }
    };

    if (authLoading) return <div className="App" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>✨ Loading Echo Script...</div>;

    if (!user) return <Auth onAuthSuccess={(user) => setUser(user)} />;

    const isProcessing = loading && status !== 'COMPLETED' && status !== 'FAILED';

    return (
        <div className="App">
            <div className="nav-bar">
                <div style={{ textAlign: 'left' }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', background: 'linear-gradient(to right, #818cf8, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Echo Script</h2>
                </div>
                <div className="user-badge">
                    <span style={{ fontSize: '0.9rem', color: '#e2e8f0' }}>👋 Hello, <strong>{user.username}</strong></span>
                    <div style={{ height: '20px', width: '1px', background: 'var(--glass-border)' }}></div>
                    <button className="logout-btn" onClick={handleLogout}>Logout</button>
                </div>
            </div>

            <h1 className="title">Echo Script</h1>
            <p className="subtitle">Transform audio files or video links into text with AI precision.</p>

            <div className="card">
                <div className="tabs">
                    <button
                        className={`tab-btn ${activeTab === 'file' ? 'active' : ''}`}
                        onClick={() => setActiveTab('file')}
                        disabled={isProcessing}
                    >
                        File Upload
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'link' ? 'active' : ''}`}
                        onClick={() => setActiveTab('link')}
                        disabled={isProcessing}
                    >
                        From Link
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                        disabled={isProcessing}
                    >
                        History
                    </button>
                </div>

                {activeTab === 'file' ? (
                    <div
                        className={`upload-container ${isDragging ? 'dragging' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <label htmlFor="file-upload" className="custom-file-upload">
                            {file ? 'Change Audio File' : 'Choose Audio File'}
                        </label>
                        <input
                            id="file-upload"
                            type="file"
                            accept="audio/*"
                            onChange={handleFileChange}
                            disabled={isProcessing}
                        />
                        {file && <div className="file-name">📄 {file.name}</div>}
                        {!file && <p style={{ color: '#64748b', margin: '10px 0 0 0' }}>or drag and drop here</p>}
                        <small style={{ color: '#475569', marginTop: '10px' }}>Supports MP3, WAV, M4A, etc.</small>
                    </div>
                ) : activeTab === 'link' ? (
                    <div className="url-container">
                        <input
                            type="text"
                            className="url-input"
                            placeholder="Paste video or audio link (YouTube, etc.)"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            disabled={isProcessing}
                        />
                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>
                            We'll extract the audio automatically and start transcribing.
                        </p>
                    </div>
                ) : activeTab === 'history' ? (
                    <div className="history-container">
                        {history.length === 0 ? (
                            <p style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>No past transcriptions found.</p>
                        ) : (
                            <div className="history-list">
                                {history.map(job => (
                                    <div key={job.id} className="history-item">
                                        <div className="history-info">
                                            <span className={`status-badge status-${job.status}`} style={{ margin: 0, padding: '2px 8px', fontSize: '0.7rem' }}>
                                                {job.status}
                                            </span>
                                            <span className="history-id">ID: {job.id.substring(0, 8)}...</span>
                                            <span className="history-date">
                                                {new Date(job.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <button
                                            className="view-btn"
                                            disabled={loading}
                                            onClick={async (e) => {
                                                const originalText = e.target.innerText;
                                                e.target.innerText = 'Loading...';
                                                setLoading(true);
                                                try {
                                                    setJobId(job.id);
                                                    setStatus(job.status);
                                                    if (job.status === 'COMPLETED') {
                                                        const data = await checkStatus(job.id);
                                                        setTranscript(data.transcript);
                                                        setTimeout(() => {
                                                            resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                        }, 500);
                                                    } else {
                                                        setTranscript(null);
                                                    }
                                                    setActiveTab('file');
                                                } finally {
                                                    setLoading(false);
                                                    e.target.innerText = originalText;
                                                }
                                            }}
                                        >
                                            View Details
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : null}

                {activeTab !== 'history' && (
                    <>
                        <div className="options-grid">
                            <div className="option-group">
                                <label>Target Language</label>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    disabled={isProcessing}
                                >
                                    {LANGUAGES.map(lang => (
                                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="option-group">
                                <label>AI Model Strategy</label>
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    disabled={isProcessing}
                                >
                                    {MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="option-group">
                                <label>Operation Task</label>
                                <select
                                    value={task}
                                    onChange={(e) => setTask(e.target.value)}
                                    disabled={isProcessing}
                                >
                                    <option value="transcribe">Transcribe (To Same Language)</option>
                                    <option value="translate">Translate (To English)</option>
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleUpload}
                            disabled={((activeTab === 'file' ? !file : !url)) || isProcessing}
                            style={{ width: '100%', padding: '1.2rem' }}
                        >
                            {isProcessing ? (
                                <span>{status === 'UPLOADING' ? 'Uploading File...' : 'AI Processing...'}</span>
                            ) : 'Generate Script'}
                        </button>

                        {error && <div className="error-message">{error}</div>}

                        {status && (
                            <div className="status-box">
                                <div className={`status-badge status-${status}`}>
                                    {status}
                                </div>
                                {status === 'PENDING' && <p>Job added to queue... waiting to start.</p>}
                                {status === 'PROCESSING' && (
                                    <div>
                                        <p><strong>{statusMessage || 'Whisper is working its magic...'}</strong></p>
                                        <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                                            This might take some time depending on audio duration and model size.
                                        </p>
                                    </div>
                                )}
                                {status === 'COMPLETED' && <p>✨ {statusMessage || 'Success! Your transcription is ready.'}</p>}
                                <p style={{ fontSize: '0.7rem', color: '#475569', marginTop: '10px' }}>Job ID: {jobId}</p>
                            </div>
                        )}

                        {transcript && (
                            <div className="result-section" ref={resultRef}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0 }}>Result with Timestamps</h3>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(transcript);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }}
                                        className={copied ? 'copied' : ''}
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.2)', width: 'auto' }}
                                    >
                                        {copied ? '✓ Copied!' : 'Copy Text'}
                                    </button>
                                </div>
                                <textarea readOnly value={transcript} />

                                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                    <span style={{ width: '100%', textAlign: 'right', fontSize: '0.8rem', color: '#64748b', marginBottom: '5px' }}>Export as:</span>
                                    <a href={getDownloadUrl(jobId, 'txt')} target="_blank" rel="noreferrer">
                                        <button style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0.5rem 1rem', width: 'auto' }}>
                                            Text (.txt)
                                        </button>
                                    </a>
                                    <a href={getDownloadUrl(jobId, 'srt')} target="_blank" rel="noreferrer">
                                        <button style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '0.5rem 1rem', width: 'auto' }}>
                                            Subtitle (.srt)
                                        </button>
                                    </a>
                                    <a href={getDownloadUrl(jobId, 'vtt')} target="_blank" rel="noreferrer">
                                        <button style={{ background: 'transparent', border: '1px solid var(--secondary)', color: 'var(--secondary)', padding: '0.5rem 1rem', width: 'auto' }}>
                                            WebVTT (.vtt)
                                        </button>
                                    </a>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default App;
