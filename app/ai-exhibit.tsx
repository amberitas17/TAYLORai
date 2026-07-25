import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

interface Display {
  image: string;
  name: string;
  description: string;
}

interface Exhibit {
  id: number;
  name: string;
  key: string;
  description: string;
  image: string;
  hall: string;
  mapPosition: { x: number; y: number };
  displays: Display[];
}

const fallbackExhibits: Exhibit[] = [
  {
    id: 10,
    name: 'Kinetic Garden',
    key: 'kinetic_garden',
    description: 'Our Science Centre welcome begins at the Kinetic Garden, where you can discover the inter-relationship among forms of energy and more through interactive exhibits.',
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/kinetic-garden/teasers/kineticgarden-teaser.jpg',
    hall: 'kinetic_garden',
    mapPosition: { x: 45, y: 65 },
    displays: [
      {
        image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/kinetic-garden/highlights/kineticgarden-highlight-01.jpg',
        name: 'Echo',
        description: 'Speak into the Echo Tube and listen to the echoes!'
      },
      {
        image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/kinetic-garden/highlights/kineticgarden-highlight-02.jpg',
        name: 'Giant Chair',
        description: 'Position your camera at the photo spot and be amazed by the interesting illusion!'
      }
    ]
  },
  {
    id: 20,
    name: "The Mind's Eye",
    key: 'minds_eye',
    description: 'Do you believe what you see? Think again! Our exhibition is curated to inspire you with a fresh perspective.',
    image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/the-mind's-eye/teasers/themindseye-teaser.jpg",
    hall: 'entrance_hall',
    mapPosition: { x: 20, y: 35 },
    displays: [
      {
        image: "https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/the-mind's-eye/highlights/themindseye-highlight-01.jpg",
        name: 'The Unexpected Dinner',
        description: 'Experience amazing optical illusions and tricks of perception!'
      }
    ]
  },
  {
    id: 12,
    name: 'Laser Maze Challenge',
    key: 'laser_maze',
    description: "Harness your inner Ninja and test your reflexes in a field of laser beams.",
    image: 'https://www.science.edu.sg/images/default-source/scs-images/whats-on/exhibitions/laser-maze-challenge/teasers/lasermaze-teaser.jpg',
    hall: 'hall_a',
    mapPosition: { x: 85, y: 75 },
    displays: [
      {
        image: "https://i.imgur.com/vJp3eyk.png",
        name: 'Entrapment',
        description: "Navigate through a maze of lasers with increasing difficulty."
      }
    ]
  }
];

function getDirection(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'East' : 'West';
  return dy > 0 ? 'South' : 'North';
}

export default function ExhibitGuide() {
  const [currentExhibitIndex, setCurrentExhibitIndex] = useState(0);
  const [exhibits, setExhibits] = useState<Exhibit[]>(fallbackExhibits);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadExhibits = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3001/api/v1/exhibits');
        const data = await response.json();

        if (data.success && data.exhibits) {
          setExhibits(data.exhibits);
          console.log('✅ Loaded exhibits from backend:', data.exhibits.length, 'exhibits');
        } else {
          console.warn('⚠️ Failed to load exhibits from backend, using fallback data');
        }
      } catch (error) {
        console.error('❌ Error loading exhibits:', error);
        console.warn('⚠️ Using fallback exhibit data');
      } finally {
        setLoading(false);
      }
    };

    loadExhibits();
  }, []);

  const currentExhibit = exhibits[currentExhibitIndex];
  const nextExhibitIndex = (currentExhibitIndex + 1) % exhibits.length;
  const nextExhibit = exhibits[nextExhibitIndex];

  const navigationInfo = React.useMemo(() => {
    const current = currentExhibit.mapPosition;
    const next = nextExhibit.mapPosition;
    const distance = Math.round(Math.sqrt((next.x - current.x) ** 2 + (next.y - current.y) ** 2));
    const direction = getDirection(current, next);
    return { distance, direction };
  }, [currentExhibit.mapPosition, nextExhibit.mapPosition]);

  const handleNextExhibit = () => {
    setCurrentExhibitIndex(nextExhibitIndex);
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  if (loading || !currentExhibit) {
    return (
      <LinearGradient colors={['#FF6B35', '#FF8C42']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading exhibits from backend...</Text>
          <Text style={styles.loadingSubText}>Connecting to API...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#F5F7FA', '#E3F2FD']} style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={['#FF6B35', '#FF8C42']} style={styles.header}>
          <Text style={styles.headerTitle}>{currentExhibit.hall.replace('_', ' ').toUpperCase()} Navigation</Text>
          <Text style={styles.headerSubtitle}>Interactive Exhibit Guide</Text>
        </LinearGradient>

        {/* Navigation Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.navContainer}
          contentContainerStyle={styles.navContent}
        >
          {exhibits.map((ex, idx) => (
            <TouchableOpacity
              key={ex.key}
              onPress={() => setCurrentExhibitIndex(idx)}
              style={[
                styles.navPill,
                idx === currentExhibitIndex && styles.navPillActive
              ]}
            >
              <Text style={[
                styles.navPillText,
                idx === currentExhibitIndex && styles.navPillTextActive
              ]}>
                {ex.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Current Exhibit */}
        <View style={styles.exhibitCard}>
          <Text style={styles.currentLocationLabel}>You are currently in:</Text>
          <Text style={styles.exhibitName}>{currentExhibit.name}</Text>

          <Image source={{ uri: currentExhibit.image }} style={styles.exhibitImage} />

          <Text style={styles.exhibitDescription}>{currentExhibit.description}</Text>

          {/* Displays */}
          <Text style={styles.displaysTitle}>Exhibit Displays</Text>
          {currentExhibit.displays?.map((item, idx) => (
            <View key={idx} style={styles.displayCard}>
              <Image source={{ uri: item.image }} style={styles.displayImage} />
              <Text style={styles.displayName}>{item.name}</Text>
              <Text style={styles.displayDescription}>{item.description}</Text>
            </View>
          ))}

          {/* Navigation Info */}
          <View style={styles.navigationCard}>
            <Text style={styles.navigationTitle}>Next Exhibit: {nextExhibit.name}</Text>
            <Text style={styles.navigationText}>Distance: {navigationInfo.distance} units</Text>
            <Text style={styles.navigationText}>Direction: {navigationInfo.direction}</Text>
          </View>

          <TouchableOpacity style={styles.nextButton} onPress={handleNextExhibit}>
            <Text style={styles.nextButtonText}>Go to Next Exhibit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.homeButton} onPress={handleBackToHome}>
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 18,
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
  },
  loadingSubText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  header: {
    padding: 24,
    margin: 16,
    borderRadius: 16,
    marginTop: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginTop: 8,
  },
  navContainer: {
    marginVertical: 16,
  },
  navContent: {
    paddingHorizontal: 16,
  },
  navPill: {
    backgroundColor: '#E0E0E0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
  },
  navPillActive: {
    backgroundColor: '#FF8C42',
  },
  navPillText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  navPillTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  exhibitCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentLocationLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  exhibitName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 16,
  },
  exhibitImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  exhibitDescription: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 20,
  },
  displaysTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  displayCard: {
    marginBottom: 20,
  },
  displayImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
  },
  displayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  displayDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  navigationCard: {
    backgroundColor: '#F5F7FA',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  navigationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  navigationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  nextButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  homeButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  homeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});