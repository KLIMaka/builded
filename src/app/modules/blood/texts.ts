import { mapBuilder } from "@utils/collections";

// from mapedit.cpp https://github.com/NBlood/NBlood

export const ITEM = [
  "Skull Key",
  "Eye Key",
  "Fire Key",
  "Dagger Key",
  "Spider Key",
  "Moon Key",
  "Key 7",
  "Doctor's Bag",
  "Medicine Pouch",
  "Life Essence",
  "Life Seed",
  "Red Potion",
  "Feather Fall",
  "Limited Invisibility",
  "INVULNERABILITY",
  "Boots of Jumping",
  "Raven Flight",
  "Guns Akimbo",
  "Diving Suit",
  "Gas mask",
  "Clone",
  "Crystal Ball",
  "Decoy",
  "Doppleganger",
  "Reflective shots",
  "Beast Vision",
  "ShadowCloak",
  "Rage shroom",
  "Delirium Shroom",
  "Grow shroom",
  "Shrink shroom",
  "Death mask",
  "Wine Goblet",
  "Wine Bottle",
  "Skull Grail",
  "Silver Grail",
  "Tome",
  "Black Chest",
  "Wooden Chest",
  "Asbestos Armor",
  "Basic Armor",
  "Body Armor",
  "Fire Armor",
  "Spirit Armor",
  "Super Armor",
  "Blue Team Base",
  "Red Team Base",
  "Blue Flag",
  "Red Flag",
  "DUMMY",
  "Level map",
];

export const AMMO = [
  "Spray can",
  "Bundle of TNT*",
  "Bundle of TNT",
  "Case of TNT",
  "Proximity Detonator",
  "Remote Detonator",
  "Trapped Soul",
  "4 shotgun shells",
  "Box of shotgun shells",
  "A few bullets",
  "Voodoo Doll",
  "OBSOLETE",
  "Full drum of bullets",
  "Tesla Charge",
  "OBSOLETE",
  "OBSOLETE",
  "Flares",
  "OBSOLETE",
  "OBSOLETE",
  "Gasoline Can",
];

export const WEAPON = [
  "RANDOM",
  "Sawed-off",
  "Tommy Gun",
  "Flare Pistol",
  "Voodoo Doll",
  "Tesla Cannon",
  "Napalm Launcher",
  "Pitchfork",
  "Spray Can",
  "Dynamite",
  "Life Leech",
];

