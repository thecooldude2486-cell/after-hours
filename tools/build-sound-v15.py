"""Distinct room voices and clear empty-school foley from existing bundled recordings.
No external downloads. Run with Python 3; output is deterministic mono positional PCM.
"""
from pathlib import Path
from array import array
import math, wave
ROOT = Path(__file__).resolve().parents[1] / 'assets/sfx'
RATE = 24000
def read(name):
    with wave.open(str(ROOT / (name + '.wav')), 'rb') as w:
        channels, rate = w.getnchannels(), w.getframerate()
        assert w.getsampwidth() == 2
        a = array('h', w.readframes(w.getnframes()))
        mono = [sum(a[i:i+channels]) / (channels * 32768) for i in range(0, len(a), channels)]
        return mono, rate
def sample(sound, t, speed=1):
    v, rate = sound
    p = t * rate * speed
    i = int(p)
    return v[i] * (1-p+i) + v[i+1] * (p-i) if 0 <= p < len(v)-1 else 0
sounds = {n: read(n) for n in ['room-impact-v13','metal','creak','wood','cloth','step-tile-0','step-tile-1','step-tile-2','step-tile-3']}
def s(n, t, speed=1): return sample(sounds[n], t, speed)
def render(name, duration, fn):
    data = [fn(i/RATE) for i in range(round(duration * RATE))]
    peak = max(map(abs, data)) or 1
    data = [math.tanh(x / peak * 1.5) / math.tanh(1.5) * .88 for x in data]
    pcm = array('h', (round(x * min(1, i/48, (len(data)-i)/1200) * 32767) for i,x in enumerate(data)))
    with wave.open(str(ROOT / (name+'.wav')), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(pcm.tobytes())
    print(name, duration, 'seconds')
render('locker-open-v15', 4.1, lambda t: s('metal',t)*.75 + s('creak',t-.1,.65)*.65 + s('metal',t-3.65,.9)*.65)
render('empty-steps-v15', 4.1, lambda t: sum(s('step-tile-'+str(j%4), t-at, .94+j*.015)*g for j,(at,g) in enumerate([(0,1),(.72,.94),(1.46,.87),(2.23,.78),(3.03,.65)])))
render('monster-office-v15', 5.8, lambda t: s('room-impact-v13',t,1.05)*.85 + sum(s('wood',t-a,.7)*.24 for a in [0,1.1,2.3,3.6,4.8]) + s('room-impact-v13',t-2.6,.6)*.35)
render('monster-phone-v15', 5.8, lambda t: s('room-impact-v13',t,.88)*(.55+.35*math.sin(t*54)**2) + math.sin(2*math.pi*440*t)*.06*math.exp(-t*.5)*(1 if t%1.4<.28 else 0) + sum(s('metal',t-a,1.4)*.22 for a in [0,.7,1.8,3,4.2]))
render('monster-archive-v15', 5.8, lambda t: s('room-impact-v13',t,.64)*.85 + s('creak',t,.42)*.55 + sum(s('cloth',t-a,.65)*.35 for a in [.4,1.8,3.2,4.6]) + math.sin(2*math.pi*(42*t-1.2*t*t))*.12*math.exp(-t*.7))
