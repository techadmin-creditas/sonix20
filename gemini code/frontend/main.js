// --- Main Application Logic ---

const statusDiv = document.getElementById("status");
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const sessionEndSection = document.getElementById("session-end-section");
const restartBtn = document.getElementById("restartBtn");
const micBtn = document.getElementById("micBtn");
const cameraBtn = document.getElementById("cameraBtn");
const screenBtn = document.getElementById("screenBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const textInput = document.getElementById("textInput");
const sendBtn = document.getElementById("sendBtn");
const videoPreview = document.getElementById("video-preview");
const videoPlaceholder = document.getElementById("video-placeholder");
const connectBtn = document.getElementById("connectBtn");
const chatLog = document.getElementById("chat-log");
const voiceSelect = document.getElementById("voiceSelect");
const systemPrompt = document.getElementById("systemPrompt");
const savedPromptSelect = document.getElementById("savedPromptSelect");
const savePromptBtn = document.getElementById("savePromptBtn");
const loadPromptBtn = document.getElementById("loadPromptBtn");
const deletePromptBtn = document.getElementById("deletePromptBtn");
const promptNameInput = document.getElementById("promptName");
const historySection = document.getElementById("history-section");
const historyList = document.getElementById("history-list");
const historyBackBtn = document.getElementById("historyBackBtn");
const historyViewSection = document.getElementById("history-view-section");
const historyViewBack = document.getElementById("historyViewBack");
const historyViewTitle = document.getElementById("historyViewTitle");
const historyViewMessages = document.getElementById("historyViewMessages");
const historyViewAudio = document.getElementById("historyViewAudio");
const showHistoryBtn = document.getElementById("showHistoryBtn");
const openingSentence = document.getElementById("openingSentence");

let currentGeminiMessageDiv = null;
let currentUserMessageDiv = null;
let currentSessionId = null;

// --- Saved Prompts (server-side JSON) ---

let cachedPrompts = {};

async function fetchPrompts() {
  const res = await fetch("/api/prompts");
  cachedPrompts = await res.json();
  return cachedPrompts;
}

function refreshSavedPromptList() {
  savedPromptSelect.innerHTML =
    '<option value="">-- Select a saved prompt --</option>';
  for (const name of Object.keys(cachedPrompts).sort()) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    savedPromptSelect.appendChild(opt);
  }
}