export const SPRITE_TAGS = mapBuilder<number, string>()
  .add(0, "Decoration")
  .add(1, "Player Start")
  .add(2, "Bloodbath Start")
  .add(3, "Off marker")
  .add(4, "On marker")
  .add(5, "Axis marker")
  .add(6, "Lower link")
  .add(7, "Upper link")
  .add(8, "Teleport target")
  .add(10, "Lower water")
  .add(9, "Upper water")
  .add(12, "Lower stack")
  .add(11, "Upper stack")
  .add(14, "Lower goo")
  .add(13, "Upper goo")
  .add(15, "Path marker")
  //.add(16, "Alignable Region")
  //.add(17, "Base Region")
  .add(18, "Dude Spawn")
  .add(19, "Earthquake")
  .add(20, "Toggle switch")
  .add(21, "1-Way switch")
  .add(22, "Combination switch")
  .add(23, "Padlock (1-shot)")
  .add(30, "Torch")
  .add(32, "Candle")
  .add(40, WEAPON[0])
  //.add(47, WEAPON[7])
  .add(43, WEAPON[3])
  .add(41, WEAPON[1])
  .add(42, WEAPON[2])
  .add(46, WEAPON[6])
  //.add(49, WEAPON[9])
  //.add(48, WEAPON[8])
  .add(45, WEAPON[5])
  .add(50, WEAPON[10])
  .add(44, WEAPON[4])
  .add(60, AMMO[0])
  .add(62, AMMO[2])
  .add(63, AMMO[3])
  .add(64, AMMO[4])
  .add(65, AMMO[5])
  .add(67, AMMO[7])
  .add(68, AMMO[8])
  .add(69, AMMO[9])
  .add(70, AMMO[10])
  .add(72, AMMO[12])
  .add(73, AMMO[13])
  .add(76, AMMO[16])
  .add(79, AMMO[19])
  .add(66, AMMO[6])
  .add(80, "Random Ammo")
  .add(100, ITEM[0])
  .add(101, ITEM[1])
  .add(102, ITEM[2])
  .add(103, ITEM[3])
  .add(104, ITEM[4])
  .add(105, ITEM[5])
  .add(106, ITEM[6])
  .add(107, ITEM[7])
  .add(108, ITEM[8])
  .add(109, ITEM[9])
  .add(110, ITEM[10])
  .add(111, ITEM[11])
  .add(112, ITEM[12])
  .add(113, ITEM[13])
  .add(114, ITEM[14])
  .add(115, ITEM[15])
  //.add(116, ITEMS[16])
  .add(117, ITEM[17])
  .add(118, ITEM[18])
  .add(119, ITEM[19])
  //.add(120, ITEMS[20])
  .add(121, ITEM[21])
  //.add(122, ITEMS[22])
  .add(123, ITEM[23])
  .add(124, ITEM[24])
  .add(125, ITEM[25])
  //.add(126, ITEMS[26])
  .add(127, ITEM[27])
  .add(128, ITEM[28])
  .add(129, ITEM[29])
  .add(130, ITEM[30])
  //.add(131, ITEMS[31])
  //.add(132, ITEMS[32])
  //.add(133, ITEMS[33])
  //.add(134, ITEMS[34])
  //.add(135, ITEMS[35])
  .add(136, ITEM[36])
  .add(137, ITEM[37])
  .add(138, ITEM[38])
  .add(139, ITEM[39])
  .add(140, ITEM[40])
  .add(141, ITEM[41])
  .add(142, ITEM[42])
  .add(143, ITEM[43])
  .add(144, ITEM[44])
  .add(145, ITEM[45])
  .add(146, ITEM[46])
  .add(201, "Cultist w/Tommy")
  .add(202, "Cultist w/Shotgun")
  .add(247, "Cultist w/Tesla")
  .add(248, "Cultist w/Dynamite")
  .add(249, "Beast Cultist")
  .add(250, "Tiny Caleb")
  .add(251, "Beast")
  .add(203, "Axe Zombie")
  .add(204, "Fat Zombie")
  .add(205, "Earth Zombie")
  .add(244, "Sleep Zombie")
  .add(245, "Innocent")
  .add(206, "Flesh Gargoyle")
  .add(207, "Stone Gargoyle")
  .add(208, "Flesh Statue")
  .add(209, "Stone Statue")
  .add(210, "Phantasm")
  .add(211, "Hound")
  .add(212, "Hand")
  .add(213, "Brown Spider")
  .add(214, "Red Spider")
  .add(216, "Mother Spider")
  .add(215, "Black Spider")
  .add(217, "GillBeast")
  .add(218, "Eel")
  .add(219, "Bat")
  .add(220, "Rat")
  .add(221, "Green Pod")
  .add(222, "Green Tentacle")
  .add(223, "Fire Pod")
  .add(224, "Fire Tentacle")
  .add(227, "Cerberus")
  .add(228, "Cerberus (1 Dead Head)")
  .add(229, "Tchernobog")
  .add(230, "TCultist prone")
  .add(246, "SCultist prone")
  .add(400, "TNT Barrel")
  .add(401, "Armed Prox Bomb")
  .add(402, "Armed Remote")
  //.add(403, "Blue Vase")
  //.add(404, "Brown Vase")
  .add(405, "Crate Face")
  //.add(406, "Glass Window")
  .add(407, "Fluorescent Light")
  .add(408, "Wall Crack")
  .add(409, "Wood Beam")
  .add(410, "Spider's Web")
  .add(411, "MetalGrate1")
  .add(412, "FlammableTree")
  .add(413, "Machine Gun")
  .add(414, "Falling Rock")
  .add(415, "Kickable Pail")
  .add(416, "Gib Object")
  .add(417, "Explode Object")
  .add(427, "Zombie Head")
  // .add(450, "Spike Trap")
  // .add(451, "Rock Trap")
  .add(452, "Flame Trap")
  .add(454, "Saw Blade")
  .add(455, "Electric Zap")
  .add(456, "Switched Zap")
  .add(457, "Pendulum")
  .add(458, "Guillotine")
  .add(459, "Hidden Exploder")
  .add(700, "Trigger Gen")
  .add(701, "WaterDrip Gen")
  .add(702, "BloodDrip Gen")
  .add(703, "Fireball Gen")
  .add(704, "EctoSkull Gen")
  //.add(705, "Dart Gen")
  .add(706, "Bubble Gen")
  .add(707, "Multi-Bubble Gen")
  .add(708, "SFX Gen")
  .add(709, "Sector SFX")
  .add(710, "Ambient SFX")
  .add(711, "Player SFX")
  .build();

export const WALL_TAGS = mapBuilder<number, string>()
  .add(0, "Normal")
  .add(20, "Toggle switch")
  .add(21, "1-Way switch")
  .add(500, "Wall Link")
  .add(501, "Wall Stack")
  .add(511, "Gib Wall")
  .build();

export const SECTOR_TAGS = mapBuilder<number, string>()
  .add(0, "Normal")
  .add(600, "Z Motion")
  .add(602, "Z Motion SPRITE")
  .add(603, "Warp")
  .add(604, "Teleporter")
  .add(614, "Slide Marked")
  .add(615, "Rotate Marked")
  .add(616, "Slide")
  .add(617, "Rotate")
  .add(613, "Step Rotate")
  .add(612, "Path Sector")
  .add(618, "Damage Sector")
  .add(619, "Counter Sector")
  .build();