"""Original spectral arrival/retreat cues; bundled foley plus deterministic synthesis."""
from pathlib import Path
from array import array
import math, random, wave
ROOT = Path(__file__).resolve().parents[1]/'assets/sfx'
RATE = 24000
rng = random.Random(1717)
def read(name):
    with wave.open(str(ROOT/(name+'.wav')), 'rb') as w:
        n, rate = w.getnchannels(), w.getframerate()
        a = array('h', w.readframes(w.getnframes()))
        return [sum(a[i:i+n])/(n*32768) for i in range(0,len(a),n)],rate
def sample(sound,t,speed=1):
    v,rate=sound; p=t*rate*speed; i=int(p)
    return v[i]*(1-p+i)+v[i+1]*(p-i) if 0<=p<len(v)-1 else 0
creak=read('creak'); cloth=read('cloth'); metal=read('metal')
for name,duration in [('apparition-arrival-v17',2.1),('apparition-vanish-v17',.75)]:
    data=[]; noise=0
    for i in range(int(RATE*duration)):
        t=i/RATE; noise=.65*noise+rng.uniform(-1,1)*.35
        if 'arrival' in name:
            # Breathy intake, two dissonant glass notes and a low wooden strain.
            env=math.exp(-t*1.8)*min(1,t/.025)
            chime=(math.sin(2*math.pi*587*t)+.45*math.sin(2*math.pi*622*t))*env*.22
            breath=noise*.2*math.sin(math.pi*min(1,t/1.3))**2
            v=chime+breath+sample(creak,t,.58)*.5+sample(metal,t,1.6)*.16
        else:
            env=math.sin(math.pi*t/duration)**.6
            v=noise*env*.45+sample(cloth,duration-t,.85)*.7+math.sin(2*math.pi*(190*t-85*t*t))*env*.16
        data.append(v)
    peak=max(map(abs,data)) or 1
    pcm=array('h',(round(v/peak*.82*32767*min(1,i/96,(len(data)-i)/500)) for i,v in enumerate(data)))
    with wave.open(str(ROOT/(name+'.wav')),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(pcm.tobytes())
    print(name,duration,'seconds')
