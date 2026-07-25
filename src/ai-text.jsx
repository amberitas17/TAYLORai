import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  MessageCircle,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

// Predefined quick questions
const predefinedQuestions = {
  general: [
    "What are the opening hours?",
    "Where can I park?",
    "How much are the tickets?",
    "Where is the information desk?",
  ],
  families: [
    "What activities are suitable for young children?",
    "Where is KidsSTOP?",
    "Are there baby changing facilities?",
    "Is there a family rest area?",
  ],
};

// Emotion-based responses
const emotionBasedSalesResponses = {
  Happy: [
    "I can see you're happy today! Tickets are just $15. Which exhibit catches your interest first?",
    "Your positive energy is wonderful! Family Package is $35 for 2 adults + 2 children.",
    "Such enthusiasm! Combo tickets at $22 include both permanent and special exhibitions.",
  ],
  Neutral: [
    "Welcome to the Science Centre! Adult tickets are $15, students $10.",
    "Start with our Live Science Lab! Student discounts available.",
    "Our Self-Guided Tour is $18 with audio guide.",
  ],
};

export default function AIAssistant() {
  const [textMessage, setTextMessage] = useState("");
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showQuickQuestions, setShowQuickQuestions] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const scrollViewRef = useRef(null);

  // Fake detected emotion
  const detectedEmotion = "Happy";

  // Auto-scroll
  useEffect(() => {
    if (conversationHistory.length > 0) {
      scrollViewRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversationHistory]);

  const location = useLocation();
  const detectedProfile = location.state?.detectedProfile; // 👈 comes from FaceVerification
  const navigate = useNavigate();
  
  useEffect(() => {
    if (detectedProfile?.emotion) {
      const emotion = detectedProfile.emotion;
      if (emotionBasedSalesResponses[emotion]) {
        const aiResponse =
          emotionBasedSalesResponses[emotion][
            Math.floor(Math.random() * emotionBasedSalesResponses[emotion].length)
          ];

        const newEntry = {
          user: `[Vision Detected: ${emotion}]`,
          ai: aiResponse,
          timestamp: new Date(),
        };

        setConversationHistory((prev) => [...prev, newEntry]);
        speakText(aiResponse);
      }
    }
  }, [detectedProfile]);

  // Init SpeechRecognition
  useEffect(() => {
    if ("webkitSpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onstart = () => setListening(true);
      recognition.onend = () => setListening(false);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setTextMessage(transcript);
        setTimeout(handleSendMessage, 200);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Speak response
  const speakText = (text) => {
    if (!autoSpeak) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    synth.speak(utterance);
  };

  const handleSendMessage = () => {
    if (!textMessage.trim()) return;
    const msg = textMessage.trim();
    setTextMessage("");
    setShowQuickQuestions(false);

    let aiResponse = "";
    if (msg.toLowerCase().includes("ticket")) {
      aiResponse =
        emotionBasedSalesResponses[detectedEmotion][
          Math.floor(Math.random() * 3)
        ];
    } else if (msg.toLowerCase().includes("hours")) {
      aiResponse = "We're open daily from 10 AM to 6 PM.";
    } else {
      aiResponse =
        "Let me help you discover the perfect Science Centre experience!";
    }

    const newEntry = {
      user: msg,
      ai: aiResponse,
      timestamp: new Date(),
    };
    setConversationHistory((prev) => [...prev, newEntry]);
    speakText(aiResponse);
  };

  const handleQuickQuestion = (q) => {
    setTextMessage(q);
    setShowQuickQuestions(false);
    setTimeout(handleSendMessage, 100);
  };

  const resetChat = () => {
    setConversationHistory([]);
    setShowQuickQuestions(true);
    setTextMessage("");
  };

  const startListening = () => recognitionRef.current?.start();
  const stopListening = () => recognitionRef.current?.stop();

  return (
    <div style={styles.container}>
      {/* Header */}
      <button style={styles.backButton} onClick={() => navigate("/ai-exhibit")}>
        ⬅ Back
      </button>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <Sparkles color="#f97316" />
          <div>
            <p style={styles.headerTitle}>AI Assistant</p>
            <p style={styles.headerSubtitle}>{detectedEmotion}</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <button onClick={() => setAutoSpeak(!autoSpeak)} style={styles.iconBtn}>
            {autoSpeak ? <Volume2 /> : <VolumeX />}
          </button>
          <button onClick={resetChat} style={styles.iconBtn}>
            <RotateCcw />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {conversationHistory.length === 0 && showQuickQuestions && (
          <div style={styles.welcomeBox}>
            <Sparkles color="#f97316" />
            <h2 style={styles.welcomeTitle}>Welcome to Science Centre!</h2>
            <p style={styles.welcomeSubtitle}>
              I'm here to help you explore and discover amazing things.
            </p>

            <div style={styles.categoryRow}>
              {Object.keys(predefinedQuestions).map((cat) => (
                <button
                  key={cat}
                  style={{
                    ...styles.categoryBtn,
                    backgroundColor:
                      selectedCategory === cat ? "#f97316" : "#e5e7eb",
                    color: selectedCategory === cat ? "#fff" : "#374151",
                  }}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div style={styles.quickQuestionList}>
              {predefinedQuestions[selectedCategory].map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickQuestion(q)}
                  style={styles.quickQuestionBtn}
                >
                  <MessageCircle color="#f97316" size={16} />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {conversationHistory.map((entry, i) => (
          <div key={i} style={{ marginBottom: "12px" }}>
            <div style={{ textAlign: "right" }}>
              <div style={styles.userBubble}>{entry.user}</div>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={styles.aiBubble}>
                <p style={styles.aiLabel}>
                  <Sparkles color="#f97316" size={14} /> AI Assistant
                </p>
                <p>{entry.ai}</p>
              </div>
            </div>
          </div>
        ))}
        <div ref={scrollViewRef}></div>
      </div>

      {/* Input */}
      <div style={styles.inputRow}>
        <input
          style={styles.inputBox}
          placeholder="Type your message..."
          value={textMessage}
          onChange={(e) => setTextMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
        />
        <button
          onClick={handleSendMessage}
          style={styles.sendBtn}
          disabled={!textMessage.trim()}
        >
          <Send size={18} />
        </button>
        <button
          style={{
            ...styles.micBtn,
            backgroundColor: listening ? "#ef4444" : "#e5e7eb",
            color: listening ? "#fff" : "#000",
          }}
          onClick={listening ? stopListening : startListening}
        >
          {listening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
      </div>
    </div>
  );
}

// 💅 Styles (React Native style mimic)
const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "linear-gradient(to bottom, #fff7ed, #ffffff)",
    fontFamily: "Arial, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "8px" },
  headerTitle: { fontWeight: "bold", fontSize: "16px", color: "#111827" },
  headerSubtitle: { fontSize: "12px", color: "#6b7280" },
  headerRight: { display: "flex", gap: "8px" },
  iconBtn: {
    padding: "6px",
    borderRadius: "50%",
    border: "none",
    background: "transparent",
    cursor: "pointer",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
  },
  welcomeBox: { textAlign: "center" },
  welcomeTitle: { fontSize: "18px", fontWeight: "bold", color: "#111827" },
  welcomeSubtitle: { fontSize: "14px", color: "#6b7280" },
  categoryRow: {
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    margin: "12px 0",
  },
  categoryBtn: {
    padding: "6px 12px",
    borderRadius: "9999px",
    fontSize: "14px",
    cursor: "pointer",
    border: "none",
  },
  quickQuestionList: {
    display: "grid",
    gap: "8px",
  },
  quickQuestionBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "8px",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  userBubble: {
    display: "inline-block",
    background: "#f97316",
    color: "#fff",
    padding: "10px",
    borderRadius: "16px",
    maxWidth: "70%",
  },
  aiBubble: {
    display: "inline-block",
    background: "#f3f4f6",
    padding: "10px",
    borderRadius: "16px",
    maxWidth: "70%",
  },
  aiLabel: {
    fontWeight: "bold",
    fontSize: "13px",
    marginBottom: "4px",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    padding: "12px",
    borderTop: "1px solid #e5e7eb",
    background: "#fff",
    gap: "8px",
  },
  inputBox: {
    flex: 1,
    padding: "10px",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    outline: "none",
    fontSize: "14px",
  },
  sendBtn: {
    padding: "10px",
    background: "#f97316",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
  },
  micBtn: {
    padding: "10px",
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
  },
};
