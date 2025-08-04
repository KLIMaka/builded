
export function sectorLotagText(lotag: number) {
  switch (lotag) {
    case 1: return "WATER";
    case 2: return "UNDERWATER";
    case 9: return "STAR TREK DOORS";
    case 15: return "ELEVATOR TRANSPORT (SE 17)";
    case 16: return "ELEVATOR PLATFORM DOWN";
    case 17: return "ELEVATOR PLATFORM UP";
    case 18: return "ELEVATOR DOWN";
    case 19: return "ELEVATOR UP";
    case 20: return "CEILING DOOR";
    case 21: return "FLOOR DOOR";
    case 22: return "SPLIT DOOR";
    case 23: return "SWING DOOR (SE 11)";
    case 25: return "SLIDE DOOR (SE 15)";
    case 26: return "SPLIT STAR TREK DOOR";
    case 27: return "BRIDGE (SE 20)";
    case 28: return "DROP FLOOR (SE 21)";
    case 29: return "TEETH DOOR (SE 22)";
    case 30: return "ROTATE RISE BRIDGE";
    case 31: return "2 WAY TRAIN (SE=30)";
    case 32767: return "SECRET AREA";
    case 65535: return "END OF LEVEL";
    default: if (lotag > 10000 && lotag < 32767) return "1 TIME SOUND";
  }
  return "";
}

export const SE_TAGS = [
  "ROTATED SECTOR",                // 0
  "ROTATION PIVOT",
  "EARTHQUAKE",
  "RANDOM LIGHTS AFTER SHOT OUT",
  "RANDOM LIGHTS",
  "(UNKNOWN)",                     // 5
  "SUBWAY",
  "TRANSPORT",
  "RISING DOOR LIGHTS",
  "LOWERING DOOR LIGHTS",
  "DOOR CLOSE DELAY",              // 10
  "SWING DOOR PIVOT (ST 23)",
  "LIGHT SWITCH",
  "EXPLOSIVE",
  "SUBWAY CAR",
  "SLIDE DOOR (ST 25)",            // 15
  "ROTATE REACTOR SECTOR",
  "ELEVATOR TRANSPORT (ST 15)",
  "INCREMENTAL SECTOR RISE/FALL",
  "CEILING FALL ON EXPLOSION",
  "BRIDGE (ST 27)",                // 20
  "DROP FLOOR (ST 28)",
  "TEETH DOOR (ST 29)",
  "1-WAY TRANSPORT DESTINATION",
  "CONVEYOR BELT",
  "ENGINE",                        // 25
  "(UNKNOWN)",
  "DEMO CAMERA",
  "LIGHTNING (4890) CONTROLLER",
  "FLOAT",
  "2 WAY TRAIN (ST 31)",           // 30
  "FLOOR Z",
  "CEILING Z",
  "EARTHQUAKE DEBRIS",
];