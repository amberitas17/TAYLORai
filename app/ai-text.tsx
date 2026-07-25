import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const speakText = (text: string) => {
  if (Platform.OS === 'web') {
    const synth = (window as any).speechSynthesis;
    const utter = new (window as any).SpeechSynthesisUtterance(text);
    synth.speak(utter);
  }
};

interface ConversationEntry {
  user: string;
  ai: string;
  timestamp: Date;
}

export default function AIAssistantScreen() {
  const [textMessage, setTextMessage] = useState('');
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const handleSendMessage = async () => {
    if (!textMessage.trim()) return;
    setIsProcessing(true);
    const userInput = textMessage.trim();
    setTextMessage('');

    try {
      const response = await fetch('http://localhost:3001/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userInput
        })
      });

      const data = await response.json();
      const aiResponse = data.success ? data.response : 'Sorry, I encountered an error. Please try again.';

      setConversationHistory(prev => [
        ...prev,
        { user: userInput, ai: aiResponse, timestamp: new Date() }
      ]);

      if (autoSpeak) speakText(aiResponse);

    } catch (error) {
      console.error('AI request failed:', error);
      const errorResponse = 'Sorry, I cannot connect to the AI service right now. Please check your connection and try again.';

      setConversationHistory(prev => [
        ...prev,
        { user: userInput, ai: errorResponse, timestamp: new Date() }
      ]);
    }

    setIsProcessing(false);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <LinearGradient colors={['#FF6B35', '#FF8C42']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>AI Assistant</Text>

        <ScrollView
          ref={scrollRef}
          style={styles.chatContainer}
          showsVerticalScrollIndicator={false}
        >
          {conversationHistory.map((entry, idx) => (
            <View key={idx} style={styles.messageContainer}>
              <View style={styles.userMessage}>
                <Text style={styles.userLabel}>You:</Text>
                <Text style={styles.userText}>{entry.user}</Text>
              </View>
              <View style={styles.aiMessage}>
                <Text style={styles.aiLabel}>AI Assistant:</Text>
                <Text style={styles.aiText}>{entry.ai}</Text>
              </View>
            </View>
          ))}
          {isProcessing && (
            <View style={styles.processingContainer}>
              <Text style={styles.processingText}>AI is thinking...</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={textMessage}
            onChangeText={setTextMessage}
            placeholder="Type your message..."
            placeholderTextColor="rgba(0,0,0,0.5)"
            onSubmitEditing={handleSendMessage}
            multiline={false}
          />
          <TouchableOpacity
            style={[styles.button, styles.sendButton]}
            onPress={handleSendMessage}
            disabled={!textMessage.trim() || isProcessing}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, autoSpeak ? styles.speakButtonActive : styles.speakButtonInactive]}
            onPress={() => setAutoSpeak(!autoSpeak)}
          >
            <Text style={styles.buttonText}>{autoSpeak ? '🔊' : '🔇'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  userLabel: {
    color: '#FF9800',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userText: {
    color: '#333',
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 8,
    maxWidth: '80%',
  },
  aiMessage: {
    alignItems: 'flex-start',
  },
  aiLabel: {
    color: '#333',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  aiText: {
    color: '#333',
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 8,
    maxWidth: '80%',
  },
  processingContainer: {
    alignItems: 'center',
    padding: 16,
  },
  processingText: {
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#333',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    backgroundColor: '#FF9800',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  speakButtonActive: {
    backgroundColor: '#4CAF50',
  },
  speakButtonInactive: {
    backgroundColor: '#9E9E9E',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
});