// AI Navigation Service
class AINavigationService {
  constructor() {
    this.exhibits = [
      { id: 1, name: 'Giant Labyrinth', x: 15, y: 40, visited: false },
      { id: 2, name: 'Laser Maze Challenge', x: 45, y: 50, visited: false },
      { id: 3, name: 'Robot Station', x: 75, y: 30, visited: false },
      { id: 4, name: 'Space Explorer', x: 25, y: 75, visited: false },
      { id: 5, name: 'DNA Lab', x: 85, y: 60, visited: false },
      { id: 6, name: 'Energy Zone', x: 60, y: 80, visited: false },
      { id: 7, name: 'Virtual Reality Pod', x: 35, y: 20, visited: false },
      { id: 8, name: 'Climate Chamber', x: 55, y: 35, visited: false },
      { id: 9, name: 'Hologram Theater', x: 20, y: 90, visited: false },
      { id: 10, name: 'AI Learning Center', x: 90, y: 40, visited: false }
    ];

    this.currentLocation = { x: 50, y: 60 };
    this.currentExhibit = null;
    this.visitedExhibits = new Set();
    this.pathHistory = [];

    // Live tracking data
    this.liveTracking = {
      stepCount: 0,
      totalDistance: 0,
      currentDirection: 'North',
      isActive: false,
      lastUpdate: null
    };
  }

  // Find nearest exhibit to current location
  findNearestExhibit(currentPos = this.currentLocation) {
    let nearest = null;
    let minDistance = Infinity;

    this.exhibits.forEach(exhibit => {
      if (!this.visitedExhibits.has(exhibit.id)) {
        const distance = this.calculateDistance(currentPos, exhibit);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = exhibit;
        }
      }
    });