savePromptBtn.onclick = async () => {
  const name = promptNameInput.value.trim();
  if (!name) {
    alert("Enter a name for this prompt.");
    return;
  }
  await fetch(`/api/prompts/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voice: voiceSelect.value,
      system_prompt: systemPrompt.value,
      opening_sentence: openingSentence.value.trim(),
    }),
  });
  await fetchPrompts();
  refreshSavedPromptList();
  savedPromptSelect.value = name;
  promptNameInput.value = "";
};

loadPromptBtn.onclick = () => {
  const name = savedPromptSelect.value;
  if (!name) {
    alert("Select a saved prompt first.");
    return;
  }
  const entry = cachedPrompts[name];
  if (entry) {
    voiceSelect.value = entry.voice || "Puck";
    systemPrompt.value = entry.systemPrompt || "";
    openingSentence.value = entry.openingSentence || "";
  }
};

deletePromptBtn.onclick = async () => {
  const name = savedPromptSelect.value;
  if (!name) {
    alert("Select a saved prompt to delete.");
    return;
  }
  if (!confirm(`Delete saved prompt "${name}"?`)) return;
  await fetch(`/api/prompts/${encodeURIComponent(name)}`, { method: "DELETE" });
  await fetchPrompts();
  refreshSavedPromptList();
};

// Load saved prompts on startup
fetchPrompts().then(refreshSavedPromptList);

// --- Gemini Client ---

const mediaHandler = new MediaHandler();
const geminiClient = new GeminiClient({
  onOpen: () => {
    statusDiv.textContent = "Connected";
    statusDiv.className = "status connected";
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    connectBtn.classList.add("hidden");
    disconnectBtn.classList.remove("hidden");

    // Show opening sentence in chat if provided
    const opening = openingSentence.value.trim();
    if (opening) {
      appendMessage("user", opening);
    }
  },
  onMessage: (event) => {
    if (typeof event.data === "string") {
      try {
        const msg = JSON.parse(event.data);
        handleJsonMessage(msg);
      } catch (e) {
        console.error("Parse error:", e);
      }
    } else {
      mediaHandler.playAudio(event.data);
    }
  },
  onClose: async (e) => {
    console.log("WS Closed:", e);
    statusDiv.textContent = "Disconnected";
    statusDiv.className = "status disconnected";
    await stopAndUploadRecording();
    showSessionEnd();
  },
  onError: (e) => {
    console.error("WS Error:", e);
    statusDiv.textContent = "Connection Error";
    statusDiv.className = "status error";
  },
});

function handleJsonMessage(msg) {
  if (msg.type === "session_id") {
    currentSessionId = msg.session_id;
    console.log("Session ID:", currentSessionId);
    return;
  }
  if (msg.type === "interrupted") {
    mediaHandler.stopAudioPlayback();
    currentGeminiMessageDiv = null;
    currentUserMessageDiv = null;
  } else if (msg.type === "turn_complete") {
    currentGeminiMessageDiv = null;
    currentUserMessageDiv = null;
  } else if (msg.type === "user") {
    if (currentUserMessageDiv) {
      currentUserMessageDiv.textContent += msg.text;
      chatLog.scrollTop = chatLog.scrollHeight;
    } else {
      currentUserMessageDiv = appendMessage("user", msg.text);
    }
  } else if (msg.type === "gemini") {
    if (currentGeminiMessageDiv) {
      currentGeminiMessageDiv.textContent += msg.text;
      chatLog.scrollTop = chatLog.scrollHeight;
    } else {
      currentGeminiMessageDiv = appendMessage("gemini", msg.text);
    }
  }
}

function appendMessage(type, text) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${type}`;
  msgDiv.textContent = text;
  chatLog.appendChild(msgDiv);
  chatLog.scrollTop = chatLog.scrollHeight;
  return msgDiv;
}

// --- Audio Recording for session saving ---

async function stopAndUploadRecording() {
  const sid = currentSessionId;
  if (!sid) return;
  try {
    const blob = await mediaHandler.stopSessionRecording();
    if (!blob) {
      console.log("No audio data to upload");
      return;
    }
    const formData = new FormData();
    formData.append("file", blob, "recording.webm");
    await fetch(`/api/conversations/${encodeURIComponent(sid)}/audio`, {
      method: "POST",
      body: formData,
    });
    console.log("Audio recording uploaded for session", sid);
  } catch (e) {
    console.error("Failed to upload audio recording:", e);
  }
}

// Connect Button Handler
connectBtn.onclick = async () => {
  statusDiv.textContent = "Connecting...";
  connectBtn.disabled = true;

  try {
    // Initialize audio context on user gesture
    await mediaHandler.initializeAudio();

    const config = {
      voice_name: voiceSelect.value,
      system_prompt: systemPrompt.value,
      opening_sentence: openingSentence.value.trim(),
    };
    geminiClient.connect(config);

    // Start session recording (captures AI playback + mic when mic starts)
    mediaHandler.startSessionRecording();
  } catch (error) {
    console.error("Connection error:", error);
    statusDiv.textContent = "Connection Failed: " + error.message;
    statusDiv.className = "status error";
    connectBtn.disabled = false;
  }
};

// UI Controls
disconnectBtn.onclick = () => {
  geminiClient.disconnect();
};

micBtn.onclick = async () => {
  if (mediaHandler.isRecording) {
    mediaHandler.stopAudio();
    micBtn.textContent = "Start Mic";
  } else {
    try {
      await mediaHandler.startAudio((data) => {
        if (geminiClient.isConnected()) {
          geminiClient.send(data);
        }
      });
      micBtn.textContent = "Stop Mic";
    } catch (e) {
      alert("Could not start audio capture");
    }
  }
};

cameraBtn.onclick = async () => {
  if (cameraBtn.textContent === "Stop Camera") {
    mediaHandler.stopVideo(videoPreview);
    cameraBtn.textContent = "Start Camera";
    screenBtn.textContent = "Share Screen";
    videoPlaceholder.classList.remove("hidden");
  } else {
    if (mediaHandler.videoStream) {
      mediaHandler.stopVideo(videoPreview);
      screenBtn.textContent = "Share Screen";
    }

    try {
      await mediaHandler.startVideo(videoPreview, (base64Data) => {
        if (geminiClient.isConnected()) {
          geminiClient.sendImage(base64Data);
        }
      });
      cameraBtn.textContent = "Stop Camera";
      screenBtn.textContent = "Share Screen";
      videoPlaceholder.classList.add("hidden");
    } catch (e) {
      alert("Could not access camera");
    }
  }
};

screenBtn.onclick = async () => {
  if (screenBtn.textContent === "Stop Sharing") {
    mediaHandler.stopVideo(videoPreview);
    screenBtn.textContent = "Share Screen";
    cameraBtn.textContent = "Start Camera";
    videoPlaceholder.classList.remove("hidden");
  } else {
    if (mediaHandler.videoStream) {
      mediaHandler.stopVideo(videoPreview);
      cameraBtn.textContent = "Start Camera";
    }

    try {
      await mediaHandler.startScreen(
        videoPreview,
        (base64Data) => {
          if (geminiClient.isConnected()) {
            geminiClient.sendImage(base64Data);
          }
        },
        () => {
          screenBtn.textContent = "Share Screen";
          videoPlaceholder.classList.remove("hidden");
        }
      );
      screenBtn.textContent = "Stop Sharing";
      cameraBtn.textContent = "Start Camera";
      videoPlaceholder.classList.add("hidden");
    } catch (e) {
      alert("Could not share screen");
    }
  }
};

sendBtn.onclick = sendText;
textInput.onkeypress = (e) => {
  if (e.key === "Enter") sendText();
};

function sendText() {
  const text = textInput.value;
  if (text && geminiClient.isConnected()) {
    geminiClient.sendText(text);
    appendMessage("user", text);
    textInput.value = "";
  }
}

function resetUI() {
  authSection.classList.remove("hidden");
  appSection.classList.add("hidden");
  sessionEndSection.classList.add("hidden");
  historySection.classList.add("hidden");
  historyViewSection.classList.add("hidden");
  connectBtn.classList.remove("hidden");
  disconnectBtn.classList.add("hidden");

  mediaHandler.stopAudio();
  mediaHandler.stopVideo(videoPreview);
  videoPlaceholder.classList.remove("hidden");

  micBtn.textContent = "Start Mic";
  cameraBtn.textContent = "Start Camera";
  screenBtn.textContent = "Share Screen";
  chatLog.innerHTML = "";
  connectBtn.disabled = false;
}

function showSessionEnd() {
  appSection.classList.add("hidden");
  sessionEndSection.classList.remove("hidden");
  connectBtn.classList.remove("hidden");
  disconnectBtn.classList.add("hidden");
  connectBtn.disabled = false;
  mediaHandler.stopAudio();
  mediaHandler.stopVideo(videoPreview);
}

restartBtn.onclick = () => {
  resetUI();
};

// --- Conversation History ---

showHistoryBtn.onclick = () => {
  authSection.classList.add("hidden");
  appSection.classList.add("hidden");
  sessionEndSection.classList.add("hidden");
  historyViewSection.classList.add("hidden");
  historySection.classList.remove("hidden");
  loadConversationHistory();
};

historyBackBtn.onclick = () => {
  historySection.classList.add("hidden");
  historyViewSection.classList.add("hidden");
  authSection.classList.remove("hidden");
};

historyViewBack.onclick = () => {
  historyViewSection.classList.add("hidden");
  historySection.classList.remove("hidden");
};

async function loadConversationHistory() {
  historyList.innerHTML = "<p>Loading...</p>";
  try {
    const res = await fetch("/api/conversations");
    const conversations = await res.json();
    if (conversations.length === 0) {
      historyList.innerHTML = "<p class='no-history'>No past conversations yet.</p>";
      return;
    }
    historyList.innerHTML = "";
    conversations.forEach((conv) => {
      const item = document.createElement("div");
      item.className = "history-item";

      const date = new Date(conv.timestamp);
      const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
      const msgCount = (conv.messages || []).length;
      const preview = (conv.messages || [])
        .filter((m) => m.role === "user")
        .map((m) => m.text)
        .join(" ")
        .substring(0, 80);

      item.innerHTML = `
        <div class="history-item-header">
          <span class="history-date">${dateStr}</span>
          <span class="history-voice">${conv.voice || "Puck"}</span>
          ${conv.has_audio ? '<span class="history-audio-badge">Audio</span>' : ""}
        </div>
        <div class="history-preview">${preview || "(no user messages)"} <span class="history-msg-count">(${msgCount} messages)</span></div>
        <div class="history-actions">
          <button class="btn btn-sm" onclick="viewConversation('${conv.id}')">View</button>
          <button class="btn btn-sm danger" onclick="deleteConversation('${conv.id}')">Delete</button>
        </div>
      `;
      historyList.appendChild(item);
    });
  } catch (e) {
    historyList.innerHTML = "<p>Error loading conversations.</p>";
    console.error(e);
  }
}

async function viewConversation(id) {
  try {
    const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`);
    const conv = await res.json();

    const date = new Date(conv.timestamp);
    historyViewTitle.textContent =
      date.toLocaleDateString() + " " + date.toLocaleTimeString() + " — " + (conv.voice || "Puck");

    historyViewMessages.innerHTML = "";
    (conv.messages || []).forEach((msg) => {
      const div = document.createElement("div");
      div.className = `message ${msg.role === "user" ? "user" : "gemini"}`;
      div.textContent = msg.text;
      historyViewMessages.appendChild(div);
    });

    if (conv.has_audio) {
      historyViewAudio.innerHTML = `
        <label>Session Recording:</label>
        <audio controls src="/api/conversations/${encodeURIComponent(id)}/audio"></audio>
      `;
    } else {
      historyViewAudio.innerHTML = "<p class='no-audio'>No audio recording for this session.</p>";
    }

    historySection.classList.add("hidden");
    historyViewSection.classList.remove("hidden");
  } catch (e) {
    console.error("Error loading conversation:", e);
  }
}

async function deleteConversation(id) {
  if (!confirm("Delete this conversation?")) return;
  await fetch(`/api/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
  loadConversationHistory();
}