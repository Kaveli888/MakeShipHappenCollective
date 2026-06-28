#!/bin/bash
# 30s score for the ShipSpace Commercial30 — same D-minor language as the 15s.
# Timeline: 0-3s drone fades in · 3.8s pulse enters (laptop opens) ·
# 19.5-23.6s riser · 23.6s impact (verdict card) · 27s second soft impact
# (end card) · shimmer tail · fade out from 28.8s.
set -e
FF=/opt/homebrew/bin/ffmpeg

$FF -y -v error \
  -f lavfi -i "aevalsrc=(0.20*sin(2*PI*73.42*t)+0.12*sin(2*PI*110*t)+0.06*sin(2*PI*146.83*t))*min(t/3\,1):d=30:s=48000" \
  -f lavfi -i "aevalsrc=0.14*sin(2*PI*146.83*t)*lt(mod(t\,0.25)\,0.13)*min(max(t-3.8\,0)/3\,1)*(1-0.55*gte(t\,23.6)):d=30:s=48000" \
  -f lavfi -i "anoisesrc=color=pink:r=48000:d=30:seed=707" \
  -f lavfi -i "aevalsrc=gte(t\,23.6)*(0.85*exp(-5*(t-23.6))*sin(2*PI*55*(t-23.6))+0.5*exp(-9*(t-23.6))*sin(2*PI*36.71*(t-23.6)))+gte(t\,27)*(0.55*exp(-5*(t-27))*sin(2*PI*73.42*(t-27))+0.32*exp(-9*(t-27))*sin(2*PI*48.99*(t-27))):d=30:s=48000" \
  -f lavfi -i "anoisesrc=color=white:r=48000:d=30:seed=121" \
  -f lavfi -i "aevalsrc=gte(t\,23.9)*0.040*(sin(2*PI*587.33*t)+0.7*sin(2*PI*880*t))*(0.6+0.4*sin(2*PI*0.8*t)):d=30:s=48000" \
  -filter_complex "\
    [0:a]lowpass=f=600[drone];\
    [1:a]lowpass=f=2200[pulse];\
    [2:a]highpass=f=300,lowpass=f=6000,volume='between(t,19.5,23.6)*pow((t-19.5)/4.1,2)*0.45':eval=frame[riser];\
    [4:a]volume='(gte(t,23.6)*exp(-14*(t-23.6))+gte(t,27)*exp(-14*(t-27)))*0.45':eval=frame[burst];\
    [drone][pulse][riser][3:a][burst][5:a]amix=inputs=6:duration=longest:normalize=0,\
    pan=stereo|c0=c0|c1=c0,afade=t=out:st=28.8:d=1.2,volume=0.78,alimiter=limit=0.85:level=0" \
  -c:a pcm_s16le public/score30.wav

echo "score30.wav written"
