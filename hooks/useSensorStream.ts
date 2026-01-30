import { useState, useEffect, useRef } from 'react';

export interface SensorData {
  timestamp: string;
  water_level: number;
  inflow: number;
  outflow: number;
  alert_status: string;
}

export const useSensorStream = (url: string) => {
  const [data, setData] = useState<SensorData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log('Sensor Stream Connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setData(parsed);
      } catch (e) {
        console.error('Stream Parse Error', e);
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      console.log('Sensor Stream Disconnected');
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [url]);

  return { data, isConnected };
};
