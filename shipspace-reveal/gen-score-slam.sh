#!/bin/bash
# 15s score for TerminalSlam — drone + pulse, a thud for every terminal slam
# (5.4/6.0/6.6/7.2/7.8/8.4s), a big hit for the browser pane (9.27s), and a
# final impact on the pull-back reveal (12.0s). Fade out from 13.8s.
set -e
FF=/opt/homebrew/bin/ffmpeg

# decaying 70Hz thud + 1.2k click at time T: gte(t,T)*exp(-k*(t-T))*...
thud() { echo "gte(t\,$1)*(0.62*exp(-11*(t-$1))*sin(2*PI*70*(t-$1))+0.18*exp(-26*(t-$1))*sin(2*PI*1230*(t-$1)))"; }

THUDS="$(thud 5.4)+$(thud 6.0)+$(thud 6.6)+$(thud 7.2)+$(thud 7.8)+$(thud 8.4)"
BIG="gte(t\,9.27)*(0.9*exp(-5*(t-9.27))*sin(2*PI*55*(t-9.27))+0.5*exp(-9*(t-9.27))*sin(2*PI*36.71*(t-9.27)))"
FINAL="gte(t\,12)*(0.8*exp(-5*(t-12))*sin(2*PI*55*(t-12))+0.45*exp(-9*(t-12))*sin(2*PI*73.42*(t-12)))"

$FF -y -v error \
  -f lavfi -i "aevalsrc=(0.20*sin(2*PI*73.42*t)+0.12*sin(2*PI*110*t)+0.06*sin(2*PI*146.83*t))*min(t/2\,1):d=15:s=48000" \
  -f lavfi -i "aevalsrc=0.12*sin(2*PI*146.83*t)*lt(mod(t\,0.25)\,0.13)*min(max(t-2.2\,0)/2.5\,1)*(1-0.5*gte(t\,12)):d=15:s=48000" \
  -f lavfi -i "aevalsrc=${THUDS}:d=15:s=48000" \
  -f lavfi -i "aevalsrc=${BIG}+${FINAL}:d=15:s=48000" \
  -f lavfi -i "anoisesrc=color=pink:r=48000:d=15:seed=909" \
  -f lavfi -i "aevalsrc=gte(t\,12.2)*0.038*(sin(2*PI*587.33*t)+0.7*sin(2*PI*880*t))*(0.6+0.4*sin(2*PI*0.8*t)):d=15:s=48000" \
  -filter_complex "\
    [0:a]lowpass=f=600[drone];\
    [1:a]lowpass=f=2200[pulse];\
    [2:a]lowpass=f=3000[thuds];\
    [4:a]highpass=f=300,lowpass=f=6000,volume='between(t,3.2,5.0)*pow((t-3.2)/1.8,2)*0.30+between(t,10.4,12.0)*pow((t-10.4)/1.6,2)*0.40':eval=frame[risers];\
    [drone][pulse][thuds][3:a][risers][5:a]amix=inputs=6:duration=longest:normalize=0,\
    pan=stereo|c0=c0|c1=c0,afade=t=out:st=13.8:d=1.2,volume=0.8,alimiter=limit=0.85:level=0" \
  -c:a pcm_s16le public/score-slam.wav

echo "score-slam.wav written"
