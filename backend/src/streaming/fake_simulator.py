import json
import time
import random
from confluent_kafka import Producer

conf = {'bootstrap.servers': 'localhost:19092', 'client.id': 'mlb-chaos-simulator'}
producer = Producer(conf)

# Hardcode some Toronto Blue Jays aces
pitchers = [
    {"id": "592332", "full": "Kevin Gausman", "first": "Kevin", "last": "Gausman"},
    {"id": "641355", "full": "José Berríos", "first": "José", "last": "Berríos"}
]

pitch_types = ["Four-Seam Fastball", "Slider", "Curveball"]

def generate_fake_stream():
    print("🌪️ Starting Chaos Simulator: Injecting Synthetic Data...")
    
    # Base velocities so the ML engine establishes a "normal" baseline
    base_velos = {
        "Four-Seam Fastball": 94.5,
        "Slider": 84.0,
        "Curveball": 81.0
    }

    counter = 0

    while True:
        pitcher = random.choice(pitchers)
        ptype = random.choice(pitch_types)
        
        # Normal speed variance (+/- 0.5 mph)
        speed = base_velos[ptype] + random.uniform(-0.5, 0.5)
        
        # --- THE CHAOS INJECTION ---
        if counter > 0 and counter % 12 == 0:
            print(f"\n📉 INJECTING FATIGUE ANOMALY FOR {pitcher['last'].upper()}...")
            speed -= 2.5 # Guaranteed to trigger your >1.5mph drop alert
            
        elif counter > 0 and counter % 18 == 0:
            print(f"\n📈 INJECTING VELOCITY SPIKE FOR {pitcher['last'].upper()}...")
            speed += 2.0 # Guaranteed to trigger your +1.5mph spike alert
        # ---------------------------

        payload = {
            "game_id": 999999,
            "unique_id": f"fake_{time.time()}",
            "pitch_type": ptype,
            "speed_mph": round(speed, 1),
            "zone_x": random.uniform(-1.5, 1.5), # Random strike zone X
            "zone_z": random.uniform(1.0, 4.0),  # Random strike zone Z
            "pitcher_team": "TOR",
            "pitcher_id": pitcher["id"],
            "pitcher_full_name": pitcher["full"],
            "pitcher_first_name": pitcher["first"],
            "pitcher_last_name": pitcher["last"],
            "timestamp": time.time()
        }

        producer.produce(
            topic="live-pitches",
            key=payload['unique_id'].encode('utf-8'),
            value=json.dumps(payload).encode('utf-8')
        )
        producer.flush()

        print(f"⚾ [FAKE] {pitcher['full']} threw a {payload['speed_mph']}mph {ptype}")
        
        counter += 1
        time.sleep(1.5) # Send a new pitch every 1.5 seconds

if __name__ == "__main__":
    generate_fake_stream()