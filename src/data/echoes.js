// Recovered evidence changes the fire account; the reunion and final voicemail remain.
export const REPEATED_SENTENCE='I WILL NOT LOOK AWAY.';
export const MARA_PAGES={
  mara_page_2:{type:'MARA’S JOURNAL / 2',title:'Every school day',body:'Eli,\n\nThey wait by the classroom every day. Today my books were in the sink. Yesterday it was my lunch. They laugh until a teacher comes, and then nobody saw anything.\n\nI kept the drawing. I wish we were still the two people in it.'},
  mara_page_3:{type:'MARA’S JOURNAL / 3',title:'A complaint without a name',body:'I went to the headmaster again. He said there was no complaint on file. I watched him put my letter in the locked box.\n\nThe librarian kept the little piece that fell out of his bell. She said a silent school is not a peaceful school.\n\nI wish you had been there, Eli.'},
  mara_page_4:{type:'MARA’S JOURNAL / 4',title:'They read my pages',body:'They found the pages I hid. The laughing stopped. They were looking at the clock instead of me.\n\nSomeone carried the register to the front office. Their bags were already gone.\n\nI thought I wanted them to be afraid. It did not make any of this better.'},
  headmaster_file:{type:'HEADMASTER’S SEALED FILE',title:'The complaints were received',body:'M. WARD / REPEATED HARASSMENT\n\nReports received: Monday. Tuesday. Wednesday. Thursday. Friday.\nAction taken: [blank]\n\nAn attendance roll is folded behind the complaints. Several pupils were signed out before the alarm. Mara’s line is still open.\n\nA classroom number survives on its cover: 08.'},
  ash_register:{type:'CLASSROOM 08 / ATTENDANCE ROLL',title:'An empty row',body:'The names on Mara’s complaints match the early departures. Someone warned them. All of them left before the fire.\n\nMara Ward: no departure recorded.\n\nA final page is missing from the journal. Its torn corner is pressed into the gym timetable.'},
};

// Interior boundaries keep the echoes out of doorways and the friendly memories.
export const ECHO_ROOMS=[
  {id:'lobby',x:0,z:7,w:14,d:10,count:2,boardX:-4.8,boardZ:11.75,boardYaw:Math.PI,boardWidth:3.2},
  {id:'classroom',x:-9,z:-18.5,w:12,d:13,count:6,boardZ:-24.84},
  {id:'office',x:9,z:-18.5,w:12,d:13,count:2,boardZ:-12.16,boardYaw:Math.PI},
  {id:'archive',x:-9,z:-38.5,w:12,d:13,count:3,boardZ:-32.16,boardYaw:Math.PI},
  {id:'phone',x:9,z:-38.5,w:12,d:13,count:6,boardZ:-44.84},
  {id:'maintenance',x:17.5,z:-44,w:5,d:36,count:2,boardZ:-26.16,boardYaw:Math.PI},
  {id:'gym',x:1.5,z:-71,w:37,d:18,count:6,boardX:-10.5},
  {id:'library',x:-37.25,z:-39,w:13.5,d:12,count:3},
  {id:'infirmary',x:-37.25,z:-55,w:13.5,d:12,count:2},
  {id:'workshop',x:-24.25,z:-56.5,w:6.5,d:9,count:2},
  {id:'boiler',x:-24.25,z:-40,w:6.5,d:14,count:2},
  {id:'lostProperty',x:-17.5,z:-23.25,w:5,d:3.5,count:1,boardZ:-21.66,boardYaw:Math.PI},
  {id:'serviceCache',x:22.5,z:-52.5,w:5,d:5,count:1},
  {id:'mapStore',x:17.5,z:-22,w:5,d:5,count:1},
  {id:'projection',x:-17.5,z:-40,w:5,d:6,count:1,boardZ:-37.16,boardYaw:Math.PI},
  {id:'evidenceVault',x:27.5,z:-52.5,w:5,d:5,count:1},
];
export const ELI_ROOMS={
  locker:{room:'lobby',position:[-4,4]},
  drawing:{room:'classroom',position:[-12.8,-17]},
  cassette:{room:'classroom',position:[-12.8,-21.2]},
  phone:{room:'phone',position:[12.9,-34.5]},
  afternoon:{room:'phone',position:[4.9,-34]},
  fault:{room:'maintenance',position:[18,-49]},
  vale:{room:'archive',position:[-13,-35]},
  headmaster:{room:'office',position:[13,-20]},
  emptyClass:{room:'phone',position:[12.8,-43.6]},
  waiting:{room:'gym',position:[-4,-73]},
};
