"""Layer a CC0 recorded scream and bundled foley into offline capture/room/environment cues.
Run with work/neural-voice-env/bin/python; source recording is documented in assets/sfx/README.md.
"""
from pathlib import Path
from array import array
import math,wave,random,miniaudio
ROOT=Path(__file__).resolve().parents[1];RATE=24000;rng=random.Random(1313)
def read(path):
 v=miniaudio.decode_file(str(path),nchannels=1,sample_rate=RATE).samples
 return [x/32768 for x in v]
scream=read(ROOT/'assets/sfx/source-scream-cc0.mp3')
start=next(i for i,x in enumerate(scream) if abs(x)>.025);scream=scream[max(0,start-48):]
foley={n:read(ROOT/'assets/sfx'/(n+'.wav')) for n in ['metal','creak','wood','soft','door-open','cloth','step-tile-0','step-tile-1','step-tile-2','step-tile-3']}
def sample(v,t,speed=1):
 p=t*RATE*speed;i=int(p)
 return v[i]*(1-p+i)+v[i+1]*(p-i) if 0<=i<len(v)-1 else 0
for name,kind,duration in [('teacher-impact-v13',0,2.8),('room-impact-v13',1,2.6),('locker-open-v13',2,2.1),('empty-steps-v13',3,3.7)]:
 l=[];r=[];brown=0
 for i in range(int(RATE*duration)):
  t=i/RATE;brown=.88*brown+rng.uniform(-1,1)*.12
  if kind<2:
   voice=sample(scream,t,.82 if kind==0 else .68)
   warped=sample(scream,t-.024,.57 if kind==0 else 1.18)
   impact=sample(foley['metal'],t,.65)+sample(foley['wood'],t,.86)*.75+sample(foley['soft'],t,.62)*.9
   scrape=sample(foley['creak'],t,.39)*.42
   bass=math.sin(2*math.pi*(47*t-4*t*t))*math.exp(-t*5)*.42
   v=voice*1.3+warped*.48+impact*.48+scrape+bass+brown*.3*math.exp(-t*8)
   # Preserve vocal roughness; soft saturate the layered signal without digital clipping.
   v=math.tanh(v*1.3)
  elif kind==2:
   v=sample(foley['door-open'],t,.73)*.8+sample(foley['creak'],t,.57)*.5+sample(foley['metal'],t-.52,.84)*.36
  else:
   v=sum(sample(foley['step-tile-'+str(j%4)],t-at,.83+j*.035)*gain for j,(at,gain) in enumerate([(0,.7),(.69,.6),(1.4,.48),(2.19,.34)]))
  v*=min(1,t/.001)*min(1,max(0,(duration-t)/.15));l.append(v);r.append(v*.94)
 for delay,gain in [(.065,.19),(.17,.14),(.36,.1),(.62,.06)]:
  off=int(delay*RATE)
  for i in range(len(l)-1,off,-1):r[i]+=l[i-off]*gain;l[i]+=r[i-off]*gain*.6
 peak=max(max(map(abs,l)),max(map(abs,r)));gain=.88/max(peak,1e-6);frames=array('h')
 for a,b in zip(l,r):frames.extend((round(a*gain*32767),round(b*gain*32767)))
 with wave.open(str(ROOT/'assets/sfx'/(name+'.wav')),'wb') as w:
  w.setnchannels(2);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(frames.tobytes())
 print(name,'stereo PCM',duration,'seconds, -1.1dBFS peak',flush=True)
