export type Pitch = {
  pitch_id: string;
  pitch_type: string;
  release_speed: number;
  release_spin_rate: number;
  pfx_x: number;
  pfx_z: number;
  zone_x: number;
  zone_z: number;
  is_in_strike_zone: boolean;
  zone_eval: string;
  created_at: string;
};

export type Stats = {
  maxVelocity: number;
  avgVelocity: number;
  zonePercentage: number;
};
