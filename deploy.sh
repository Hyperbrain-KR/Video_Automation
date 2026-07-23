#!/bin/bash
set -e

echo "🚀 배포 시작..."

# 백엔드 (Railway) - git push
echo "📡 Railway 배포 중..."
git push origin main
echo "✅ Railway 배포 완료"

# 프론트엔드 (Vercel)
echo "🌐 Vercel 배포 중..."
npx vercel --prod
echo "✅ Vercel 배포 완료"

echo "🎉 배포 완료!"
