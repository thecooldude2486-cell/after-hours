from pathlib import Path
import math,wave,random,struct
from array import array
rate=24000;root=Path(__file__).resolve().parents[1]/'assets';rng=random.Random(1007)
def read(name):
 with wave.open(str(root/'sfx'/(name+'.wav')),'rb') as w:
  channels=w.getnchannels();sr=w.getframerate();raw=w.readframes(w.getnframes());v=struct.unpack('<'+'h'*(len(raw)//2),raw)
 return [sum(v[i:i+channels])/(32768*channels) for i in range(0,len(v),channels)],sr
def at(src,t,speed=1):
 v,sr=src;p=t*sr*speed;i=int(p)
 return v[i]*(1-(p-i))+v[i+1]*(p-i) if 0<=i<len(v)-1 else 0
metal=read('metal');cloth=read('cloth');creak=read('creak');wood=read('wood');soft=read('soft')
def save(folder,name,l,r):
 peak=max(max(abs(v) for v in l),max(abs(v) for v in r));gain=.87/max(peak,1e-6);frames=array('h')
 for a,b in zip(l,r):frames.extend((round(max(-1,min(1,a*gain))*32767),round(max(-1,min(1,b*gain))*32767)))
 with wave.open(str(root/folder/(name+'.wav')),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes(frames.tobytes())
 print(name,len(l)/rate,'seconds, stereo PCM, peak -1.2 dBFS')
for name,kind,duration in [('teacher-impact-v10',0,3.5),('room-impact-v10',1,3),('vanish-v10',2,1.8),('breath-v10',3,2),('heel-v10',4,1)]:
 l=[];r=[];brown=0
 for i in range(int(rate*duration)):
  t=i/rate;brown=.85*brown+rng.uniform(-1,1)*.15
  if kind==0:v=at(metal,t,.7)+at(wood,t-.018,.8)*.8+at(creak,t,.36)*.6+at(soft,t,.75)*.8+math.sin(2*math.pi*(49*t-2*t*t))*math.exp(-t*3)*.32
  elif kind==1:v=at(soft,t,.67)+at(cloth,t,.48)*1.2+at(creak,t,.58)*.7+at(metal,t-.02,1.1)*.65+brown*.12*math.exp(-t*6)
  elif kind==2:v=at(cloth,t,.58)*.65+at(creak,t,.36)*.22+brown*.12*math.sin(min(1,t/1.5)*math.pi)**2
  elif kind==3:v=brown*.3*math.sin(min(1,t/1.7)*math.pi)**2+at(cloth,t,.44)*.18
  else:v=at(wood,t,1.13)*.7+at(soft,t,.81)*.6+at(metal,t,.58)*.08
  v*=min(1,t/.002)*min(1,max(0,(duration-t)/.12));l.append(v);r.append(v*.92+at(creak,t-.09,.41)*(.12 if kind<2 else .025))
 # Long irregular reflections preserve the foley rather than a flat synthesized bang.
 for delay,gain in [(.073,.2),(.193,.14),(.337,.08)]:
  offset=int(delay*rate)
  for i in range(len(l)-1,offset,-1):r[i]+=l[i-offset]*gain;l[i]+=r[i-offset]*gain*.75
 save('sfx',name,l,r)
for name,kind in [('empty-school-song-v10',0),('maintenance-pressure-v10',1),('pursuit-v10',2),('gym-memory-v10',3)]:
 duration=24;n=rate*duration;l=[0.]*n;r=[0.]*n
 # Slowly beating, inharmonic bowed resonance beneath a sparse minor piano phrase.
 for i in range(n):
  t=i/rate;sw=.44+.24*math.sin(t*.47)+.12*math.sin(t*1.1)
  base=49 if kind==1 else 55
  bed=(math.sin(2*math.pi*base*t)*.11+math.sin(2*math.pi*(base+1.25)*t)*.075+math.sin(2*math.pi*(base*3.01)*t)*.028)*sw
  if kind==2:
   pulse=math.exp(-(t%(60/86))*13);bed+=math.sin(2*math.pi*43*t)*pulse*.24+at(metal,(t%2.79),.41)*.14
  if kind==1:bed+=at(creak,t%6,.23)*.11+math.sin(2*math.pi*233*t+.16*math.sin(t*1.3))*.022*sw
  l[i]=bed;r[i]=bed*.83+math.sin(2*math.pi*(base+.73)*t)*.045*sw
 notes=[57,58,64,53,56,61,52,55] if kind!=3 else [60,59,55,58,53,56,48,55]
 spacing=2.79 if kind==2 else 3
 for j,note in enumerate(notes):
  start=int(j*spacing*rate);freq=440*2**((note-69)/12)
  for k in range(min(rate*5,n-start)):
   t=k/rate;attack=min(1,t/.006);phase=2*math.pi*freq*t
   piano=sum(math.sin(phase*(h+.0018*h*h))*math.exp(-t*(.85+h*.31))/(h*h) for h in range(1,7))*.14*attack
   i=start+k;l[i]+=piano;r[i]+=piano*.7+math.sin(phase*1.007)*math.exp(-t*1.6)*.04*attack
 for delay,gain in [(.31,.26),(.67,.16),(1.19,.10)]:
  off=int(delay*rate)
  for i in range(n-1,off,-1):r[i]+=l[i-off]*gain;l[i]+=r[i-off]*gain*.7
 # A silent loop boundary with a long swell prevents an audible seam.
 for i in range(n):
  env=min(1,i/(rate*.7),(n-i)/(rate*.9));l[i]*=env;r[i]*=env
 save('music',name,l,r)
