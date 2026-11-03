import { solveTsp } from './tsp.algorithm';

describe('solveTsp', () => {
  it('chooses the best total route, not just the nearest first destination', () => {
    const result = solveTsp({
      startId: 'PICKUP',
      destinationIds: [1, 2, 3],
      distanceMatrix: {
        PICKUP: { '1': 1, '2': 2, '3': 2 },
        '1': { '2': 100, '3': 100 },
        '2': { '1': 1, '3': 1 },
        '3': { '1': 1, '2': 1 },
      },
    });

    expect(result.strategy).toBe('HELD_KARP');
    expect(result.orderedIds[1]).not.toBe(1);
    expect(result.totalDistanceKm).toBe(4);
  });
});
