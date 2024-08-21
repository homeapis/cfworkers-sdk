interface GameRom {
  rom_id: string;
  title: string;
  rom_size_bytes: number;
  updated_at: number;
  sha256: string;
  md5: string;
  created_at: number | null;
}

export type { GameRom };
