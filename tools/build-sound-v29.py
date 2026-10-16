# Original deterministic PCM sound design; rebuild with Python 3.
import wave,math,random,struct
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'assets/sfx'
sr=24000
for name,duration in [('headmaster-step',.8),('headmaster-presence',2.1),('headmaster-bell',2.5),('chalk-writing',1.3),('ash-turn',.9),('ash-embers',2.8),('eli-fracture',1.9)]:
 rng=random.Random(name);samples=[];last=0;low=0
 for i in range(int(sr*duration)):
  t=i/sr;n=rng.uniform(-1,1);low=low*.91+n*.09;high=n-last;last=n
  env=min(1,t/.018)*min(1,(duration-t)/.1)
  if name=='headmaster-step':
   thud=math.sin(2*math.pi*(68*t-16*t*t))*math.exp(-t*17)
   tap=max(0,t-.19);v=.48*thud+(high*.19+math.sin(2*math.pi*1120*t)*.14)*math.exp(-tap*65)*(t>.19)
  elif name=='headmaster-presence':v=.2*math.sin(2*math.pi*(48*t-5*t*t))+.1*math.sin(2*math.pi*73*t)+low*.28
  elif name=='headmaster-bell':v=sum(a*math.sin(2*math.pi*f*t)*math.exp(-t*d) for f,a,d in [(782,.25,1.8),(1127,.16,2.5),(1739,.09,3.2)])
  elif name=='chalk-writing':v=high*.16*(.2+.8*max(0,math.sin(t*31)))*(.5+.5*math.sin(t*7.3)**2)
  elif name=='ash-turn':v=low*.9*math.sin(math.pi*t/duration)**2+high*.09*math.exp(-abs(t-.32)*90)
  elif name=='ash-embers':v=low*.15+(high*.25 if rng.random()<.003 else 0)
  else:v=low*.4*(t/duration)+.13*math.sin(2*math.pi*(91*t+17*t*t))+.07*math.sin(2*math.pi*(137*t-9*t*t))
  samples.append(struct.pack('<h',int(max(-.9,min(.9,v*env))*32767)))
 with wave.open(str(out/(name+'-v29.wav')),'wb') as wav:
  wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(sr);wav.writeframes(b''.join(samples))
 print(name,round(duration,1),'s')
