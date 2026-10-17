// Recovered evidence changes the fire account; the reunion and final voicemail remain.
export const REPEATED_SENTENCE='I WILL NOT LOOK AWAY.';
export const MARA_PAGES={
  mara_page_2:{type:'MARA’S JOURNAL / 2',title:'It was only rain',body:'Eli,\n\nMonday: rain in my books. Tuesday: the fence caught my sleeve. Wednesday: I was not hungry anyway. Thursday: I fell. Friday: I fell again.\n\nNone of those are the words I wanted to write.\n\nI put our drawing somewhere dry. The two people in it still look brave.'},
  mara_page_3:{type:'MARA’S JOURNAL / 3',title:'Nothing to report',body:'The headmaster asked whether I was sure. I said it was probably nothing. He closed the box before I finished.\n\nI keep practising the real sentence. I never get past the first word.\n\nThe library bell does not ring now. Its voice is tucked between borrowed pages. That seems safer.'},
  mara_page_4:{type:'MARA’S JOURNAL / 4',title:'Not in my handwriting',body:'Someone unfolded the pages. The creases go the wrong way. There is soot on the edge where I had drawn the doors.\n\nThey were not laughing today. They watched the clock. Their bags were missing before the last bell.\n\nI crossed out the part about wanting them to feel it. You can still see it, Eli.'},
  headmaster_file:{type:'HEADMASTER’S SEALED FILE',title:'The words she took back',body:'M. WARD / REPEATED HARASSMENT\n\nMonday: books held under water.\nTuesday: sleeve torn by pupils.\nWednesday: lunch taken.\nThursday / Friday: pushed on the stairs.\n\nThe corrections are in the same hand as the diary. “Please do not tell them I wrote this.”\n\nReceived: five reports. Action: [blank]\n\nA copied roll is folded inside. Its cover reads 08.'},
  ash_register:{type:'CLASSROOM 08 / ATTENDANCE ROLL',title:'Before the alarm',body:'Beside the names from the sealed reports: early departure. Same time. Same ink.\n\nOn the reverse: “She wrote it down. We saw. Do not wait for the bell.”\n\nMara Ward: no departure recorded.\n\nA torn corner is caught in the gym timetable. The other half has a brass clasp.'},
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
