@echo off
cd /d C:\geo-proxy
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" i -g vercel
node_modules\vercel\bin\vercel --yes