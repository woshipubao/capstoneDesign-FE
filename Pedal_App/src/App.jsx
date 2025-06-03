import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import "./App.css";

// 각도 변환 함수 (0~20도 → -90~90도 회전)
function angleToDegree(angle) {
  return -90 + (angle / 20) * 180;
}

function App() {
  const [pedal, setPedal] = useState(-1);
  const [angle, setAngle] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const alertAudioRef = useRef(null);

  const lastPedalRef = useRef(-1);
  const lastAngleRef = useRef(null);
  const lastTimestampRef = useRef(null);

  useEffect(() => {
    const socket = io("http://192.168.141.5:5000");

    socket.on("connect", () => {
      console.log("✅ WebSocket 연결됨");
    });

    socket.on("sensor_data", (data) => {
      console.log("📦 수신:", data);

      const angleChanged = data.angle !== lastAngleRef.current;
      setAngle(data.angle);
      lastAngleRef.current = data.angle;

      if (data.pedal === -1) {
        lastPedalRef.current = -1;
      }

      if (data.pedal === lastPedalRef.current && !angleChanged) {
        if (data.timestamp === lastTimestampRef.current) return;
      }

      setPedal(data.pedal);

      if (data.sudden_acceleration && data.pedal === 1) {
        const id = Date.now();
        setAlerts((prev) => [...prev, id]);
        setTimeout(() => {
          setAlerts((prev) => prev.filter((a) => a !== id));
        }, 1500);
      }

      if (data.pedal !== -1) {
        setHistory((prev) => {
          const newEntry = {
            time: new Date(data.timestamp * 1000).toLocaleString(),
            pedal: data.pedal,
          };
          return [...prev, newEntry].slice(-50);
        });
      }

      lastPedalRef.current = data.pedal;
      lastTimestampRef.current = data.timestamp;
    });

    socket.on("disconnect", () => {
      console.log("❌ WebSocket 해제됨");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const audio = alertAudioRef.current;
    if (!audio) return;

    if (alerts.length > 0) {
      audio.currentTime = 0;
      audio.play().catch((e) => {
        console.log("🔇 자동 재생 차단:", e.message);
      });
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [alerts]);

  return (
    <>
      <audio ref={alertAudioRef} src="/alert.mp3" preload="auto" loop />

      {alerts.length > 0 && (
        <div className="alert-overlay">🚨 급발진 의심</div>
      )}

      <h1 className="title">🚗 페달 상태 모니터링</h1>

      <div className="gauge-wrapper">
        <img src="/images/gauge_base.png" className="gauge-base" alt="게이지 배경" />
        <img
          src="/images/needle.png"
          className="gauge-needle"
          alt="게이지 바늘"
          style={{ transform: `rotate(${angleToDegree(angle)}deg)` }}
        />
      </div>

      <div className="status-text">
        {pedal === 1 && "현재 상태: 엑셀 밟는 중"}
        {pedal === 0 && "현재 상태: 브레이크 밟는 중"}
        {pedal === -1 && "현재 상태: 페달을 밟고 있지 않음"}
      </div>

      <div className="card-container">
        <div className={`card accel ${pedal === 1 ? "active" : ""}`}>
          엑셀
        </div>
        <div className={`card brake ${pedal === 0 ? "active" : ""}`}>
          브레이크
        </div>
      </div>

      <div style={{ color: "white", marginTop: "40px", maxWidth: "600px" }}>
        <h2>📜 페달 기록</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #aaa" }}>시간</th>
              <th style={{ borderBottom: "1px solid #aaa" }}>페달</th>
            </tr>
          </thead>
          <tbody>
            {history
              .filter((entry) => entry.pedal !== -1)
              .slice(-10)
              .reverse()
              .map((entry, index) => (
                <tr key={index}>
                  <td>{entry.time}</td>
                  <td>{entry.pedal === 1 ? "엑셀" : "브레이크"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default App;