#!/bin/bash
# Fresh 15s score for the ShipSpace reveal — D minor pulse build.
# Timeline: 0-2.5s drone fades in · 2.5s pulse enters · 7.5-11s riser · 11s impact (end card) · shimmer tail · fade out 14.1s
set -e
FF=/opt/homebrew/bin/ffmpeg

$FF -y -v error \
  -f lavfi -i "aevalsrc=(0.20*sin(2*PI*73.42*t)+0.12*sin(2*PI*110*t)+0.06*sin(2*PI*146.83*t))*min(t/2.5\,1):d=15:s=48000" \
  -f lavfi -i "aevalsrc=0.14*sin(2*PI*146.83*t)*lt(mod(t\,0.25)\,0.13)*min(max(t-2.5\,0)/3\,1)*(1-0.55*gte(t\,11)):d=15:s=48000" \
  -f lavfi -i "anoisesrc=color=pink:r=48000:d=15:seed=707" \
  -f lavfi -i "aevalsrc=gte(t\,11)*(0.85*exp(-5*(t-11))*sin(2*PI*55*(t-11))+0.5*exp(-9*(t-11))*sin(2*PI*36.71*(t-11))):d=15:s=48000" \
  -f lavfi -i "anoisesrc=color=white:r=48000:d=15:seed=121" \
  -f lavfi -i "aevalsrc=gte(t\,11.3)*0.040*(sin(2*PI*587.33*t)+0.7*sin(2*PI*880*t))*(0.6+0.4*sin(2*PI*0.8*t)):d=15:s=48000" \
  -filter_complex "\
    [0:a]lowpass=f=600[drone];\
    [1:a]lowpass=f=2200[pulse];\
    [2:a]highpass=f=300,lowpass=f=6000,volume='between(t,7.5,11)*pow((t-7.5)/3.5,2)*0.45':eval=frame[riser];\
    [4:a]volume='gte(t,11)*exp(-14*(t-11))*0.45':eval=frame[burst];\
    [drone][pulse][riser][3:a][burst][5:a]amix=inputs=6:duration=longest:normalize=0,\
    pan=stereo|c0=c0|c1=c0,afade=t=out:st=14.1:d=0.9,volume=0.78,alimiter=limit=0.85:level=0" \
  -c:a pcm_s16le public/score.wav

echo "score.wav written"
