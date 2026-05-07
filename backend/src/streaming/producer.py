import json
import os, random
import time
import requests
from confluent_kafka import Producer
from datetime import datetime

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:19092")

conf = {'bootstrap.servers': KAFKA_BOOTSTRAP_SERVERS, 'client.id': 'mlb-live-producer'}
producer = Producer(conf)
topic_name = "live-pitches"

# Chaos injection configuration (disabled by default)
ENABLE_CHAOS = os.getenv("ENABLE_CHAOS", "false").lower() in ("1", "true", "yes")
CHAOS_MODE = os.getenv("CHAOS_MODE", "random")  # 'random' or 'deterministic'
CHAOS_PROB = float(os.getenv("CHAOS_PROB", "0.05"))
CHAOS_FATIGUE_INTERVAL = int(os.getenv("CHAOS_FATIGUE_INTERVAL", "12"))
CHAOS_SPIKE_INTERVAL = int(os.getenv("CHAOS_SPIKE_INTERVAL", "18"))
chaos_counter = 0

def get_todays_blue_jays_game():
    # Get today's date in YYYY-MM-DD format
    today = datetime.now().strftime('%Y-%m-%d')
    
    print(f"Checking schedule for {today}...")
    schedule_url = f"https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=141&date={today}"
    
    try:
        response = requests.get(schedule_url).json()
        games = response.get('dates', [])
        
        if not games:
            print("The Blue Jays are not playing today.")
            return None
            
        todays_game = games[0].get('games', [])[0]
        game_pk = todays_game.get('gamePk')
        game_state = todays_game.get('status', {}).get('detailedState')
        
        print(f"Found Game {game_pk} - Status: {game_state}")
        return game_pk

    except Exception as e:
        print(f"Error fetching schedule: {e}")
        return None

def start_live_stream():
    global chaos_counter
    print("Starting Live MLB Polling Pipeline...")
    
    # Dynamically grab today's game
    game_pk = get_todays_blue_jays_game()
    if not game_pk:
        print("Exiting pipeline. Run this again when there is a game!")
        return

    feed_url = f"https://statsapi.mlb.com/api/v1.1/game/{game_pk}/feed/live"
    
    # Stateful Memory: Keep track of pitches we've already sent to Kafka
    processed_pitches = set()

    # The Live Polling Loop
    while True:
        try:
            live_data = requests.get(feed_url).json()

            
            
            game_data = live_data.get('gameData', {})
            home_team = game_data.get('teams', {}).get('home', {}).get('abbreviation', 'Unknown')
            away_team = game_data.get('teams', {}).get('away', {}).get('abbreviation', 'Unknown')
            
            plays = live_data.get('liveData', {}).get('plays', {}).get('allPlays', [])
            
            for play in plays:
                about = play.get('about', {})
                half_inning = about.get('halfInning', 'top').lower()
                pitching_team = home_team if half_inning == 'top' else away_team
                
                # Filter out non-TOR pitches
                if pitching_team != 'TOR':
                    continue

                matchup = play.get('matchup', {})
                pitcher_full_name = matchup.get('pitcher', {}).get('fullName', 'Unknown')
                pitcher_id = matchup.get('pitcher', {}).get('id', 'Unknown')
                at_bat_index = about.get('atBatIndex', 0)
                
                pitcher_first_name = "Unknown"
                pitcher_last_name = "Unknown"

                if str(pitcher_id) != 'Unknown':
                    # The MLB API stores players in a dictionary with keys like "ID661563"
                    player_key = f"ID{pitcher_id}"
                    player_profile = game_data.get('players', {}).get(player_key, {})
                    
                    pitcher_first_name = player_profile.get('firstName', 'Unknown')
                    pitcher_last_name = player_profile.get('lastName', 'Unknown')

                for event in play.get('playEvents', []):
                    if event.get('isPitch'):
                        pitch_number = event.get('pitchNumber', 0)
                        pitch_id = f"{game_pk}_{at_bat_index}_{pitch_number}"
                        
                        if pitch_id in processed_pitches:
                            continue
                            
                        pitch_data = event.get('pitchData', {})
                        details = event.get('details', {})
                        
                        payload = {
                            "game_id": game_pk,
                            "unique_id": pitch_id,
                            "pitch_type": details.get('type', {}).get('description', 'Unknown'),
                            "speed_mph": pitch_data.get('startSpeed', 0),
                            "zone_x": pitch_data.get('coordinates', {}).get('pX', 0),
                            "zone_z": pitch_data.get('coordinates', {}).get('pZ', 0),
                            
                            # --- THE EXPANDED DB METADATA ---
                            "pitcher_team": pitching_team,
                            "pitcher_id": str(pitcher_id),
                            "pitcher_full_name": pitcher_full_name,
                            "pitcher_first_name": pitcher_first_name,
                            "pitcher_last_name": pitcher_last_name,
                            "timestamp": time.time() 
                        }

                        # Chaos injection: mutate the payload speed before producing
                        if ENABLE_CHAOS:
                            # Deterministic mode: use a global counter to inject at fixed intervals
                            if CHAOS_MODE == "deterministic":
                                if chaos_counter > 0 and chaos_counter % CHAOS_FATIGUE_INTERVAL == 0:
                                    print(f"\nINJECTING FATIGUE ANOMALY FOR {pitcher_last_name.upper()}...")
                                    payload["speed_mph"] = max(0, float(payload.get("speed_mph", 0)) - 2.5)
                                elif chaos_counter > 0 and chaos_counter % CHAOS_SPIKE_INTERVAL == 0:
                                    print(f"\nINJECTING VELOCITY SPIKE FOR {pitcher_last_name.upper()}...")
                                    payload["speed_mph"] = float(payload.get("speed_mph", 0)) + 2.0
                                chaos_counter += 1
                            else:
                                # random mode: inject anomalies with configured probability
                                if random.random() < CHAOS_PROB:
                                    if random.random() < 0.6:
                                        print(f"\nRANDOM: Injecting fatigue anomaly for {pitcher_last_name.upper()}...")
                                        payload["speed_mph"] = max(0, float(payload.get("speed_mph", 0)) - 2.5)
                                    else:
                                        print(f"\nRANDOM: Injecting velocity spike for {pitcher_last_name.upper()}...")
                                        payload["speed_mph"] = float(payload.get("speed_mph", 0)) + 2.0

                        producer.produce(
                            topic=topic_name,
                            key=payload['unique_id'].encode('utf-8'),
                            value=json.dumps(payload).encode('utf-8')
                        )
                        producer.flush()
                        
                        # Add to memory so we never send it again
                        processed_pitches.add(pitch_id)
                        
                        print(f"[LIVE] Fired [TOR - {pitcher_full_name}]: {payload['speed_mph']}mph {payload['pitch_type']}")
                        
        except Exception as e:
            print(f"Error polling live data: {e}")
        
        # Wait 5 seconds before asking the MLB API for updates
        time.sleep(5)

if __name__ == "__main__":
    start_live_stream()