    return nearest;
  }

  // Calculate distance between two points
  calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Calculate real-world distance in meters (scale factor for exhibit hall)
  calculateRealDistance(point1, point2) {
    const mapDistance = this.calculateDistance(point1, point2);
    // Assuming the map represents roughly 200m x 150m hall
    const scaleX = 200; // meters
    const scaleY = 150; // meters
    const realDistance = mapDistance * Math.max(scaleX, scaleY) / 100;
    return Math.round(realDistance);
  }

  // Generate path between two points (simplified A* algorithm)
  generatePath(start, end) {
    // For now, using simple direct path with some waypoints
    // In real implementation, would use proper pathfinding with obstacles
    const waypoints = [];

    // Add start point
    waypoints.push({ x: start.x, y: start.y });

    // Add intermediate waypoints based on layout
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    // Add corridor navigation points
    if (Math.abs(start.x - end.x) > 30) {
      waypoints.push({ x: midX, y: start.y });
      waypoints.push({ x: midX, y: end.y });
    } else if (Math.abs(start.y - end.y) > 30) {
      waypoints.push({ x: start.x, y: midY });
      waypoints.push({ x: end.x, y: midY });
    }

    // Add end point
    waypoints.push({ x: end.x, y: end.y });

    return waypoints;
  }

  // Get direction from one point to another
  getDirection(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'East' : 'West';
    } else {
      return dy > 0 ? 'South' : 'North';
    }
  }

  // Calculate estimated steps based on distance
  calculateSteps(distance) {
    // Average step length is about 0.75 meters
    return Math.round(distance / 0.75);
  }

  // Mark exhibit as visited
  markExhibitVisited(exhibitId) {
    this.visitedExhibits.add(exhibitId);
    const exhibit = this.exhibits.find(e => e.id === exhibitId);
    if (exhibit) {
      exhibit.visited = true;
      this.currentLocation = { x: exhibit.x, y: exhibit.y };
      this.currentExhibit = exhibit;
      this.pathHistory.push({
        exhibitId,
        timestamp: new Date(),
        location: { ...this.currentLocation }
      });
    }
  }

  // Get navigation data for a target exhibit
  getNavigationData(targetExhibitId) {
    const targetExhibit = this.exhibits.find(e => e.id === targetExhibitId);
    if (!targetExhibit) return null;

    const distance = this.calculateRealDistance(this.currentLocation, targetExhibit);
    const direction = this.getDirection(this.currentLocation, targetExhibit);
    const steps = this.calculateSteps(distance);
    const path = this.generatePath(this.currentLocation, targetExhibit);

    return {
      target: targetExhibit,
      distance: `${distance}m`,
      direction,
      steps,
      estimatedTime: Math.ceil(steps / 80), // minutes at ~80 steps/min
      path,
      currentLocation: this.currentLocation
    };
  }

  // Get suggested next exhibit
  getSuggestedExhibit() {
    return this.findNearestExhibit();
  }

  // Get progress information
  getProgress() {
    return {
      visited: this.visitedExhibits.size,
      total: this.exhibits.length,
      percentage: Math.round((this.visitedExhibits.size / this.exhibits.length) * 100),
      current: this.currentExhibit,
      remaining: this.exhibits.filter(e => !this.visitedExhibits.has(e.id))
    };
  }

  // Find exhibit by name (for detection integration)
  findExhibitByName(name) {
    const searchName = name.toLowerCase();
    return this.exhibits.find(exhibit =>
      exhibit.name.toLowerCase().includes(searchName) ||
      searchName.includes(exhibit.name.toLowerCase())
    );
  }

  // Update current location (for real-time tracking)
  updateCurrentLocation(x, y) {
    this.currentLocation = { x, y };
  }

  // Get all exhibits data
  getAllExhibits() {
    return this.exhibits.map(exhibit => ({
      ...exhibit,
      visited: this.visitedExhibits.has(exhibit.id),
      current: this.currentExhibit && this.currentExhibit.id === exhibit.id,
      distance: this.calculateRealDistance(this.currentLocation, exhibit)
    }));
  }

  // Live tracking methods
  updateLiveTracking(data) {
    this.liveTracking = {
      ...this.liveTracking,
      ...data,
      lastUpdate: new Date()
    };
  }

  getLiveTrackingData() {
    return this.liveTracking;
  }

  startLiveTracking() {
    this.liveTracking.isActive = true;
    this.liveTracking.stepCount = 0;
    this.liveTracking.totalDistance = 0;
    console.log('Live tracking started');
  }

  stopLiveTracking() {
    this.liveTracking.isActive = false;
    console.log('Live tracking stopped');
  }

  // Get navigation data with live tracking adjustments
  getNavigationDataLive(targetExhibitId) {
    const navigationData = this.getNavigationData(targetExhibitId);

    if (this.liveTracking.isActive && navigationData) {
      // Adjust distance based on live tracking
      const adjustedDistance = Math.max(0,
        parseInt(navigationData.distance) - this.liveTracking.totalDistance
      );

      // Adjust steps based on live tracking
      const adjustedSteps = Math.max(0,
        navigationData.steps - this.liveTracking.stepCount
      );

      return {
        ...navigationData,
        distance: `${adjustedDistance}m`,
        steps: adjustedSteps,
        direction: this.liveTracking.currentDirection || navigationData.direction,
        liveData: {
          stepCount: this.liveTracking.stepCount,
          totalDistance: this.liveTracking.totalDistance,
          isTracking: this.liveTracking.isActive
        }
      };
    }

    return navigationData;
  }

  // Reset navigation state
  reset() {
    this.visitedExhibits.clear();
    this.currentExhibit = null;
    this.pathHistory = [];
    this.currentLocation = { x: 50, y: 60 }; // Starting position
    this.exhibits.forEach(exhibit => {
      exhibit.visited = false;
    });

    // Reset live tracking
    this.liveTracking = {
      stepCount: 0,
      totalDistance: 0,
      currentDirection: 'North',
      isActive: false,
      lastUpdate: null
    };
  }

  // Export progress data
  exportProgress() {
    return {
      visitedExhibits: Array.from(this.visitedExhibits),
      pathHistory: this.pathHistory,
      currentLocation: this.currentLocation,
      currentExhibit: this.currentExhibit,
      timestamp: new Date()
    };
  }

  // Import progress data
  importProgress(data) {
    if (data.visitedExhibits) {
      this.visitedExhibits = new Set(data.visitedExhibits);
    }
    if (data.pathHistory) {
      this.pathHistory = data.pathHistory;
    }
    if (data.currentLocation) {
      this.currentLocation = data.currentLocation;
    }
    if (data.currentExhibit) {
      this.currentExhibit = data.currentExhibit;
    }

    // Update exhibit visited status
    this.exhibits.forEach(exhibit => {
      exhibit.visited = this.visitedExhibits.has(exhibit.id);
    });
  }
}

// Create and export singleton instance
export const aiNavigationService = new AINavigationService();
export default aiNavigationService;