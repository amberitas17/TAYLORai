function distance(points) {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
  }, 0);
}

export function buildIndoorGraph(map) {
  const graph = new Map();
  const addEdge = (from, to, edge) => {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from).push({ to, ...edge });
  };
  Object.values(map?.floors || {}).forEach((floor) => {
    (floor.corridors || []).forEach((corridor) => {
      const weight = distance(corridor.points || []);
      addEdge(corridor.fromLandmarkId, corridor.toLandmarkId, { ...corridor, weight });
      if (corridor.bidirectional !== false) addEdge(corridor.toLandmarkId, corridor.fromLandmarkId, { ...corridor, points: [...corridor.points].reverse(), weight });
    });
  });
  (map?.floorConnections || []).forEach((connection) => {
    addEdge(connection.fromLandmarkId, connection.toLandmarkId, { ...connection, weight: connection.weight || 1, transition: true });
    if (connection.bidirectional !== false) addEdge(connection.toLandmarkId, connection.fromLandmarkId, { ...connection, fromLandmarkId: connection.toLandmarkId, toLandmarkId: connection.fromLandmarkId, weight: connection.weight || 1, transition: true });
  });
  return graph;
}

export function findIndoorRoute(map, startLandmarkId, destinationLandmarkId) {
  const graph = buildIndoorGraph(map);
  const distances = new Map([[startLandmarkId, 0]]);
  const previous = new Map();
  const queue = [{ id: startLandmarkId, distance: 0 }];
  while (queue.length) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift();
    if (current.id === destinationLandmarkId) break;
    for (const edge of graph.get(current.id) || []) {
      const nextDistance = current.distance + edge.weight;
      if (nextDistance < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, nextDistance);
        previous.set(edge.to, { from: current.id, edge });
        queue.push({ id: edge.to, distance: nextDistance });
      }
    }
  }
  if (!distances.has(destinationLandmarkId)) return null;
  const edges = [];
  let cursor = destinationLandmarkId;
  while (cursor !== startLandmarkId) {
    const link = previous.get(cursor);
    if (!link) return null;
    edges.unshift(link.edge);
    cursor = link.from;
  }
  return { landmarkIds: [startLandmarkId, ...edges.map((edge) => edge.to)], edges, distance: distances.get(destinationLandmarkId) };
}
