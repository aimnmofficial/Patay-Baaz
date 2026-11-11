import asyncio, json, wave, struct, sys
from playwright.async_api import async_playwright
SRC = open('/home/claude/pb/sfx.js').read().replace('})(window);', '})(fake);')
NAMES = {'shuffle':3,'slap':1,'swoosh':1,'pickup':1,'pass':1,'ding':1,'lock':1.2,'gasp':1,'boing':1,'thulla':2.5,'laugh':1.5,'evil':2,'tick':.3,'dhol':4.5,'cheer':1,'win':2.5,'lose':2.5}
JS = """async ([src,name,dur]) => {
  const fake = { };
  fake.AudioContext = function(){ const o = new OfflineAudioContext(1, Math.ceil(44100*dur), 44100); o.resume = () => Promise.resolve(); fake.ac = o; return o; };
  new Function('fake', src)(fake);
  fake.SFX.setMode(2); fake.SFX[name](name=='dhol'?2:undefined);
  const buf = await fake.ac.startRendering(); const d = buf.getChannelData(0); const out = new Int16Array(d.length);
  for (let i=0;i<d.length;i++) out[i] = Math.max(-1,Math.min(1,d[i]))*32767;
  return Array.from(out);
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); await pg.goto('about:blank')
        for n, d in NAMES.items():
            data = await pg.evaluate(JS, [SRC, n, d])
            w = wave.open(f'/tmp/pack/wav/{n}.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(44100); w.writeframes(struct.pack('<%dh'%len(data), *data)); w.close()
            print(n, len(data)/44100, max(abs(x) for x in data))
        await b.close()
asyncio.run(main())
