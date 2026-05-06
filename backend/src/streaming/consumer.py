import json, os, sys, re, uuid, numpy as np
from datetime import datetime, timezone
from confluent_kafka import Consumer
from dotenv import load_dotenv

from supabase import create_client

env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../.env'))
load_dotenv(env_path)

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    print("ERROR: Could not find Supabase credentials in the .env file!")
    sys.exit(1)

supabase = create_client(supabase_url, supabase_key)

conf = {'bootstrap.servers': 'localhost:19092', 'group.id': 'mlb-supabase-loader', 'auto.offset.reset': 'latest'}
consumer = Consumer(conf)
consumer.subscribe(["live-pitches"])

pitcher_states = {}

def is_in_strike_zone(px, pz):
    if px is None or pz is None: return "Unknown"
    return "IN ZONE" if -0.83 <= px <= 0.83 and 1.5 <= pz <= 3.5 else "OUT OF ZONE"

def _safe_upsert(table_name, record, conflict='unique_id'):
    payload = dict(record)
    while True:
        try:
            supabase.table(table_name).upsert(payload, on_conflict=conflict).execute()
            return True
        except Exception as e:
            msg = str(e)
            m = re.search(r"Could not find the '([^']+)' column", msg)
            if not m:
                print(f"Supabase upsert failed: {msg}")
                return False
            col = m.group(1)
            if col in payload:
                print(f"Removing unknown column '{col}' from payload and retrying")
                del payload[col]
                continue
            else:
                return False

def analyze_pitch_for_alerts(pitch):
    if pitch.get('pitcher_team') != 'TOR': return []
    p_id, speed, p_type = pitch.get('pitcher_id'), pitch.get('speed_mph'), pitch.get('pitch_type')
    if not all([p_id, speed, p_type]): return []
    
    if p_id not in pitcher_states: pitcher_states[p_id] = {'velocities': {}}
    state = pitcher_states[p_id]
    if p_type not in state['velocities']: state['velocities'][p_type] = []
    state['velocities'][p_type].append(speed)
    history = state['velocities'][p_type]
    
    alerts = []
    if len(history) >= 10:
        drop = np.mean(history[:-3]) - np.mean(history[-3:])
        if drop > 1.5:
            alerts.append({"unique_id": str(uuid.uuid4()), "pitch_unique_id": pitch.get('unique_id'), "pitcher_id": p_id, "pitcher_name": pitch.get('pitcher_full_name'), "team": "TOR", "alert_type": "Fatigue Risk", "message": f"{p_type} velo dropped by {drop:.1f}mph", "severity": "warning"})
    return alerts

def start_listening():
    print("🎧 Consumer listening... Intelligence Engine Active!")
    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            if msg is None or msg.error(): continue
            
            pitch = json.loads(msg.value().decode('utf-8'))
            pitch['zone_eval'] = is_in_strike_zone(pitch.get('zone_x'), pitch.get('zone_z'))
            
            # --- THE FIX: Convert Unix Timestamp to PostgreSQL format ---
            if pitch.get('timestamp'):
                try:
                    # Convert raw Unix epoch (e.g. 1777957271) to ISO 8601 string
                    ts = float(pitch['timestamp'])
                    pitch['timestamp'] = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
                except Exception as e:
                    # If conversion fails, delete it so the DB uses its default NOW()
                    del pitch['timestamp']
            
            # 1. Save the Pitch using the agent's safe upsert
            success = _safe_upsert('live_pitches', pitch, conflict='unique_id')
            if success:
                print(f"✅ Saved Pitch: {pitch.get('pitcher_full_name', 'Unknown')} - {pitch.get('pitch_type')} @ {pitch.get('speed_mph')}mph")
            
            # 2. Run Intelligence Engine & Save Alerts
            alerts = analyze_pitch_for_alerts(pitch)
            for alert in alerts:
                _safe_upsert('pitch_alerts', alert, conflict='unique_id')
                print(f"🚨 ALERT [{alert['pitcher_name']}]: {alert['message']}")
            
    except KeyboardInterrupt:
        print("\nStopping consumer...")
    finally:
        consumer.close()

if __name__ == "__main__":
    start_listening()